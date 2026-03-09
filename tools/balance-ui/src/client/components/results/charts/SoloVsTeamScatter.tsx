import {
  CartesianGrid,
  Legend,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { ROLE_COLOR_VALUES, ROLE_ORDER } from '../constants'
import type { CreatureTeamStats } from '../../../../shared/types.ts'

export function SoloVsTeamScatter({
  creatures,
}: {
  creatures: Array<CreatureTeamStats>
}) {
  const data = creatures
    .filter((c) => c.teamTotal > 0)
    .map((c) => ({
      name: c.name,
      solo: Math.round(c.soloWinRate * 1000) / 10,
      team: Math.round(c.teamWinRate * 1000) / 10,
      delta: Math.round(c.teamDelta * 1000) / 10,
      role: c.role,
    }))

  const allWr = [...data.map((d) => d.solo), ...data.map((d) => d.team)]
  const min = Math.floor(Math.min(...allWr, 40) / 5) * 5
  const max = Math.ceil(Math.max(...allWr, 60) / 5) * 5

  const byRole = ROLE_ORDER.map((role) => ({
    role,
    data: data.filter((d) => d.role === role),
    color: ROLE_COLOR_VALUES[role] ?? 'oklch(0.5 0 0)',
  })).filter((g) => g.data.length > 0)

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 4%)" />
        <XAxis
          type="number"
          dataKey="solo"
          name="Solo WR"
          tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
          tickFormatter={(v: number) => `${v}%`}
          domain={[min, max]}
          label={{
            value: '1v1 Solo Win Rate',
            position: 'insideBottom',
            offset: -10,
            fontSize: 10,
            fill: 'oklch(0.5 0.03 290)',
          }}
        />
        <YAxis
          type="number"
          dataKey="team"
          name="Team WR"
          tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
          tickFormatter={(v: number) => `${v}%`}
          domain={[min, max]}
          label={{
            value: '3v3 Team Win Rate',
            angle: -90,
            position: 'insideLeft',
            offset: 10,
            fontSize: 10,
            fill: 'oklch(0.5 0.03 290)',
          }}
        />
        <ZAxis range={[40, 40]} />
        <RechartsTooltip
          content={({ payload }) => {
            if (!payload?.[0]) return null // eslint-disable-line @typescript-eslint/no-unnecessary-condition
            const d = payload[0].payload as (typeof data)[number]
            return (
              <div className="rounded-lg border border-border/50 bg-card px-3 py-2 text-xs shadow-md">
                <div className="font-medium">{d.name}</div>
                <div className="text-muted-foreground">
                  {d.role} · Solo: {d.solo}% · Team: {d.team}% · Δ:{' '}
                  {d.delta > 0 ? '+' : ''}
                  {d.delta}pp
                </div>
              </div>
            )
          }}
        />
        <Legend
          verticalAlign="top"
          height={24}
          wrapperStyle={{ fontSize: 11 }}
        />
        {/* Diagonal = "no team effect" line */}
        <ReferenceLine
          segment={[
            { x: min, y: min },
            { x: max, y: max },
          ]}
          stroke="oklch(1 0 0 / 12%)"
          strokeDasharray="4 4"
        />
        <ReferenceLine
          x={50}
          stroke="oklch(1 0 0 / 8%)"
          strokeDasharray="2 4"
        />
        <ReferenceLine
          y={50}
          stroke="oklch(1 0 0 / 8%)"
          strokeDasharray="2 4"
        />
        {byRole.map((group) => (
          <Scatter
            key={group.role}
            name={group.role}
            data={group.data}
            fill={group.color}
            opacity={0.8}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  )
}
