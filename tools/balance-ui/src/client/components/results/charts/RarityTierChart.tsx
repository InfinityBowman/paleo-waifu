import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import {
  RARITY_COLOR_VALUES,
  RARITY_ORDER,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
} from '../constants'
import type { CreatureFieldStats } from '../../../../shared/types.ts'

interface Props {
  creatures: Array<CreatureFieldStats>
}

export function RarityTierChart({ creatures }: Props) {
  const data = useMemo(() => {
    const byRarity = new Map<
      string,
      { winRates: Array<number>; count: number }
    >()
    for (const c of creatures) {
      const entry = byRarity.get(c.rarity) ?? { winRates: [], count: 0 }
      entry.winRates.push(c.winRate)
      entry.count++
      byRarity.set(c.rarity, entry)
    }

    return RARITY_ORDER
      .filter((r) => byRarity.has(r))
      .map((rarity) => {
        const { winRates, count } = byRarity.get(rarity)!
        const sorted = [...winRates].sort((a, b) => a - b)
        const median =
          sorted.length % 2 === 0
            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : sorted[Math.floor(sorted.length / 2)]
        const min = sorted[0]
        const max = sorted[sorted.length - 1]
        const q1 = sorted[Math.floor(sorted.length * 0.25)]
        const q3 = sorted[Math.floor(sorted.length * 0.75)]
        const avg =
          winRates.reduce((sum, v) => sum + v, 0) / winRates.length
        return { rarity, count, median, min, max, q1, q3, avg }
      })
  }, [creatures])

  return (
    <>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 12, bottom: 5, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="oklch(1 0 0 / 4%)"
            vertical={false}
          />
          <XAxis
            dataKey="rarity"
            tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
            tickFormatter={(v: string) =>
              v.charAt(0).toUpperCase() + v.slice(1)
            }
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            domain={[
              (min: number) => Math.max(0, min - 0.05),
              (max: number) => Math.min(1, max + 0.05),
            ]}
            width={40}
          />
          <RechartsTooltip
            contentStyle={TOOLTIP_CONTENT_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            formatter={((value: number, name: string) => [
              `${(value * 100).toFixed(1)}%`,
              name === 'avg' ? 'Average' : name === 'median' ? 'Median' : name,
            ]) as any}
            labelFormatter={((label: string) =>
              `${label.charAt(0).toUpperCase() + label.slice(1)}`) as any}
          />
          <ReferenceLine
            y={0.5}
            stroke="oklch(1 0 0 / 15%)"
            strokeDasharray="4 4"
          />
          <Bar dataKey="avg" radius={[3, 3, 0, 0]} barSize={24}>
            {data.map((d) => (
              <Cell
                key={d.rarity}
                fill={RARITY_COLOR_VALUES[d.rarity] ?? 'oklch(0.5 0 0)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Compact stats table below the chart */}
      <table className="mt-2 w-full text-[10px] text-muted-foreground">
        <thead>
          <tr>
            <th className="text-left px-2">Rarity</th>
            <th className="text-right px-2">Count</th>
            <th className="text-right px-2">Min</th>
            <th className="text-right px-2">Q1</th>
            <th className="text-right px-2">Median</th>
            <th className="text-right px-2">Q3</th>
            <th className="text-right px-2">Max</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.rarity}>
              <td
                className="px-2 capitalize font-medium"
                style={{ color: RARITY_COLOR_VALUES[d.rarity] }}
              >
                {d.rarity}
              </td>
              <td className="text-right px-2">{d.count}</td>
              <td className="text-right px-2 font-mono">
                {(d.min * 100).toFixed(1)}%
              </td>
              <td className="text-right px-2 font-mono">
                {(d.q1 * 100).toFixed(1)}%
              </td>
              <td className="text-right px-2 font-mono font-semibold text-foreground">
                {(d.median * 100).toFixed(1)}%
              </td>
              <td className="text-right px-2 font-mono">
                {(d.q3 * 100).toFixed(1)}%
              </td>
              <td className="text-right px-2 font-mono">
                {(d.max * 100).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
