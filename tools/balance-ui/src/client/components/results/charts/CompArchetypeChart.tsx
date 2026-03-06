import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { TOOLTIP_CONTENT_STYLE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE } from '../constants'

export function CompArchetypeChart({
  compShares,
  compWinRates,
}: {
  compShares: Record<string, number>
  compWinRates?: Record<string, number>
}) {
  const data = Object.entries(compShares)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([comp, share]) => ({
      comp,
      presence: Math.round(share * 1000) / 10,
      winRate: Math.round((compWinRates?.[comp] ?? 0.5) * 1000) / 10,
    }))

  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 4%)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
          tickFormatter={(v: number) => `${v}%`}
          domain={[0, 'auto']}
        />
        <YAxis
          type="category"
          dataKey="comp"
          tick={{ fontSize: 10, fill: 'oklch(0.8 0.03 290)' }}
          width={240}
        />
        <RechartsTooltip
          formatter={((value: any, name: string) => [
            `${value}%`,
            name === 'presence' ? 'Presence' : 'Win Rate',
          ]) as any}
          contentStyle={TOOLTIP_CONTENT_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
        />
        <Legend
          verticalAlign="top"
          height={24}
          wrapperStyle={{ fontSize: 11 }}
          formatter={(value: string) => (value === 'presence' ? 'Presence' : 'Win Rate')}
        />
        <ReferenceLine x={50} stroke="oklch(1 0 0 / 15%)" strokeDasharray="4 4" />
        <Bar dataKey="presence" fill="oklch(0.6 0.1 290)" radius={[0, 3, 3, 0]} barSize={10} opacity={0.5} />
        <Bar dataKey="winRate" fill="oklch(0.65 0.15 145)" radius={[0, 3, 3, 0]} barSize={10} />
      </BarChart>
    </ResponsiveContainer>
  )
}
