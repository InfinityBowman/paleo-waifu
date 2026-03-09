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
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
} from '../constants'

interface Props {
  creatures: Array<{ winRate: number }>
}

export function WinRateDistributionChart({ creatures }: Props) {
  const buckets = useMemo(() => {
    const bins = Array.from({ length: 20 }, (_, i) => ({
      label: `${i * 5}%`,
      min: i * 0.05,
      max: (i + 1) * 0.05,
      count: 0,
    }))
    for (const c of creatures) {
      const idx = Math.min(Math.floor(c.winRate * 20), 19)
      bins[idx].count++
    }
    return bins
  }, [creatures])

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart
        data={buckets}
        margin={{ top: 5, right: 12, bottom: 5, left: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="oklch(1 0 0 / 4%)"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 9, fill: 'oklch(0.65 0.03 290)' }}
          interval={3}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
          width={30}
          allowDecimals={false}
        />
        <RechartsTooltip
          contentStyle={TOOLTIP_CONTENT_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          formatter={
            ((value: number) => [`${value} creatures`, 'Count']) as any
          }
        />
        <ReferenceLine
          x="45%"
          stroke="oklch(0.65 0.15 145 / 40%)"
          strokeDasharray="4 4"
          label={{
            value: '45%',
            position: 'top',
            fontSize: 9,
            fill: 'oklch(0.65 0.15 145)',
          }}
        />
        <ReferenceLine
          x="55%"
          stroke="oklch(0.65 0.15 145 / 40%)"
          strokeDasharray="4 4"
          label={{
            value: '55%',
            position: 'top',
            fontSize: 9,
            fill: 'oklch(0.65 0.15 145)',
          }}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {buckets.map((b, i) => (
            <Cell
              key={i}
              fill={
                b.min >= 0.45 && b.max <= 0.55
                  ? 'oklch(0.65 0.15 145)' // green - healthy range
                  : b.min >= 0.4 && b.max <= 0.6
                    ? 'oklch(0.75 0.15 75)' // amber - borderline
                    : 'oklch(0.65 0.2 25)' // red - outlier range
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
