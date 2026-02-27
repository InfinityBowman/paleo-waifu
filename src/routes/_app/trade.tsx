import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { and, eq, or } from 'drizzle-orm'
import { createDb } from '@/lib/db/client'
import { creature, tradeOffer, user, userCreature } from '@/lib/db/schema'
import { ensureSession } from '@/lib/auth-server'
import { TradeList } from '@/components/trade/TradeList'

const getTradeData = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await ensureSession()
  const db = createDb((env as unknown as Env).DB)

  const [openTrades, pendingTrades, myCreatures] = await Promise.all([
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
      .where(eq(tradeOffer.status, 'open'))
      .all(),
    // Pending trades where the current user is the offerer or receiver
    db
      .select({
        id: tradeOffer.id,
        offererId: tradeOffer.offererId,
        receiverId: tradeOffer.receiverId,
        offeredCreatureId: tradeOffer.offeredCreatureId,
        receiverCreatureId: tradeOffer.receiverCreatureId,
        createdAt: tradeOffer.createdAt,
      })
      .from(tradeOffer)
      .where(
        and(
          eq(tradeOffer.status, 'pending'),
          or(
            eq(tradeOffer.offererId, session.user.id),
            eq(tradeOffer.receiverId, session.user.id),
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
          eq(userCreature.userId, session.user.id),
          eq(userCreature.isLocked, false),
        ),
      )
      .all(),
  ])

  // Hydrate pending trades with creature/user names
  const pendingTradeIds = pendingTrades.flatMap(
    (t) =>
      [t.offeredCreatureId, t.receiverCreatureId].filter(
        Boolean,
      ) as Array<string>,
  )
  const pendingUserIds = pendingTrades.flatMap(
    (t) => [t.offererId, t.receiverId].filter(Boolean) as Array<string>,
  )

  const [creatureDetails, userDetails] = await Promise.all([
    pendingTradeIds.length > 0
      ? db
          .select({
            ucId: userCreature.id,
            name: creature.name,
            rarity: creature.rarity,
          })
          .from(userCreature)
          .innerJoin(creature, eq(creature.id, userCreature.creatureId))
          .all()
          .then((rows) =>
            Object.fromEntries(
              rows
                .filter((r) => pendingTradeIds.includes(r.ucId))
                .map((r) => [r.ucId, { name: r.name, rarity: r.rarity }]),
            ),
          )
      : {},
    pendingUserIds.length > 0
      ? db
          .select({ id: user.id, name: user.name, image: user.image })
          .from(user)
          .all()
          .then((rows) =>
            Object.fromEntries(
              rows
                .filter((r) => pendingUserIds.includes(r.id))
                .map((r) => [r.id, { name: r.name, image: r.image }]),
            ),
          )
      : {},
  ])

  const hydratedPending = pendingTrades.map((t) => ({
    ...t,
    offererName: userDetails[t.offererId]?.name ?? 'Unknown',
    offererImage: userDetails[t.offererId]?.image ?? null,
    receiverName: t.receiverId
      ? (userDetails[t.receiverId]?.name ?? 'Unknown')
      : null,
    receiverImage: t.receiverId
      ? (userDetails[t.receiverId]?.image ?? null)
      : null,
    offeredCreatureName: t.offeredCreatureId
      ? (creatureDetails[t.offeredCreatureId]?.name ?? 'Unknown')
      : 'Unknown',
    offeredCreatureRarity: t.offeredCreatureId
      ? (creatureDetails[t.offeredCreatureId]?.rarity ?? 'common')
      : 'common',
    receiverCreatureName: t.receiverCreatureId
      ? (creatureDetails[t.receiverCreatureId]?.name ?? 'Unknown')
      : null,
    receiverCreatureRarity: t.receiverCreatureId
      ? (creatureDetails[t.receiverCreatureId]?.rarity ?? 'common')
      : null,
  }))

  return {
    openTrades,
    pendingTrades: hydratedPending,
    myCreatures,
    userId: session.user.id,
  }
})

export const Route = createFileRoute('/_app/trade')({
  loader: () => getTradeData(),
  component: TradePage,
})

function TradePage() {
  const { openTrades, pendingTrades, myCreatures, userId } =
    Route.useLoaderData()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
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
      />
    </div>
  )
}
