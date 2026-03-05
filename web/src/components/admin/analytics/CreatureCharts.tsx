import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AXIS_TICK,
  CHART_TOOLTIP_STYLE,
  GRID_STROKE,
  RARITY_HEX,
} from './chart-config'
import { Card, CardContent } from '@/components/ui/card'

type CreatureEntry = { name: string; rarity: string; count: number }

function RarityBarChart({
  data,
  valueName,
}: {
  data: Array<CreatureEntry>
  valueName: string
}) {
  if (data.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground">No data yet.</p>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={GRID_STROKE}
          horizontal={false}
        />
        <XAxis type="number" tick={AXIS_TICK} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={AXIS_TICK} width={120} />
        <Tooltip {...CHART_TOOLTIP_STYLE} />
        <Bar dataKey="count" name={valueName} radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={RARITY_HEX[entry.rarity] ?? '#9ca3af'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function CreatureCharts({
  topCreatures,
  leastCreatures,
}: {
  topCreatures: Array<CreatureEntry>
  leastCreatures: Array<CreatureEntry>
}) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-bold">Creature Popularity</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="py-6">
            <div className="mb-4 text-sm font-medium text-muted-foreground">
              Most Pulled
            </div>
            <RarityBarChart data={topCreatures} valueName="Pulls" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <div className="mb-4 text-sm font-medium text-muted-foreground">
              Least Pulled
            </div>
            <RarityBarChart data={leastCreatures} valueName="Pulls" />
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

export function WishlistChart({
  topWishlisted,
}: {
  topWishlisted: Array<CreatureEntry>
}) {
  if (topWishlisted.length === 0) return null

  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-bold">Wishlist Demand</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Most wishlisted creatures
      </p>
      <Card className="mt-4">
        <CardContent className="py-6">
          <RarityBarChart data={topWishlisted} valueName="Wishlists" />
        </CardContent>
      </Card>
    </section>
  )
}
