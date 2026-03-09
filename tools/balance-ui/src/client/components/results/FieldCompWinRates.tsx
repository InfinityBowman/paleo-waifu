import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { SectionTooltip } from './SectionTooltip'
import {
  ROLE_COLOR_VALUES,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_ITEM_STYLE,
} from './constants'

interface Props {
  compWinRates: Record<string, { winRate: number; count: number }>
}

export function FieldCompWinRates({ compWinRates }: Props) {
  const data = useMemo(() => {
    return Object.entries(compWinRates)
      .map(([comp, { winRate, count }]) => ({ comp, winRate, count }))
      .sort((a, b) => b.winRate - a.winRate)
  }, [compWinRates])

  if (data.length === 0) return null

  // Derive a color from the first role in the comp string
  const getBarColor = (comp: string) => {
    const firstRole = comp.split(' / ')[0].replace(/×\d+/, '').trim()
    return ROLE_COLOR_VALUES[firstRole] ?? 'oklch(0.65 0.1 290)'
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle>Team Composition Win Rates</CardTitle>
          <SectionTooltip>
            Win rates by role composition (e.g. striker×2 / tank×1). Shows which
            team archetypes perform best in random matchups. Higher sample counts
            are more reliable.
          </SectionTooltip>
        </div>
        <CardDescription>
          {data.length} compositions from team round-robin
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(data.length * 28, 120)}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
          >
            <XAxis
              type="number"
              domain={[0, 'auto']}
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              tick={{ fill: 'oklch(0.55 0.02 290)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="comp"
              width={150}
              tick={{ fill: 'oklch(0.8 0.02 290)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <RechartsTooltip
              contentStyle={TOOLTIP_CONTENT_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              formatter={((value: number, _: string, entry: { payload: { count: number } }) =>
                [`${(value * 100).toFixed(1)}% (${entry.payload.count} teams)`, 'Win Rate']
              ) as any}
            />
            <ReferenceLine x={0.5} stroke="oklch(1 0 0 / 0.15)" strokeDasharray="3 3" />
            <Bar dataKey="winRate" radius={[0, 3, 3, 0]} maxBarSize={20}>
              {data.map((d) => (
                <Cell key={d.comp} fill={getBarColor(d.comp)} fillOpacity={0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
