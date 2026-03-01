import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, inArray, lt, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { getCfEnv } from '@/lib/env'
import { createDb } from '@/lib/db/client'
import { creature, tradeOffer, user, userCreature } from '@/lib/db/schema'
import { toCdnUrl } from '@/lib/utils'
import { TradeList } from '@/components/trade/TradeList'

const PAGE_SIZE = 20

async function expireStaleTradesIfAny(
  db: Awaited<ReturnType<typeof createDb>>,
) {
  const now = new Date()

  const staleTrades = await db
    .select({
      id: tradeOffer.id,
      offeredCreatureId: tradeOffer.offeredCreatureId,
      receiverCreatureId: tradeOffer.receiverCreatureId,
    })
    .from(tradeOffer)
    .where(
      and(
        inArray(tradeOffer.status, ['open', 'pending']),
        lt(tradeOffer.expiresAt, now),
      ),
    )
    .all()

  if (staleTrades.length === 0) return

  const tradeIds = staleTrades.map((t) => t.id)
  const creatureIdsToUnlock = staleTrades.flatMap(
    (t) =>
      [t.offeredCreatureId, t.receiverCreatureId].filter(
        Boolean,
      ) as Array<string>,
  )

  // offeredCreatureId is NOT NULL so creatureIdsToUnlock is always non-empty
  // when staleTrades is non-empty, but guard defensively
  await db.batch([
    db
      .update(tradeOffer)
      .set({ status: 'expired' })
      .where(inArray(tradeOffer.id, tradeIds)),
    db
      .update(userCreature)
      .set({ isLocked: false })
      .where(inArray(userCreature.id, creatureIdsToUnlock)),
  ])
}

const getTradeData = createServerFn({ method: 'GET' })
  .inputValidator((d: { userId: string; cursor: number | null }) => d)
  .handler(async ({ data: { userId, cursor } }) => {
    const db = await createDb(getCfEnv().DB)

    await expireStaleTradesIfAny(db)

    // Alias tables for the pending trade JOIN
    const offererUser = alias(user, 'offerer_user')
    const receiverUser = alias(user, 'receiver_user')
    const offeredUc = alias(userCreature, 'offered_uc')
    const receiverUc = alias(userCreature, 'receiver_uc')
    const offeredCreature = alias(creature, 'offered_creature')
    const receiverCreature = alias(creature, 'receiver_creature')

    const openTradesWhere = cursor
      ? and(
          eq(tradeOffer.status, 'open'),
          lt(tradeOffer.createdAt, new Date(cursor)),
        )
      : eq(tradeOffer.status, 'open')

    const [openTradesRaw, pendingTrades, myCreatures] = await Promise.all([
      db
        .select({
          id: tradeOffer.id,
          offererId: tradeOffer.offererId,
          offererName: user.name,
          offererImage: user.image,
          offeredCreatureName: creature.name,
          offeredCreatureRarity: creature.rarity,
          offeredCreatureImage: creature.imageUrl,
          wantedCreatureId: tradeOffer.wantedCreatureId,
          createdAt: tradeOffer.createdAt,
        })
        .from(tradeOffer)
        .innerJoin(user, eq(user.id, tradeOffer.offererId))
        .innerJoin(
          userCreature,
          eq(userCreature.id, tradeOffer.offeredCreatureId),
        )
        .innerJoin(creature, eq(creature.id, userCreature.creatureId))
        .where(openTradesWhere)
        .orderBy(desc(tradeOffer.createdAt))
        .limit(PAGE_SIZE + 1)
        .all(),

      // Pending trades: single JOIN query replacing the N+1 pattern
      db
        .select({
          id: tradeOffer.id,
          offererId: tradeOffer.offererId,
          receiverId: tradeOffer.receiverId,
          createdAt: tradeOffer.createdAt,
          offererName: offererUser.name,
          offererImage: offererUser.image,
          receiverName: receiverUser.name,
          receiverImage: receiverUser.image,
          offeredCreatureName: offeredCreature.name,
          offeredCreatureRarity: offeredCreature.rarity,
          receiverCreatureName: receiverCreature.name,
          receiverCreatureRarity: receiverCreature.rarity,
        })
        .from(tradeOffer)
        .innerJoin(offererUser, eq(offererUser.id, tradeOffer.offererId))
        .leftJoin(receiverUser, eq(receiverUser.id, tradeOffer.receiverId))
        .innerJoin(offeredUc, eq(offeredUc.id, tradeOffer.offeredCreatureId))
        .innerJoin(
          offeredCreature,
          eq(offeredCreature.id, offeredUc.creatureId),
        )
        .leftJoin(receiverUc, eq(receiverUc.id, tradeOffer.receiverCreatureId))
        .leftJoin(
          receiverCreature,
          eq(receiverCreature.id, receiverUc.creatureId),
        )
        .where(
          and(
            eq(tradeOffer.status, 'pending'),
            or(
              eq(tradeOffer.offererId, userId),
              eq(tradeOffer.receiverId, userId),
            ),
          ),
        )
        .all(),

      db
        .select({
          id: userCreature.id,
          creatureId: userCreature.creatureId,
          name: creature.name,
          rarity: creature.rarity,
          imageUrl: creature.imageUrl,
          isLocked: userCreature.isLocked,
        })
        .from(userCreature)
        .innerJoin(creature, eq(creature.id, userCreature.creatureId))
        .where(
          and(
            eq(userCreature.userId, userId),
            eq(userCreature.isLocked, false),
          ),
        )
        .all(),
    ])

    const hasMore = openTradesRaw.length > PAGE_SIZE
    const openTrades = hasMore
      ? openTradesRaw.slice(0, PAGE_SIZE)
      : openTradesRaw

    const mapCdn = <T extends { offeredCreatureImage?: string | null }>(
      items: Array<T>,
    ) =>
      items.map((t) => ({
        ...t,
        offeredCreatureImage: toCdnUrl(t.offeredCreatureImage ?? null),
      }))

    return {
      openTrades: mapCdn(openTrades),
      pendingTrades,
      myCreatures: myCreatures.map((c) => ({
        ...c,
        imageUrl: toCdnUrl(c.imageUrl),
      })),
      userId,
      hasMore,
    }
  })

