import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, inArray, lt } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { createDb } from '@paleo-waifu/shared/db/client'
import {
  creature,
  tradeOffer,
  tradeProposal,
  user,
  userCreature,
} from '@paleo-waifu/shared/db/schema'
import { getCfEnv } from '@/lib/env'
import { toCdnUrl } from '@/lib/utils'
import { getLockedCreatureIds } from '@/lib/trade-locks'
import { TradeList } from '@/components/trade/TradeList'

export const getCreaturePreview = createServerFn({ method: 'GET' })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const db = await createDb(getCfEnv().DB)
    const rows = await db
      .select({
        name: creature.name,
        scientificName: creature.scientificName,
        rarity: creature.rarity,
        era: creature.era,
        diet: creature.diet,
        imageUrl: creature.imageUrl,
        description: creature.description,
        period: creature.period,
        sizeMeters: creature.sizeMeters,
        weightKg: creature.weightKg,
        funFacts: creature.funFacts,
      })
      .from(creature)
      .where(eq(creature.id, id))
    if (rows.length === 0) return null
    const row = rows[0]
    return { ...row, imageUrl: toCdnUrl(row.imageUrl) }
  })

const PAGE_SIZE = 20

async function expireStaleTradesIfAny(
  db: Awaited<ReturnType<typeof createDb>>,
) {
  const now = new Date()

  const staleTrades = await db
    .select({ id: tradeOffer.id })
    .from(tradeOffer)
    .where(and(eq(tradeOffer.status, 'open'), lt(tradeOffer.expiresAt, now)))
    .all()

  if (staleTrades.length === 0) return

  const tradeIds = staleTrades.map((t) => t.id)

  await db.batch([
    db
      .update(tradeOffer)
      .set({ status: 'expired' })
      .where(inArray(tradeOffer.id, tradeIds)),
    // Cancel pending proposals on expired trades
    db
      .update(tradeProposal)
      .set({ status: 'cancelled' })
      .where(
        and(
          inArray(tradeProposal.tradeId, tradeIds),
          eq(tradeProposal.status, 'pending'),
        ),
      ),
  ])
}

