import {
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

const FOSSIL_BUCKET_ORDER = [
  '0',
  '1-10',
  '11-50',
  '51-100',
  '101-500',
  '501-1k',
  '1k+',
]

function SimpleBarChart({
  data,
  dataKey,
  xKey,
  name,
  fill,
  height = 200,
  xLabel,
  yLabel,
}: {
  data: Array<Record<string, string | number>>
  dataKey: string
  xKey: string
  name: string
  fill: string
  height?: number
  xLabel?: string
  yLabel?: string
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis
          dataKey={xKey}
          tick={AXIS_TICK}
          label={
            xLabel
              ? {
                  value: xLabel,
                  position: 'insideBottom',
                  offset: -5,
                  style: { fontSize: 12, fill: 'oklch(0.55 0.03 290)' },
                }
              : undefined
          }
        />
        <YAxis
          tick={AXIS_TICK}
          allowDecimals={false}
          label={
            yLabel
              ? {
                  value: yLabel,
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: 12, fill: 'oklch(0.55 0.03 290)' },
                }
              : undefined
          }
        />
        <Tooltip {...CHART_TOOLTIP_STYLE} />
        <Bar dataKey={dataKey} name={name} fill={fill} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function EconomySection({
  totalFossils,
  avgFossils,
  totalCreatures,
  fossilDistribution,
  levelDistribution,
}: {
  totalFossils: number
  avgFossils: number
  totalCreatures: number
  fossilDistribution: Array<{ bucket: string; count: number }>
  levelDistribution: Array<{ level: number; count: number }>
}) {
  const sortedFossilDist = [...fossilDistribution].sort(
    (a, b) =>
      FOSSIL_BUCKET_ORDER.indexOf(a.bucket) -
      FOSSIL_BUCKET_ORDER.indexOf(b.bucket),
  )

  return (
    <>
      <section className="mt-8">
        <h2 className="font-display text-xl font-bold">Fossil Economy</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Card size="sm">
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Total in Circulation
              </div>
              <div className="mt-1 font-display text-2xl font-bold">
                {totalFossils.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Average per User
              </div>
              <div className="mt-1 font-display text-2xl font-bold">
                {avgFossils}
              </div>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Creatures in Database
              </div>
              <div className="mt-1 font-display text-2xl font-bold">
                {totalCreatures}
              </div>
            </CardContent>
          </Card>
        </div>

        {sortedFossilDist.length > 0 && (
          <Card className="mt-4">
            <CardContent className="py-6">
              <div className="mb-4 text-sm font-medium text-muted-foreground">
                Wealth Distribution (Fossil Balances)
              </div>
              <SimpleBarChart
                data={sortedFossilDist}
                dataKey="count"
                xKey="bucket"
                name="Users"
                fill="#f59e0b"
              />
            </CardContent>
          </Card>
        )}
      </section>

      {levelDistribution.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold">
            Player Progression
          </h2>
          <Card className="mt-4">
            <CardContent className="py-6">
              <div className="mb-4 text-sm font-medium text-muted-foreground">
                Level Distribution
              </div>
              <SimpleBarChart
                data={levelDistribution}
                dataKey="count"
                xKey="level"
                name="Players"
                fill="#22c55e"
                xLabel="Level"
                yLabel="Players"
              />
            </CardContent>
          </Card>
        </section>
      )}
    </>
  )
}
