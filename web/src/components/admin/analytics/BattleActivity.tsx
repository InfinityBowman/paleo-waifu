import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AXIS_TICK, CHART_TOOLTIP_STYLE, GRID_STROKE } from './chart-config'
import { Card, CardContent } from '@/components/ui/card'

export interface BattleActivityData {
  battlesPerDay: Array<{
    date: string
    arena: number
    friendly: number
  }>
  totalBattles: number
  activeBattlers: number
  totalUsers: number
  avgArenaAttacksPerDay: number
  ratingDistribution: Array<{ bucket: string; count: number }>
}

export function BattleActivity({ data }: { data: BattleActivityData }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-bold">Battle Activity</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {data.totalBattles.toLocaleString()} total battles
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardContent>
            <div className="text-sm text-muted-foreground">Active Battlers</div>
            <div className="mt-1 font-display text-2xl font-bold">
              {data.activeBattlers}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              of {data.totalUsers} users (last 7 days)
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Avg Arena Attacks / Day
            </div>
            <div className="mt-1 font-display text-2xl font-bold">
              {data.avgArenaAttacksPerDay}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              per active battler
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <div className="text-sm text-muted-foreground">Total Battles</div>
            <div className="mt-1 font-display text-2xl font-bold">
              {data.totalBattles.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="py-6">
            <div className="mb-4 text-sm font-medium text-muted-foreground">
              Battles per Day (Last 30 Days)
            </div>
            {data.battlesPerDay.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                No battles yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.battlesPerDay}>
                  <defs>
                    <linearGradient
                      id="arenaGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#ef4444"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="100%"
                        stopColor="#ef4444"
                        stopOpacity={0}
                      />
                    </linearGradient>
                    <linearGradient
                      id="friendlyGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#22c55e"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="100%"
                        stopColor="#22c55e"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis
                    dataKey="date"
                    tick={AXIS_TICK}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis tick={AXIS_TICK} allowDecimals={false} />
                  <Tooltip {...CHART_TOOLTIP_STYLE} />
                  <Area
                    type="monotone"
                    dataKey="arena"
                    stroke="#ef4444"
                    fill="url(#arenaGrad)"
                    strokeWidth={2}
                    name="Arena"
                  />
                  <Area
                    type="monotone"
                    dataKey="friendly"
                    stroke="#22c55e"
                    fill="url(#friendlyGrad)"
                    strokeWidth={2}
                    name="Friendly"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-6">
            <div className="mb-4 text-sm font-medium text-muted-foreground">
              Rating Distribution
            </div>
            {data.ratingDistribution.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                No rated players yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.ratingDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis dataKey="bucket" tick={AXIS_TICK} />
                  <YAxis tick={AXIS_TICK} allowDecimals={false} />
                  <Tooltip {...CHART_TOOLTIP_STYLE} />
                  <Bar
                    dataKey="count"
                    name="Players"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