const getTradeData = createServerFn({ method: 'GET' })
  .inputValidator((d: { userId: string; cursor: number | null }) => d)
  .handler(async ({ data: { userId, cursor } }) => {
    const db = await createDb(getCfEnv().DB)

    await expireStaleTradesIfAny(db)

    // Aliases for proposal queries
    const proposerUser = alias(user, 'proposer_user')
    const proposerUc = alias(userCreature, 'proposer_uc')
    const proposerCreature = alias(creature, 'proposer_creature')
    const tradeCreature = alias(creature, 'trade_creature')
    const tradeUc = alias(userCreature, 'trade_uc')
    const tradeOwner = alias(user, 'trade_owner')

    const openTradesWhere = cursor
      ? and(
          eq(tradeOffer.status, 'open'),
          lt(tradeOffer.createdAt, new Date(cursor)),
        )
      : eq(tradeOffer.status, 'open')

    const [openTradesRaw, myProposals, incomingProposals, myCreatures] =
      await Promise.all([
        // Open trades for the marketplace
        db
          .select({
            id: tradeOffer.id,
            offererId: tradeOffer.offererId,
            offererName: user.name,
            offererImage: user.image,
            offeredCreatureBaseId: creature.id,
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

        // Proposals I've made on other people's trades
        db
          .select({
            proposalId: tradeProposal.id,
            tradeId: tradeProposal.tradeId,
            proposerCreatureId: tradeProposal.proposerCreatureId,
            createdAt: tradeProposal.createdAt,
            // Trade info
            tradeOwnerName: tradeOwner.name,
            tradeOwnerImage: tradeOwner.image,
            tradeCreatureBaseId: tradeCreature.id,
            tradeCreatureName: tradeCreature.name,
            tradeCreatureRarity: tradeCreature.rarity,
            // My proposed creature
            proposerCreatureBaseId: proposerCreature.id,
            proposerCreatureName: proposerCreature.name,
            proposerCreatureRarity: proposerCreature.rarity,
          })
          .from(tradeProposal)
          .innerJoin(tradeOffer, eq(tradeOffer.id, tradeProposal.tradeId))
          .innerJoin(tradeOwner, eq(tradeOwner.id, tradeOffer.offererId))
          .innerJoin(tradeUc, eq(tradeUc.id, tradeOffer.offeredCreatureId))
          .innerJoin(tradeCreature, eq(tradeCreature.id, tradeUc.creatureId))
          .innerJoin(
            proposerUc,
            eq(proposerUc.id, tradeProposal.proposerCreatureId),
          )
          .innerJoin(
            proposerCreature,
            eq(proposerCreature.id, proposerUc.creatureId),
          )
          .where(
            and(
              eq(tradeProposal.proposerId, userId),
              eq(tradeProposal.status, 'pending'),
            ),
          )
          .all(),

        // Proposals on MY trades (incoming offers for me to review)
        db
          .select({
            proposalId: tradeProposal.id,
            tradeId: tradeProposal.tradeId,
            proposerId: tradeProposal.proposerId,
            proposerCreatureId: tradeProposal.proposerCreatureId,
            createdAt: tradeProposal.createdAt,
            // Proposer info
            proposerName: proposerUser.name,
            proposerImage: proposerUser.image,
            proposerCreatureBaseId: proposerCreature.id,
            proposerCreatureName: proposerCreature.name,
            proposerCreatureRarity: proposerCreature.rarity,
            // My trade creature
            tradeCreatureBaseId: tradeCreature.id,
            tradeCreatureName: tradeCreature.name,
            tradeCreatureRarity: tradeCreature.rarity,
          })
          .from(tradeProposal)
          .innerJoin(tradeOffer, eq(tradeOffer.id, tradeProposal.tradeId))
          .innerJoin(tradeUc, eq(tradeUc.id, tradeOffer.offeredCreatureId))
          .innerJoin(tradeCreature, eq(tradeCreature.id, tradeUc.creatureId))
          .innerJoin(
            proposerUser,
            eq(proposerUser.id, tradeProposal.proposerId),
          )
          .innerJoin(
            proposerUc,
            eq(proposerUc.id, tradeProposal.proposerCreatureId),
          )
          .innerJoin(
            proposerCreature,
            eq(proposerCreature.id, proposerUc.creatureId),
          )
          .where(
            and(
              eq(tradeOffer.offererId, userId),
              eq(tradeOffer.status, 'open'),
              eq(tradeProposal.status, 'pending'),
            ),
          )
          .all(),

        // My creatures for making proposals
        db
          .select({
            id: userCreature.id,
            creatureId: userCreature.creatureId,
            name: creature.name,
            rarity: creature.rarity,
            imageUrl: creature.imageUrl,
            imageAspectRatio: creature.imageAspectRatio,
          })
          .from(userCreature)
          .innerJoin(creature, eq(creature.id, userCreature.creatureId))
          .where(eq(userCreature.userId, userId))
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

    // Filter out creatures already committed to active trades
    const lockedIds = await getLockedCreatureIds(
      db,
      myCreatures.map((c) => c.id),
    )
    const availableCreatures = myCreatures
      .filter((c) => !lockedIds.has(c.id))
      .map((c) => ({ ...c, imageUrl: toCdnUrl(c.imageUrl) }))

    return {
      openTrades: mapCdn(openTrades),
      myProposals,
      incomingProposals,
      myCreatures: availableCreatures,
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
        offeredCreatureBaseId: creature.id,
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
  const {
    openTrades,
    myProposals,
    incomingProposals,
    myCreatures,
    userId,
    hasMore,
  } = Route.useLoaderData()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 2xl:max-w-400">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Trade Market</h1>
        <p className="mt-2 text-muted-foreground">
          Browse trades or offer your own creatures.
        </p>
      </div>
      <TradeList
        trades={openTrades}
        myProposals={myProposals}
        incomingProposals={incomingProposals}
        myCreatures={myCreatures}
        userId={userId}
        hasMore={hasMore}
      />
    </div>
  )
}
