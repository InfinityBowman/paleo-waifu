import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  Tooltip as RechartsTooltip,
  ReferenceArea,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AVG_TURNS_TARGET_MAX,
  AVG_TURNS_TARGET_MIN,
  ROLE_COLOR_VALUES,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
} from '../constants'
import type { GenerationSnapshot } from '../../../../shared/types.ts'

export function MetricsChart({
  snapshots,
  population,
  totalCreatures,
}: {
  snapshots: Array<GenerationSnapshot>
  population: number
  totalCreatures: number
}) {
  const data = snapshots.map((s) => ({
    gen: s.generation,
    avgTurns: Math.round(s.avgTurns * 10) / 10,
    turnSpread: [
      Math.round(s.turnP10 * 10) / 10,
      Math.round(s.turnP90 * 10) / 10,
    ] as [number, number],
    diversity: Math.min(
      100,
      Math.round((s.uniqueGenomes / population) * 1000) / 10,
    ),
    metaBreadth:
      totalCreatures > 0
        ? Math.round(
            (Object.keys(s.creatureFrequency).length / totalCreatures) * 1000,
          ) / 10
        : 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart
        data={data}
        margin={{ top: 5, right: 12, bottom: 5, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 4%)" />
        <XAxis
          dataKey="gen"
          tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
          label={{
            value: 'Generation',
            position: 'insideBottom',
            offset: -2,
            fontSize: 10,
            fill: 'oklch(0.65 0.03 290)',
          }}
        />
        <YAxis
          yAxisId="turns"
          tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
          width={40}
          label={{
            value: 'Turns',
            angle: -90,
            position: 'insideLeft',
            fontSize: 10,
            fill: 'oklch(0.65 0.03 290)',
          }}
        />
        <YAxis
          yAxisId="diversity"
          orientation="right"
          tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
          tickFormatter={(v: number) => `${v}%`}
          domain={[0, 100]}
          width={40}
        />
        <RechartsTooltip
          formatter={(value, name) => {
            if (name === 'target') return [null, null]
            if (name === 'turnSpread') {
              const [p10, p90] = value as [number, number]
              return [`${p10}–${p90} turns`, 'P10–P90']
            }
            return [
              name === 'avgTurns' ? `${value} turns` : `${value}%`,
              name === 'avgTurns'
                ? 'Avg Turns'
                : name === 'metaBreadth'
                  ? 'Meta Breadth'
                  : 'Diversity',
            ]
          }}
          contentStyle={TOOLTIP_CONTENT_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          labelFormatter={(label) => `Gen ${label}`}
        />
        <Legend
          verticalAlign="top"
          height={28}
          formatter={(value: string) =>
            value === 'avgTurns'
              ? 'Avg Turns'
              : value === 'turnSpread'
                ? 'P10–P90'
                : value === 'target'
                  ? 'Target'
                  : value === 'metaBreadth'
                    ? 'Meta Breadth'
                    : 'Diversity'
          }
          wrapperStyle={{ fontSize: 11 }}
        />
        <Area
          yAxisId="turns"
          type="monotone"
          dataKey="turnSpread"
          fill={ROLE_COLOR_VALUES.bruiser}
          fillOpacity={0.06}
          stroke={ROLE_COLOR_VALUES.bruiser}
          strokeWidth={1}
          strokeDasharray="4 3"
          strokeOpacity={0.2}
          dot={false}
          activeDot={false}
        />
        <ReferenceArea
          yAxisId="turns"
          y1={AVG_TURNS_TARGET_MIN}
          y2={AVG_TURNS_TARGET_MAX}
          fill="oklch(0.65 0.15 145 / 14%)"
          strokeDasharray="4 4"
          stroke="oklch(0.65 0.15 145 / 40%)"
        />
        <Line
          yAxisId="turns"
          type="monotone"
          dataKey="target"
          stroke="oklch(0.65 0.15 145)"
          strokeDasharray="4 4"
          strokeWidth={2}
          dot={false}
          legendType="plainline"
        />
        <Line
          yAxisId="turns"
          type="monotone"
          dataKey="avgTurns"
          stroke={ROLE_COLOR_VALUES.bruiser}
          strokeWidth={2}
          dot={false}
        />
        <Line
          yAxisId="diversity"
          type="monotone"
          dataKey="diversity"
          stroke={ROLE_COLOR_VALUES.tank}
          strokeWidth={2}
          dot={false}
          opacity={0.7}
        />
        <Line
          yAxisId="diversity"
          type="monotone"
          dataKey="metaBreadth"
          stroke={ROLE_COLOR_VALUES.striker}
          strokeWidth={2}
          dot={false}
          opacity={0.7}
          strokeDasharray="4 3"
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
