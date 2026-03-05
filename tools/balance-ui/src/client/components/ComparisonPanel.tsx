import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Info } from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '../lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import type { SavedRun } from '../../shared/types.ts'

const ROLE_ORDER = ['striker', 'tank', 'support', 'bruiser']

const RUN_COLORS = [
  'oklch(0.65 0.2 25)',
  'oklch(0.65 0.15 245)',
  'oklch(0.65 0.15 145)',
  'oklch(0.75 0.15 75)',
]

const RUN_COLOR_CLASSES = [
  'bg-role-striker',
  'bg-role-tank',
  'bg-role-support',
  'bg-role-bruiser',
]

const AVG_TURNS_TARGET_MIN = 7
const AVG_TURNS_TARGET_MAX = 10

const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'oklch(0.15 0.025 290)',
    border: '1px solid oklch(1 0 0 / 8%)',
    borderRadius: 8,
    fontSize: 12,
  },
  itemStyle: { color: 'oklch(0.9 0.02 290)' },
  labelStyle: { color: 'oklch(0.9 0.02 290)' },
}

const TICK_STYLE = { fontSize: 10, fill: 'oklch(0.55 0.03 290)' }

interface Props {
  runIds: Array<string>
  getRun: (id: string) => Promise<SavedRun | undefined>
}

