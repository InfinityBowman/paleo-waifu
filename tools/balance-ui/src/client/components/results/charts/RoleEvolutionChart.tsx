import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { ROLE_COLOR_VALUES, ROLE_ORDER, TOOLTIP_CONTENT_STYLE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE } from '../constants'
import type { GenerationSnapshot } from '../../../../shared/types.ts'

export function RoleEvolutionChart({
  snapshots,
}: {
  snapshots: Array<GenerationSnapshot>
}) {
  const data = snapshots.map((s) => {
    const total = Object.values(s.roleDistribution).reduce((a, b) => a + b, 0)
    const row: Record<string, number> = { gen: s.generation }
    for (const role of ROLE_ORDER) {
      row[role] =
        total > 0
          ? Math.round(((s.roleDistribution[role] ?? 0) / total) * 1000) / 10
          : 0
    }
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 5, right: 12, bottom: 5, left: 0 }}>
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
          domain={[0, 100]}
          width={40}
        />
        <RechartsTooltip
          formatter={(value, name) => [
            `${value}%`,
            String(name).charAt(0).toUpperCase() + String(name).slice(1),
          ]}
          contentStyle={TOOLTIP_CONTENT_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          labelFormatter={(label) => `Gen ${label}`}
        />
        <Legend
          verticalAlign="top"
          height={28}
          formatter={(value: string) =>
            value.charAt(0).toUpperCase() + value.slice(1)
          }
          wrapperStyle={{ fontSize: 11 }}
        />
        {ROLE_ORDER.map((role) => (
          <Area
            key={role}
            type="monotone"
            dataKey={role}
            stackId="1"
            fill={ROLE_COLOR_VALUES[role] ?? 'oklch(0.5 0 0)'}
            stroke={ROLE_COLOR_VALUES[role] ?? 'oklch(0.5 0 0)'}
            fillOpacity={0.8}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}
