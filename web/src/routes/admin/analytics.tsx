import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { count, desc, eq, sql } from 'drizzle-orm'
import { createDb } from '@paleo-waifu/shared/db/client'
import {
  creature,
  currency,
  pityCounter,
  tradeOffer,
  user,
  userCreature,
  userXp,
  wishlist,
} from '@paleo-waifu/shared/db/schema'
import { requireAdminSession } from '@/lib/auth-admin'
import { ActivityCharts } from '@/components/admin/analytics/ActivityCharts'
import {
  CreatureCharts,
  WishlistChart,
} from '@/components/admin/analytics/CreatureCharts'
import { EconomySection } from '@/components/admin/analytics/EconomySection'
import {
  PitySection,
  PullDistribution,
  TradeActivity,
} from '@/components/admin/analytics/GameHealthSection'

const getAnalyticsData = createServerFn({ method: 'GET' }).handler(async () => {
  const { cfEnv } = await requireAdminSession()
  const db = await createDb(cfEnv.DB)
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60

  const [
    rarityDist,
    totalFossils,
    avgFossils,
    tradesByStatus,
    totalUsers,
    totalCreatures,
    pullsPerDay,
    usersPerDay,
    topCreatures,
    leastCreatures,
    fossilDistribution,
    levelDistribution,
    pityStats,
    topWishlisted,
  ] = await Promise.all([
    db
      .select({ rarity: creature.rarity, count: count() })
      .from(userCreature)
      .innerJoin(creature, eq(creature.id, userCreature.creatureId))
      .groupBy(creature.rarity)
      .all(),
    db
      .select({ total: sql<number>`coalesce(sum(${currency.fossils}), 0)` })
      .from(currency)
      .get(),
    db
      .select({
        avg: sql<number>`coalesce(round(avg(${currency.fossils}), 1), 0)`,
      })
      .from(currency)
      .get(),
    db
      .select({ status: tradeOffer.status, count: count() })
      .from(tradeOffer)
      .groupBy(tradeOffer.status)
      .all(),
    db.select({ count: count() }).from(user).get(),
    db.select({ count: count() }).from(creature).get(),
    db
      .select({
        date: sql<string>`date(${userCreature.pulledAt}, 'unixepoch')`.as(
          'date',
        ),
        count: count(),
      })
      .from(userCreature)
      .where(sql`${userCreature.pulledAt} >= ${thirtyDaysAgo}`)
      .groupBy(sql`date(${userCreature.pulledAt}, 'unixepoch')`)
      .orderBy(sql`date(${userCreature.pulledAt}, 'unixepoch')`)
      .all(),
    db
      .select({
        date: sql<string>`date(${user.createdAt}, 'unixepoch')`.as('date'),
        count: count(),
      })
      .from(user)
      .where(sql`${user.createdAt} >= ${thirtyDaysAgo}`)
      .groupBy(sql`date(${user.createdAt}, 'unixepoch')`)
      .orderBy(sql`date(${user.createdAt}, 'unixepoch')`)
      .all(),
    db
      .select({
        name: creature.name,
        rarity: creature.rarity,
        count: count(),
      })
      .from(userCreature)
      .innerJoin(creature, eq(creature.id, userCreature.creatureId))
      .groupBy(userCreature.creatureId)
      .orderBy(desc(count()))
      .limit(10)
      .all(),
    db
      .select({
        name: creature.name,
        rarity: creature.rarity,
        count: count(userCreature.id),
      })
      .from(creature)
      .leftJoin(userCreature, eq(userCreature.creatureId, creature.id))
      .groupBy(creature.id)
      .orderBy(count(userCreature.id))
      .limit(10)
      .all(),
    db
      .select({
        bucket: sql<string>`case
          when ${currency.fossils} = 0 then '0'
          when ${currency.fossils} between 1 and 10 then '1-10'
          when ${currency.fossils} between 11 and 50 then '11-50'
          when ${currency.fossils} between 51 and 100 then '51-100'
          when ${currency.fossils} between 101 and 500 then '101-500'
          when ${currency.fossils} between 501 and 1000 then '501-1k'
          else '1k+'
        end`.as('bucket'),
        count: count(),
      })
      .from(currency)
      .groupBy(
        sql`case
          when ${currency.fossils} = 0 then '0'
          when ${currency.fossils} between 1 and 10 then '1-10'
          when ${currency.fossils} between 11 and 50 then '11-50'
          when ${currency.fossils} between 51 and 100 then '51-100'
          when ${currency.fossils} between 101 and 500 then '101-500'
          when ${currency.fossils} between 501 and 1000 then '501-1k'
          else '1k+'
        end`,
      )
      .all(),
    db
      .select({ level: userXp.level, count: count() })
      .from(userXp)
      .groupBy(userXp.level)
      .orderBy(userXp.level)
      .all(),
    db
      .select({
        avgPullsToLegendary:
          sql<number>`coalesce(round(avg(${pityCounter.pullsSinceLegendary}), 1), 0)`.as(
            'avg',
          ),
        maxPullsToLegendary:
          sql<number>`coalesce(max(${pityCounter.pullsSinceLegendary}), 0)`.as(
            'max',
          ),
        dangerZone:
          sql<number>`coalesce(sum(case when ${pityCounter.pullsSinceLegendary} >= 50 then 1 else 0 end), 0)`.as(
            'danger',
          ),
        totalCounters: count(),
      })
      .from(pityCounter)
      .get(),
    db
      .select({
        name: creature.name,
        rarity: creature.rarity,
        count: count(),
      })
      .from(wishlist)
      .innerJoin(creature, eq(creature.id, wishlist.creatureId))
      .groupBy(wishlist.creatureId)
      .orderBy(desc(count()))
      .limit(10)
      .all(),
  ])

  return {
    rarityDistribution: rarityDist as Array<{
      rarity: string
      count: number
    }>,
    totalFossils: (totalFossils as { total: number } | undefined)?.total ?? 0,
    avgFossils: (avgFossils as { avg: number } | undefined)?.avg ?? 0,
    tradesByStatus: tradesByStatus as Array<{
      status: string
      count: number
    }>,
    totalUsers: totalUsers?.count ?? 0,
    totalCreatures: totalCreatures?.count ?? 0,
    pullsPerDay: pullsPerDay as Array<{ date: string; count: number }>,
    usersPerDay: usersPerDay as Array<{ date: string; count: number }>,
    topCreatures: topCreatures as Array<{
      name: string
      rarity: string
      count: number
    }>,
    leastCreatures: leastCreatures as Array<{
      name: string
      rarity: string
      count: number
    }>,
    fossilDistribution: fossilDistribution as Array<{
      bucket: string
      count: number
    }>,
    levelDistribution: levelDistribution as Array<{
      level: number
      count: number
    }>,
    pityStats: {
      avgPullsToLegendary:
        (pityStats as { avgPullsToLegendary: number } | undefined)
          ?.avgPullsToLegendary ?? 0,
      maxPullsToLegendary:
        (pityStats as { maxPullsToLegendary: number } | undefined)
          ?.maxPullsToLegendary ?? 0,
      dangerZone:
        (pityStats as { dangerZone: number } | undefined)?.dangerZone ?? 0,
      totalCounters:
        (pityStats as { totalCounters: number } | undefined)?.totalCounters ??
        0,
    },
    topWishlisted: topWishlisted as Array<{
      name: string
      rarity: string
      count: number
    }>,
  }
})

export const Route = createFileRoute('/admin/analytics')({
  loader: () => getAnalyticsData(),
  staleTime: 5 * 60 * 1000,
  component: AnalyticsPage,
})

function AnalyticsPage() {
  const data = Route.useLoaderData()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">Analytics</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Game health and statistics
      </p>

      <ActivityCharts
        pullsPerDay={data.pullsPerDay}
        usersPerDay={data.usersPerDay}
      />
      <PullDistribution rarityDistribution={data.rarityDistribution} />
      <CreatureCharts
        topCreatures={data.topCreatures}
        leastCreatures={data.leastCreatures}
      />
      <WishlistChart topWishlisted={data.topWishlisted} />
      <EconomySection
        totalFossils={data.totalFossils}
        avgFossils={data.avgFossils}
        totalCreatures={data.totalCreatures}
        fossilDistribution={data.fossilDistribution}
        levelDistribution={data.levelDistribution}
      />
      <PitySection pityStats={data.pityStats} />
      <TradeActivity tradesByStatus={data.tradesByStatus} />
    </div>
  )
}
