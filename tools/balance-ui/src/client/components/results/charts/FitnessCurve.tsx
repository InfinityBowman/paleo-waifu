import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ROLE_COLOR_VALUES,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
} from '../constants'
import type { GenerationSnapshot } from '../../../../shared/types.ts'

export function FitnessCurve({
  snapshots,
}: {
  snapshots: Array<GenerationSnapshot>
}) {
  const data = snapshots.map((s) => ({
    gen: s.generation,
    top: Math.round(s.topFitness * 1000) / 10,
    avg: Math.round(s.avgFitness * 1000) / 10,
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 12, bottom: 5, left: 0 }}>
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
          tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
          tickFormatter={(v: number) => `${v}%`}
          domain={['dataMin - 2', 'dataMax + 2']}
          width={40}
        />
        <RechartsTooltip
          formatter={(value, name) => [
            `${value}%`,
            name === 'top' ? 'Top Fitness' : 'Avg Fitness',
          ]}
          contentStyle={TOOLTIP_CONTENT_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          labelFormatter={(label) => `Gen ${label}`}
        />
        <Legend
          verticalAlign="top"
          height={28}
          formatter={(value: string) => (value === 'top' ? 'Top' : 'Avg')}
          wrapperStyle={{ fontSize: 11 }}
        />
        <Line
          type="monotone"
          dataKey="top"
          stroke={ROLE_COLOR_VALUES.striker}
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="avg"
          stroke={ROLE_COLOR_VALUES.support}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
