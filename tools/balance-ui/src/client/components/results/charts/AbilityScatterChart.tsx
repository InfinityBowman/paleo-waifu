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
import type { MetaResult } from '../../../../shared/types.ts'

export function AbilityScatterChart({
  leaderboard,
}: {
  leaderboard: MetaResult['abilityLeaderboard']
}) {
  const maxAppearances = Math.max(...leaderboard.map((a) => a.appearances), 1)

  const data = leaderboard.map((a) => ({
    name: a.name,
    pickRate: Math.round((a.appearances / maxAppearances) * 1000) / 10,
    winRate: Math.round(a.avgFitness * 1000) / 10,
    type: a.abilityType,
  }))

  const actives = data.filter((d) => d.type === 'active')
  const passives = data.filter((d) => d.type !== 'active')

  const avgPickRate = data.length > 0 ? data.reduce((s, d) => s + d.pickRate, 0) / data.length : 50

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 4%)" />
        <XAxis
          type="number"
          dataKey="pickRate"
          name="Pick Rate"
          tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
          tickFormatter={(v: number) => `${v}%`}
          domain={[0, 100]}
          label={{
            value: 'Pick Rate',
            position: 'insideBottom',
            offset: -10,
            fontSize: 10,
            fill: 'oklch(0.5 0.03 290)',
          }}
        />
        <YAxis
          type="number"
          dataKey="winRate"
          name="Win Rate"
          tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
          tickFormatter={(v: number) => `${v}%`}
          domain={[0, 100]}
          label={{
            value: 'Win Rate',
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
            if (!payload[0]) return null
            const d = payload[0].payload as (typeof data)[number]
            return (
              <div className="rounded-lg border border-border/50 bg-card px-3 py-2 text-xs shadow-md">
                <div className="font-medium">{d.name}</div>
                <div className="text-muted-foreground">
                  {d.type} · Pick: {d.pickRate}% · Win: {d.winRate}%
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
        <ReferenceLine x={avgPickRate} stroke="oklch(1 0 0 / 10%)" strokeDasharray="4 4" />
        <ReferenceLine y={50} stroke="oklch(1 0 0 / 10%)" strokeDasharray="4 4" />
        <Scatter
          name="Active"
          data={actives}
          fill="oklch(0.65 0.2 25)"
          opacity={0.8}
        />
        <Scatter
          name="Passive"
          data={passives}
          fill="oklch(0.65 0.15 245)"
          opacity={0.8}
        />
      </ScatterChart>
    </ResponsiveContainer>
  )
}
