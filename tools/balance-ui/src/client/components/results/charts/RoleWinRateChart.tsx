import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Tooltip as RechartsTooltip,
  ReferenceLine,
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

export function RoleWinRateChart({
  roleShares,
  roleWinRates,
}: {
  roleShares: Record<string, number>
  roleWinRates: Record<string, number>
}) {
  const data = Object.keys(roleShares)
    .sort((a, b) => a.localeCompare(b))
    .map((role) => ({
      role,
      presence: Math.round((roleShares[role] ?? 0) * 1000) / 10,
      winRate: Math.round((roleWinRates[role] ?? 0.5) * 1000) / 10,
      fill: ROLE_COLOR_VALUES[role] ?? 'oklch(0.5 0 0)',
    }))

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 20, bottom: 5, left: 60 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="oklch(1 0 0 / 4%)"
          horizontal={false}
        />
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
          tickFormatter={(v: number) => `${v}%`}
          domain={[0, 100]}
        />
        <YAxis
          type="category"
          dataKey="role"
          tick={{ fontSize: 11, fill: 'oklch(0.8 0.03 290)' }}
          width={55}
        />
        <RechartsTooltip
          formatter={
            ((value: any, name: string) => [
              `${value}%`,
              name === 'presence' ? 'Presence' : 'Win Rate',
            ]) as any
          }
          contentStyle={TOOLTIP_CONTENT_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
        />
        <Legend
          verticalAlign="top"
          height={24}
          wrapperStyle={{ fontSize: 11 }}
          formatter={(value: string) =>
            value === 'presence' ? 'Presence' : 'Win Rate'
          }
        />
        <ReferenceLine
          x={50}
          stroke="oklch(1 0 0 / 15%)"
          strokeDasharray="4 4"
        />
        <Bar
          dataKey="presence"
          fill="oklch(0.6 0.1 290)"
          radius={[0, 3, 3, 0]}
          barSize={10}
          opacity={0.5}
        />
        <Bar dataKey="winRate" radius={[0, 3, 3, 0]} barSize={10}>
          {data.map((entry) => (
            <Cell key={entry.role} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
