import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { count, eq, sql } from 'drizzle-orm'
import type { Rarity } from '@paleo-waifu/shared/types'
import { RARITY_ORDER } from '@paleo-waifu/shared/types'
import { getCfEnv } from '@/lib/env'
import { createDb } from '@paleo-waifu/shared/db/client'
import { createAuth } from '@/lib/auth'
import {
  creature,
  currency,
  tradeOffer,
  user,
  userCreature,
} from '@paleo-waifu/shared/db/schema'
import { Card, CardContent } from '@/components/ui/card'

const RARITY_BAR_COLORS: Record<Rarity, string> = {
  common: 'bg-rarity-common',
  uncommon: 'bg-rarity-uncommon',
  rare: 'bg-rarity-rare',
  epic: 'bg-rarity-epic',
  legendary: 'bg-rarity-legendary',
}

const getAnalyticsData = createServerFn({ method: 'GET' }).handler(async () => {
  const cfEnv = getCfEnv()
  const auth = await createAuth(cfEnv)
  const session = await auth.api.getSession({
    headers: getRequest().headers,
  })
  if (!session || (session.user as { role?: string }).role !== 'admin') {
    throw new Error('Forbidden')
  }

  const db = await createDb(cfEnv.DB)

  const [
    rarityDist,
    totalFossils,
    avgFossils,
    tradesByStatus,
    totalUsers,
    totalCreatures,
  ] = await Promise.all([
    db
      .select({
        rarity: creature.rarity,
        count: count(),
      })
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
      .select({
        status: tradeOffer.status,
        count: count(),
      })
      .from(tradeOffer)
      .groupBy(tradeOffer.status)
      .all(),
    db.select({ count: count() }).from(user).get(),
    db.select({ count: count() }).from(creature).get(),
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
  }
})

export const Route = createFileRoute('/admin/analytics')({
  loader: () => getAnalyticsData(),
  component: AnalyticsPage,
})

function AnalyticsPage() {
  const data = Route.useLoaderData()

  const totalPulls = data.rarityDistribution.reduce(
    (sum, r) => sum + r.count,
    0,
  )

  const sortedRarity = [...data.rarityDistribution].sort(
    (a, b) =>
      RARITY_ORDER[a.rarity as Rarity] - RARITY_ORDER[b.rarity as Rarity],
  )

  const totalTrades = data.tradesByStatus.reduce((sum, t) => sum + t.count, 0)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">Analytics</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Game health and statistics
      </p>

      {/* Pull Distribution */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-bold">Pull Distribution</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalPulls.toLocaleString()} total pulls across all users
        </p>

        <Card className="mt-4">
          <CardContent className="py-6">
            {totalPulls === 0 ? (
              <p className="text-center text-muted-foreground">
                No pull data yet.
              </p>
            ) : (
              <>
                {/* Stacked bar */}
                <div className="flex h-8 overflow-hidden rounded-full">
                  {sortedRarity.map((r) => {
                    const pct = (r.count / totalPulls) * 100
                    if (pct === 0) return null
                    return (
                      <div
                        key={r.rarity}
                        className={`${RARITY_BAR_COLORS[r.rarity as Rarity]} transition-all`}
                        style={{ width: `${pct}%` }}
                        title={`${r.rarity}: ${r.count} (${pct.toFixed(1)}%)`}
                      />
                    )
                  })}
                </div>

                {/* Legend */}
                <div className="mt-4 flex flex-wrap gap-4">
                  {sortedRarity.map((r) => {
                    const pct = (r.count / totalPulls) * 100
                    return (
                      <div key={r.rarity} className="flex items-center gap-2">
                        <div
                          className={`h-3 w-3 rounded-full ${RARITY_BAR_COLORS[r.rarity as Rarity]}`}
                        />
                        <span className="text-sm capitalize">{r.rarity}</span>
                        <span className="text-sm text-muted-foreground">
                          {r.count.toLocaleString()} ({pct.toFixed(1)}%)
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Economy */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-bold">Fossil Economy</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Card size="sm">
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Total in Circulation
              </div>
              <div className="mt-1 font-display text-2xl font-bold">
                {data.totalFossils.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Average per User
              </div>
              <div className="mt-1 font-display text-2xl font-bold">
                {data.avgFossils}
              </div>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Creatures in Database
              </div>
              <div className="mt-1 font-display text-2xl font-bold">
                {data.totalCreatures}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Trades */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-bold">Trade Activity</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalTrades} total trade offers
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.tradesByStatus.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No trades yet.
              </CardContent>
            </Card>
          ) : (
            data.tradesByStatus.map((t) => (
              <Card key={t.status} size="sm">
                <CardContent>
                  <div className="text-sm capitalize text-muted-foreground">
                    {t.status}
                  </div>
                  <div className="mt-1 font-display text-2xl font-bold">
                    {t.count}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