export function ComparisonPanel({ runIds, getRun }: Props) {
  const [runs, setRuns] = useState<Array<SavedRun>>([])
  const [loading, setLoading] = useState(true)
  const [configDiffOpen, setConfigDiffOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all(runIds.map((id) => getRun(id))).then((results) => {
      if (cancelled) return
      setRuns(results.filter((r): r is SavedRun => r !== undefined))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [runIds, getRun])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (runs.length < 2) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select at least 2 runs from the History tab to compare
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Run Legend */}
      <div className="flex flex-wrap gap-2">
        {runs.map((run, i) => (
          <div
            key={run.id}
            className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-1.5"
          >
            <div
              className={cn('h-2.5 w-2.5 rounded-full', RUN_COLOR_CLASSES[i % RUN_COLOR_CLASSES.length])}
            />
            <span className="text-xs font-medium">{run.label}</span>
            <span className="text-[10px] text-muted-foreground">
              {new Date(run.createdAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        ))}
      </div>

      {/* Fitness Overlay */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle>Fitness Progression</CardTitle>
            <SectionTooltip>
              Overlaid fitness curves from all selected runs. Solid lines are top fitness, dashed lines are average.
            </SectionTooltip>
          </div>
          <CardDescription>Top (solid) and average (dashed) fitness</CardDescription>
        </CardHeader>
        <CardContent>
          <FitnessOverlay runs={runs} />
        </CardContent>
      </Card>

      {/* Turns + Diversity Overlay */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle>Battle Health</CardTitle>
            <SectionTooltip>
              Average turns per battle (solid) and population diversity (dashed) overlaid across runs. Green band shows the healthy 7-10 turns target.
            </SectionTooltip>
          </div>
          <CardDescription>Avg turns (solid) and diversity (dashed)</CardDescription>
        </CardHeader>
        <CardContent>
          <TurnsDiversityOverlay runs={runs} />
        </CardContent>
      </Card>

      {/* Role Meta Share Delta */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle>Role Meta Share</CardTitle>
            <SectionTooltip>
              Final role distribution for each run. Delta columns show change relative to the first selected run.
            </SectionTooltip>
          </div>
        </CardHeader>
        <CardContent>
          <RoleDeltaTable runs={runs} />
        </CardContent>
      </Card>

      {/* Creature Leaderboard Delta */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle>Creature Leaderboard</CardTitle>
            <SectionTooltip>
              Top 15 creatures by appearances across runs. Rank changes shown relative to the first run.
            </SectionTooltip>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <CreatureDelta runs={runs} />
        </CardContent>
      </Card>

      {/* Config Diff */}
      <Card>
        <button
          onClick={() => setConfigDiffOpen((v) => !v)}
          className="flex w-full items-center gap-1.5 px-4 py-3 text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {configDiffOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Config Differences
        </button>
        {configDiffOpen && (
          <CardContent className="pt-0">
            <ConfigDiff runs={runs} />
          </CardContent>
        )}
      </Card>
    </div>
  )
}

function SectionTooltip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info size={13} className="cursor-help text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{children}</TooltipContent>
    </Tooltip>
  )
}

// ─── Charts ──────────────────────────────────────────────────

function FitnessOverlay({ runs }: { runs: Array<SavedRun> }) {
  // Build merged data from all runs' snapshots
  const allGens = new Set<number>()
  for (const run of runs) {
    for (const snap of run.result.snapshots) {
      allGens.add(snap.generation)
    }
  }

  const data = [...allGens].sort((a, b) => a - b).map((gen) => {
    const row: Record<string, number> = { gen }
    for (const [i, run] of runs.entries()) {
      const snap = run.result.snapshots.find((s) => s.generation === gen)
      if (snap) {
        row[`top_${i}`] = Math.round(snap.topFitness * 1000) / 10
        row[`avg_${i}`] = Math.round(snap.avgFitness * 1000) / 10
      }
    }
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 5, right: 12, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 4%)" />
        <XAxis dataKey="gen" tick={TICK_STYLE} label={{ value: 'Generation', position: 'insideBottom', offset: -2, ...TICK_STYLE }} />
        <YAxis tick={TICK_STYLE} tickFormatter={(v: number) => `${v}%`} domain={['dataMin - 2', 'dataMax + 2']} width={40} />
        <RechartsTooltip
          {...TOOLTIP_STYLE}
          labelFormatter={(label) => `Gen ${label}`}
          formatter={(value, name) => {
            const s = String(name)
            const idx = parseInt(s.split('_')[1], 10)
            const type = s.startsWith('top') ? 'Top' : 'Avg'
            return [`${value}%`, `${runs[idx]?.label ?? ''} (${type})`]
          }}
        />
        <Legend
          verticalAlign="top"
          height={28}
          wrapperStyle={{ fontSize: 10 }}
          formatter={(value: string) => {
            const idx = parseInt(value.split('_')[1], 10)
            const type = value.startsWith('top') ? 'Top' : 'Avg'
            return `${runs[idx]?.label ?? ''} (${type})`
          }}
        />
        {runs.map((_, i) => (
          <Line
            key={`top_${i}`}
            type="monotone"
            dataKey={`top_${i}`}
            stroke={RUN_COLORS[i % RUN_COLORS.length]}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
        {runs.map((_, i) => (
          <Line
            key={`avg_${i}`}
            type="monotone"
            dataKey={`avg_${i}`}
            stroke={RUN_COLORS[i % RUN_COLORS.length]}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            connectNulls
            opacity={0.6}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function TurnsDiversityOverlay({ runs }: { runs: Array<SavedRun> }) {
  const allGens = new Set<number>()
  for (const run of runs) {
    for (const snap of run.result.snapshots) {
      allGens.add(snap.generation)
    }
  }

  const data = [...allGens].sort((a, b) => a - b).map((gen) => {
    const row: Record<string, number> = { gen }
    for (const [i, run] of runs.entries()) {
      const snap = run.result.snapshots.find((s) => s.generation === gen)
      if (snap) {
        row[`turns_${i}`] = Math.round(snap.avgTurns * 10) / 10
        row[`div_${i}`] = Math.min(
          100,
          Math.round((snap.uniqueGenomes / run.config.options.population) * 1000) / 10,
        )
      }
    }
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 5, right: 12, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 4%)" />
        <XAxis dataKey="gen" tick={TICK_STYLE} label={{ value: 'Generation', position: 'insideBottom', offset: -2, ...TICK_STYLE }} />
        <YAxis
          yAxisId="turns"
          tick={TICK_STYLE}
          width={40}
          label={{ value: 'Turns', angle: -90, position: 'insideLeft', ...TICK_STYLE }}
        />
        <YAxis
          yAxisId="diversity"
          orientation="right"
          tick={TICK_STYLE}
          tickFormatter={(v: number) => `${v}%`}
          domain={[0, 100]}
          width={40}
        />
        <ReferenceArea
          yAxisId="turns"
          y1={AVG_TURNS_TARGET_MIN}
          y2={AVG_TURNS_TARGET_MAX}
          fill="oklch(0.65 0.15 145 / 8%)"
          strokeDasharray="4 4"
          stroke="oklch(0.65 0.15 145 / 25%)"
        />
        <RechartsTooltip
          {...TOOLTIP_STYLE}
          labelFormatter={(label) => `Gen ${label}`}
          formatter={(value, name) => {
            const s = String(name)
            const idx = parseInt(s.split('_')[1], 10)
            const type = s.startsWith('turns') ? 'Turns' : 'Diversity'
            const unit = s.startsWith('turns') ? '' : '%'
            return [`${value}${unit}`, `${runs[idx]?.label ?? ''} (${type})`]
          }}
        />
        <Legend
          verticalAlign="top"
          height={28}
          wrapperStyle={{ fontSize: 10 }}
          formatter={(value: string) => {
            const idx = parseInt(value.split('_')[1], 10)
            const type = value.startsWith('turns') ? 'Turns' : 'Diversity'
            return `${runs[idx]?.label ?? ''} (${type})`
          }}
        />
        {runs.map((_, i) => (
          <Line
            key={`turns_${i}`}
            yAxisId="turns"
            type="monotone"
            dataKey={`turns_${i}`}
            stroke={RUN_COLORS[i % RUN_COLORS.length]}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
        {runs.map((_, i) => (
          <Line
            key={`div_${i}`}
            yAxisId="diversity"
            type="monotone"
            dataKey={`div_${i}`}
            stroke={RUN_COLORS[i % RUN_COLORS.length]}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            connectNulls
            opacity={0.6}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── Tables ──────────────────────────────────────────────────

function RoleDeltaTable({ runs }: { runs: Array<SavedRun> }) {
  const baseline = runs[0].result.result.roleMetaShare

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border">
          <th className="px-3 py-1.5 text-left text-muted-foreground">Role</th>
          {runs.map((run, i) => (
            <th key={run.id} className="px-2 py-1.5 text-right text-muted-foreground">
              <div className="flex items-center justify-end gap-1.5">
                <div className={cn('h-2 w-2 rounded-full', RUN_COLOR_CLASSES[i % RUN_COLOR_CLASSES.length])} />
                <span className="max-w-[80px] truncate">{run.label}</span>
              </div>
            </th>
          ))}
          {runs.length > 1 &&
            runs.slice(1).map((run) => (
              <th key={`delta-${run.id}`} className="px-2 py-1.5 text-right text-muted-foreground">
                Delta
              </th>
            ))}
        </tr>
      </thead>
      <tbody>
        {ROLE_ORDER.map((role) => (
          <tr key={role} className="border-b border-border/20">
            <td className="px-3 py-1.5 capitalize font-medium">{role}</td>
            {runs.map((run) => (
              <td key={run.id} className="px-2 py-1.5 text-right font-mono">
                {((run.result.result.roleMetaShare[role] ?? 0) * 100).toFixed(1)}%
              </td>
            ))}
            {runs.slice(1).map((run) => {
              const delta =
                (run.result.result.roleMetaShare[role] ?? 0) -
                (baseline[role] ?? 0)
              return (
                <td
                  key={`delta-${run.id}`}
                  className={cn(
                    'px-2 py-1.5 text-right font-mono',
                    delta > 0.02 && 'text-success',
                    delta < -0.02 && 'text-destructive',
                  )}
                >
                  {delta > 0 ? '+' : ''}
                  {(delta * 100).toFixed(1)}%
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CreatureDelta({ runs }: { runs: Array<SavedRun> }) {
  // Build rank maps from each run's creature leaderboard
  const rankMaps = runs.map((run) => {
    const map = new Map<string, { rank: number; appearances: number; avgFitness: number }>()
    run.result.result.creatureLeaderboard.forEach((entry, i) => {
      map.set(entry.creature.name, {
        rank: i + 1,
        appearances: entry.appearances,
        avgFitness: entry.avgFitness,
      })
    })
    return map
  })

  // Get union of top 15 creatures from all runs
  const allCreatures = new Set<string>()
  for (const map of rankMaps) {
    let count = 0
    for (const name of map.keys()) {
      if (count >= 15) break
      allCreatures.add(name)
      count++
    }
  }

  // Sort by first run's rank, then by appearance in other runs
  const sorted = [...allCreatures].sort((a, b) => {
    const ra = rankMaps[0].get(a)?.rank ?? 999
    const rb = rankMaps[0].get(b)?.rank ?? 999
    return ra - rb
  })

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border">
          <th className="px-4 py-1.5 text-left text-muted-foreground">Creature</th>
          {runs.map((run, i) => (
            <th key={run.id} className="px-2 py-1.5 text-right text-muted-foreground">
              <div className="flex items-center justify-end gap-1.5">
                <div className={cn('h-2 w-2 rounded-full', RUN_COLOR_CLASSES[i % RUN_COLOR_CLASSES.length])} />
                Rank
              </div>
            </th>
          ))}
          {runs.length > 1 && (
            <th className="px-2 py-1.5 text-right text-muted-foreground">Change</th>
          )}
        </tr>
      </thead>
      <tbody>
        {sorted.map((name) => {
          const baseRank = rankMaps[0].get(name)?.rank
          const lastRank = rankMaps[rankMaps.length - 1].get(name)?.rank

          return (
            <tr key={name} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
              <td className="px-4 py-1.5 font-medium">{name}</td>
              {rankMaps.map((map, i) => {
                const entry = map.get(name)
                return (
                  <td key={i} className="px-2 py-1.5 text-right font-mono">
                    {entry ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>#{entry.rank}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {entry.appearances} appearances, {(entry.avgFitness * 100).toFixed(1)}% avg fitness
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                )
              })}
              {runs.length > 1 && (
                <td className="px-2 py-1.5 text-right">
                  {baseRank && lastRank ? (
                    <RankChange from={baseRank} to={lastRank} />
                  ) : !baseRank && lastRank ? (
                    <Badge variant="outline" className="text-[9px] text-success">NEW</Badge>
                  ) : baseRank && !lastRank ? (
                    <Badge variant="outline" className="text-[9px] text-destructive">GONE</Badge>
                  ) : null}
                </td>
              )}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function RankChange({ from, to }: { from: number; to: number }) {
  const delta = from - to // positive = improved (lower rank number)
  if (delta === 0) return <span className="text-muted-foreground/40">—</span>
  return (
    <span
      className={cn(
        'text-[10px] font-mono',
        delta > 0 ? 'text-success' : 'text-destructive',
      )}
    >
      {delta > 0 ? `+${delta}` : delta}
    </span>
  )
}

function ConfigDiff({ runs }: { runs: Array<SavedRun> }) {
  const keys: Array<{
    label: string
    getValue: (run: SavedRun) => string
  }> = [
    { label: 'Population', getValue: (r) => String(r.config.options.population) },
    { label: 'Generations', getValue: (r) => String(r.config.options.generations) },
    { label: 'Matches/Team', getValue: (r) => String(r.config.options.matchesPerTeam) },
    { label: 'Elite Rate', getValue: (r) => String(r.config.options.eliteRate) },
    { label: 'Mutation Rate', getValue: (r) => String(r.config.options.mutationRate) },
    { label: 'Normalize Stats', getValue: (r) => r.config.options.normalizeStats ? 'Yes' : 'No' },
    { label: 'No Actives', getValue: (r) => r.config.options.noActives ? 'Yes' : 'No' },
    { label: 'No Passives', getValue: (r) => r.config.options.noPassives ? 'Yes' : 'No' },
    { label: 'Creature Patches', getValue: (r) => String(r.config.creaturePatches.filter((p) => Object.keys(p).length > 1).length) },
    { label: 'Constant Overrides', getValue: (r) => String(Object.keys(r.config.constants).length) },
    { label: 'Damage Scale', getValue: (r) => r.config.constants.combatDamageScale !== undefined ? String(r.config.constants.combatDamageScale) : 'default' },
  ]

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border">
          <th className="px-3 py-1 text-left text-muted-foreground">Setting</th>
          {runs.map((run, i) => (
            <th key={run.id} className="px-2 py-1 text-right text-muted-foreground">
              <div className="flex items-center justify-end gap-1.5">
                <div className={cn('h-2 w-2 rounded-full', RUN_COLOR_CLASSES[i % RUN_COLOR_CLASSES.length])} />
                <span className="max-w-[80px] truncate">{run.label}</span>
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {keys.map(({ label, getValue }) => {
          const values = runs.map(getValue)
          const allSame = values.every((v) => v === values[0])

          return (
            <tr
              key={label}
              className={cn(
                'border-b border-border/20',
                !allSame && 'bg-primary/5',
              )}
            >
              <td className="px-3 py-1 text-muted-foreground">{label}</td>
              {values.map((v, i) => (
                <td
                  key={i}
                  className={cn(
                    'px-2 py-1 text-right font-mono',
                    !allSame && 'text-primary',
                  )}
                >
                  {v}
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
