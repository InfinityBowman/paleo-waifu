import { RARITY_ORDER } from '@paleo-waifu/shared/types'
import type { Rarity } from '@paleo-waifu/shared/types'
import { Card, CardContent } from '@/components/ui/card'

const RARITY_BAR_COLORS: Record<Rarity, string> = {
  common: 'bg-rarity-common',
  uncommon: 'bg-rarity-uncommon',
  rare: 'bg-rarity-rare',
  epic: 'bg-rarity-epic',
  legendary: 'bg-rarity-legendary',
}

export function PullDistribution({
  rarityDistribution,
}: {
  rarityDistribution: Array<{ rarity: string; count: number }>
}) {
  const totalPulls = rarityDistribution.reduce((sum, r) => sum + r.count, 0)
  const sorted = [...rarityDistribution].sort(
    (a, b) =>
      RARITY_ORDER[a.rarity as Rarity] - RARITY_ORDER[b.rarity as Rarity],
  )

  return (
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
              <div className="flex h-8 overflow-hidden rounded-full">
                {sorted.map((r) => {
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

              <div className="mt-4 flex flex-wrap gap-4">
                {sorted.map((r) => {
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
  )
}

export function PitySection({
  pityStats,
}: {
  pityStats: {
    avgPullsToLegendary: number
    maxPullsToLegendary: number
    dangerZone: number
    totalCounters: number
  }
}) {
  const pityRate =
    pityStats.totalCounters > 0
      ? ((pityStats.dangerZone / pityStats.totalCounters) * 100).toFixed(1)
      : '0'

  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-bold">Pity System</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card size="sm">
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Avg Pulls Since Legendary
            </div>
            <div className="mt-1 font-display text-2xl font-bold">
              {pityStats.avgPullsToLegendary}
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Max Pulls Since Legendary
            </div>
            <div className="mt-1 font-display text-2xl font-bold">
              {pityStats.maxPullsToLegendary}
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <div className="text-sm text-muted-foreground">
              In Soft Pity (50+)
            </div>
            <div className="mt-1 font-display text-2xl font-bold text-amber-400">
              {pityStats.dangerZone}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              of {pityStats.totalCounters} active counters
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <div className="text-sm text-muted-foreground">Pity Rate</div>
            <div className="mt-1 font-display text-2xl font-bold">
              {pityRate}%
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              users in soft pity
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

export function TradeActivity({
  tradesByStatus,
}: {
  tradesByStatus: Array<{ status: string; count: number }>
}) {
  const totalTrades = tradesByStatus.reduce((sum, t) => sum + t.count, 0)

  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-bold">Trade Activity</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {totalTrades} total trade offers
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tradesByStatus.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No trades yet.
            </CardContent>
          </Card>
        ) : (
          tradesByStatus.map((t) => (
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
  )
}
