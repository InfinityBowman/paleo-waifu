import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { ROLE_COLOR_VALUES, TOOLTIP_CONTENT_STYLE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE, entries } from '../constants'

export function RoleMetaChart({ roleShares }: { roleShares: Record<string, number> }) {
  const data = entries(roleShares)
    .sort(([, a], [, b]) => b - a)
    .map(([role, share]) => ({
      role: role.charAt(0).toUpperCase() + role.slice(1),
      share: Math.round(share * 1000) / 10,
      fill: ROLE_COLOR_VALUES[role] ?? 'oklch(0.5 0 0)',
    }))

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="oklch(1 0 0 / 4%)"
          horizontal={false}
        />
        <XAxis
          type="number"
          domain={[0, 50]}
          tickFormatter={(v: number) => `${v}%`}
          tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
        />
        <YAxis
          type="category"
          dataKey="role"
          width={60}
          tick={{ fontSize: 11, fill: 'oklch(0.65 0.03 290)' }}
        />
        <RechartsTooltip
          formatter={(value) => [`${value}%`, 'Meta Share']}
          contentStyle={TOOLTIP_CONTENT_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
        />
        <Bar dataKey="share" radius={[0, 4, 4, 0]} barSize={20}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
