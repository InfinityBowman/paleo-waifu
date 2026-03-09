import { useMemo } from 'react'
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
  ROLE_ORDER,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
} from '../constants'

export function RoleHpCurvesChart({
  roleHpCurves,
}: {
  roleHpCurves: Record<string, { wins: Array<number>; losses: Array<number> }>
}) {
  const data = useMemo(() => {
    let maxTurns = 0
    for (const curves of Object.values(roleHpCurves)) {
      maxTurns = Math.max(maxTurns, curves.wins.length, curves.losses.length)
    }

    const rows: Array<Record<string, number>> = []
    for (let t = 0; t < maxTurns; t++) {
      const row: Record<string, number> = { turn: t + 1 }
      for (const [role, curves] of Object.entries(roleHpCurves)) {
        if (t < curves.wins.length) {
          row[`${role}_win`] = Math.round(curves.wins[t] * 1000) / 10
        }
        if (t < curves.losses.length) {
          row[`${role}_loss`] = Math.round(curves.losses[t] * 1000) / 10
        }
      }
      rows.push(row)
    }
    return rows
  }, [roleHpCurves])

  const roles = Object.keys(roleHpCurves).sort(
    (a, b) =>
      (ROLE_ORDER.indexOf(a) === -1 ? 99 : ROLE_ORDER.indexOf(a)) -
      (ROLE_ORDER.indexOf(b) === -1 ? 99 : ROLE_ORDER.indexOf(b)),
  )

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 12, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 4%)" />
        <XAxis
          dataKey="turn"
          tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
          label={{
            value: 'Turn',
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
          formatter={(value, name) => {
            const parts = String(name).split('_')
            const role = parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
            const outcome = parts[1] === 'win' ? 'Win' : 'Loss'
            return [`${value}%`, `${role} (${outcome})`]
          }}
          contentStyle={TOOLTIP_CONTENT_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          labelFormatter={(label) => `Turn ${label}`}
        />
        <Legend
          verticalAlign="top"
          height={36}
          formatter={(value: string) => {
            const parts = value.split('_')
            const role = parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
            const outcome = parts[1] === 'win' ? 'W' : 'L'
            return `${role} ${outcome}`
          }}
          wrapperStyle={{ fontSize: 10 }}
        />
        {roles.map((role) => (
          <Line
            key={`${role}_win`}
            type="monotone"
            dataKey={`${role}_win`}
            stroke={ROLE_COLOR_VALUES[role] ?? 'oklch(0.5 0 0)'}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
        {roles.map((role) => (
          <Line
            key={`${role}_loss`}
            type="monotone"
            dataKey={`${role}_loss`}
            stroke={ROLE_COLOR_VALUES[role] ?? 'oklch(0.5 0 0)'}
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            opacity={0.6}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
