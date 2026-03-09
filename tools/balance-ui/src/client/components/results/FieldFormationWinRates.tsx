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
  FORMATION_COLORS,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_ITEM_STYLE,
} from './constants'

interface Props {
  formationWinRates: Record<string, { winRate: number; count: number }>
}

export function FieldFormationWinRates({ formationWinRates }: Props) {
  const data = useMemo(() => {
    return Object.entries(formationWinRates)
      .map(([formation, { winRate, count }]) => ({ formation, winRate, count }))
      .sort((a, b) => b.winRate - a.winRate)
  }, [formationWinRates])

  if (data.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle>Formation Win Rates</CardTitle>
          <SectionTooltip>
            Win rates by front/back row split (e.g. 2F/1B = 2 front, 1 back).
            Shows whether aggressive or defensive formations perform better.
          </SectionTooltip>
        </div>
        <CardDescription>
          {data.length} formations from team round-robin
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer
          width="100%"
          height={Math.max(data.length * 36, 80)}
        >
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
          >
            <XAxis
              type="number"
              domain={[0.4, 0.6]}
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              tick={{ fill: 'oklch(0.55 0.02 290)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="formation"
              width={60}
              tick={{ fill: 'oklch(0.8 0.02 290)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <RechartsTooltip
              contentStyle={TOOLTIP_CONTENT_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              formatter={
                ((
                  value: number,
                  _: string,
                  entry: { payload: { count: number } },
                ) => [
                  `${(value * 100).toFixed(1)}% (${entry.payload.count} teams)`,
                  'Win Rate',
                ]) as any
              }
            />
            <ReferenceLine
              x={0.5}
              stroke="oklch(1 0 0 / 0.15)"
              strokeDasharray="3 3"
            />
            <Bar dataKey="winRate" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {data.map((d, i) => (
                <Cell
                  key={d.formation}
                  fill={FORMATION_COLORS[i % FORMATION_COLORS.length]}
                  fillOpacity={0.7}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