export const loadMoreOpenTrades = createServerFn({ method: 'GET' })
  .inputValidator((d: { cursor: number }) => d)
  .handler(async ({ data: { cursor } }) => {
    const db = await createDb(getCfEnv().DB)

    const rows = await db
      .select({
        id: tradeOffer.id,
        offererId: tradeOffer.offererId,
        offererName: user.name,
        offererImage: user.image,
        offeredCreatureName: creature.name,
        offeredCreatureRarity: creature.rarity,
        offeredCreatureImage: creature.imageUrl,
        wantedCreatureId: tradeOffer.wantedCreatureId,
        createdAt: tradeOffer.createdAt,
      })
      .from(tradeOffer)
      .innerJoin(user, eq(user.id, tradeOffer.offererId))
      .innerJoin(
        userCreature,
        eq(userCreature.id, tradeOffer.offeredCreatureId),
      )
      .innerJoin(creature, eq(creature.id, userCreature.creatureId))
      .where(
        and(
          eq(tradeOffer.status, 'open'),
          lt(tradeOffer.createdAt, new Date(cursor)),
        ),
      )
      .orderBy(desc(tradeOffer.createdAt))
      .limit(PAGE_SIZE + 1)
      .all()

    const hasMore = rows.length > PAGE_SIZE
    const trades = hasMore ? rows.slice(0, PAGE_SIZE) : rows
    return {
      trades: trades.map((t) => ({
        ...t,
        offeredCreatureImage: toCdnUrl(t.offeredCreatureImage),
      })),
      hasMore,
    }
  })

export const Route = createFileRoute('/_app/trade')({
  loader: ({ context }) =>
    getTradeData({ data: { userId: context.session.user.id, cursor: null } }),
  component: TradePage,
})

function TradePage() {
  const { openTrades, pendingTrades, myCreatures, userId, hasMore } =
    Route.useLoaderData()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 2xl:max-w-[1600px]">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Trade Market</h1>
        <p className="mt-2 text-muted-foreground">
          Browse trades or offer your own creatures.
        </p>
      </div>
      <TradeList
        trades={openTrades}
        pendingTrades={pendingTrades}
        myCreatures={myCreatures}
        userId={userId}
        hasMore={hasMore}
      />
    </div>
  )
}
