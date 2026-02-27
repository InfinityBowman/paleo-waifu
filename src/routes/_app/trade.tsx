import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { eq, and } from 'drizzle-orm'
import { createDb } from '@/lib/db/client'
import { tradeOffer, userCreature, creature, user } from '@/lib/db/schema'
import { ensureSession } from '@/lib/auth-server'
import { TradeList } from '@/components/trade/TradeList'

const getTradeData = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await ensureSession()
  const db = createDb((env as unknown as Env).DB)

  const [openTrades, myCreatures] = await Promise.all([
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
      .innerJoin(userCreature, eq(userCreature.id, tradeOffer.offeredCreatureId))
      .innerJoin(creature, eq(creature.id, userCreature.creatureId))
      .where(eq(tradeOffer.status, 'open'))
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

  return { openTrades, myCreatures, userId: session.user.id }
})

export const Route = createFileRoute('/_app/trade')({
  loader: () => getTradeData(),
  component: TradePage,
})

function TradePage() {
  const { openTrades, myCreatures, userId } = Route.useLoaderData()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Trade Market</h1>
        <p className="mt-2 text-muted-foreground">
          Browse trades or offer your own creatures.
        </p>
      </div>
      <TradeList
        trades={openTrades}
        myCreatures={myCreatures}
        userId={userId}
      />
    </div>
  )
}
