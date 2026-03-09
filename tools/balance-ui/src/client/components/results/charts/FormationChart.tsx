import {
  Cell,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  FORMATION_COLORS,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_ITEM_STYLE,
  entries,
} from '../constants'

export function FormationChart({
  formationShares,
}: {
  formationShares: Record<string, number>
}) {
  const data = entries(formationShares)
    .sort(([, a], [, b]) => b - a)
    .map(([name, share]) => ({
      name,
      value: Math.round(share * 1000) / 10,
    }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={75}
          innerRadius={40}
          paddingAngle={2}
          label={({ name, value }) => `${name ?? ''} ${value}%`}
          labelLine={{ stroke: 'oklch(0.65 0.03 290)' }}
          fontSize={10}
        >
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={FORMATION_COLORS[i % FORMATION_COLORS.length]}
            />
          ))}
        </Pie>
        <RechartsTooltip
          formatter={(value) => [`${value}%`, 'Usage']}
          contentStyle={TOOLTIP_CONTENT_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
