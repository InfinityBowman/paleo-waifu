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
import type { MetaResult } from '../../../../shared/types.ts'

export function CreatureScatterChart({
  leaderboard,
}: {
  leaderboard: MetaResult['creatureLeaderboard']
}) {
  const maxAppearances = Math.max(...leaderboard.map((c) => c.appearances), 1)

  const data = leaderboard.map((c) => ({
    name: c.creature.name,
    presence: Math.round((c.appearances / maxAppearances) * 1000) / 10,
    wrDiff: Math.round(c.allTeamWinRate * 1000) / 10,
    role: c.creature.role,
  }))

  const avgPresence = data.length > 0 ? data.reduce((s, d) => s + d.presence, 0) / data.length : 50
  const maxAbs = Math.max(
    ...data.map((d) => Math.abs(d.wrDiff)),
    5,
  )
  const yBound = Math.ceil(maxAbs / 5) * 5

  const byRole = ROLE_ORDER
    .map((role) => ({
      role,
      data: data.filter((d) => d.role === role),
      color: ROLE_COLOR_VALUES[role] ?? 'oklch(0.5 0 0)',
    }))
    .filter((g) => g.data.length > 0)

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 4%)" />
        <XAxis
          type="number"
          dataKey="presence"
          name="Presence"
          tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
          tickFormatter={(v: number) => `${v}%`}
          domain={[0, 100]}
          label={{
            value: 'Presence',
            position: 'insideBottom',
            offset: -10,
            fontSize: 10,
            fill: 'oklch(0.5 0.03 290)',
          }}
        />
        <YAxis
          type="number"
          dataKey="wrDiff"
          name="WR Diff"
          tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
          tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}pp`}
          domain={[-yBound, yBound]}
          label={{
            value: 'WR Differential',
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
                  {d.role} · Presence: {d.presence}% · WR diff: {d.wrDiff > 0 ? '+' : ''}{d.wrDiff}pp
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
        <ReferenceLine x={avgPresence} stroke="oklch(1 0 0 / 10%)" strokeDasharray="4 4" />
        <ReferenceLine y={0} stroke="oklch(1 0 0 / 15%)" strokeDasharray="4 4" />
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
