import { useMemo, useState } from 'react'
import { ChevronDown, Info, RotateCcw } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  ReferenceArea,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '../lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { BaselineDiffSummary } from './BaselineDiffSummary'
import type { AbilityTemplate, Effect } from '@paleo-waifu/shared/battle/types'
import type {
  ConstantsOverride,
  ConstantsSnapshot,
  CreatureOverridePatch,
  CreatureRecord,
  GenerationSnapshot,
  MetaResult,
  MetaRunResult,
  SimRequest,
} from '../../shared/types.ts'

type SimState = 'idle' | 'running' | 'done' | 'error'

const AVG_TURNS_TARGET_MIN = 7
const AVG_TURNS_TARGET_MAX = 10

const ROLE_ORDER = ['striker', 'tank', 'support', 'bruiser']

const ROLE_COLORS: Record<string, string> = {
  striker: 'bg-role-striker',
  tank: 'bg-role-tank',
  support: 'bg-role-support',
  bruiser: 'bg-role-bruiser',
}

const ROLE_COLOR_VALUES: Record<string, string> = {
  striker: 'oklch(0.65 0.2 25)',
  tank: 'oklch(0.65 0.15 245)',
  support: 'oklch(0.65 0.15 145)',
  bruiser: 'oklch(0.75 0.15 75)',
}

const FORMATION_COLORS = [
  'oklch(0.65 0.15 340)',
  'oklch(0.65 0.15 245)',
  'oklch(0.65 0.15 145)',
  'oklch(0.75 0.15 75)',
  'oklch(0.7 0.17 300)',
  'oklch(0.7 0.1 200)',
]

function entries(obj: Record<string, number>): Array<[string, number]> {
  return Object.entries(obj)
}

interface Props {
  result: MetaRunResult | null
  error: string | null
  simState: SimState
  population?: number
  config?: {
    options: SimRequest['options']
    constants: ConstantsOverride
    creaturePatches: Array<CreatureOverridePatch>
  } | null
  constants?: ConstantsSnapshot | null
  creatures?: Array<CreatureRecord>
  onApplyConfig?: (config: {
    options: SimRequest['options']
    constants: ConstantsOverride
    creaturePatches: Array<CreatureOverridePatch>
  }) => void
}

export function ResultsPanel({
  result,
  error,
  simState,
  population,
  config,
  constants,
  creatures,
  onApplyConfig,
}: Props) {
  const [baselineOpen, setBaselineOpen] = useState(false)
  if (simState === 'error' && error) {
    return (
      <div className="p-6">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-4 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Run a sim to see results
      </div>
    )
  }

  const { result: meta, snapshots } = result

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Changes from Baseline */}
      {config && (
        <Card className="py-1">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setBaselineOpen((v) => !v)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setBaselineOpen((v) => !v) }}
            className="flex items-center justify-between px-4 py-1.5"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Changes from Baseline</span>
              <ChevronDown
                size={14}
                className={cn(
                  'text-muted-foreground transition-transform',
                  baselineOpen && 'rotate-180',
                )}
              />
            </div>
            {onApplyConfig && (
              <Button
                variant="outline"
                size="xs"
                onClick={(e) => {
                  e.stopPropagation()
                  onApplyConfig({
                    options: config.options,
                    constants: config.constants,
                    creaturePatches: config.creaturePatches,
                  })
                }}
              >
                <RotateCcw size={10} />
                Apply to Editor
              </Button>
            )}
          </div>
          {baselineOpen && (
            <CardContent className="px-4 pt-0 pb-2">
              <BaselineDiffSummary
                constants={config.constants}
                creaturePatches={config.creaturePatches}
                options={config.options}
                activeTemplates={constants?.activeTemplates}
                passiveTemplates={constants?.passiveTemplates}
              />
            </CardContent>
          )}
        </Card>
      )}

      {/* Role Meta Share */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle>Role Meta Share</CardTitle>
            <SectionTooltip>
              Percentage of top teams using each role. A balanced meta has all
              roles between 15-35%.
            </SectionTooltip>
          </div>
          <CardDescription>
            Distribution of roles across top-performing teams
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RoleMetaChart roleShares={meta.roleMetaShare} />
          <TargetBandIndicator roleShares={meta.roleMetaShare} />
        </CardContent>
      </Card>

      {/* Role Evolution */}
      {snapshots.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle>Role Evolution</CardTitle>
              <SectionTooltip>
                How role distribution in top-quartile teams shifts across
                generations. Stable bands suggest a settled meta; converging
                lines indicate a role taking over.
              </SectionTooltip>
            </div>
            <CardDescription>
              Per-generation role share in top teams
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RoleEvolutionChart snapshots={snapshots} />
          </CardContent>
        </Card>
      )}

      {/* Fitness Curve */}
      {snapshots.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle>Fitness Progression</CardTitle>
              <SectionTooltip>
                Shows how the best and average team fitness evolve across
                generations. Converging lines suggest a stable meta.
              </SectionTooltip>
            </div>
            <CardDescription>
              Top and average fitness across generations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FitnessCurve snapshots={snapshots} />
          </CardContent>
        </Card>
      )}

      {/* Battle Health Metrics */}
      {snapshots.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle>Battle Health</CardTitle>
              <SectionTooltip>
                Avg turns per battle and population diversity (unique genomes /
                population) over generations. Falling diversity signals
                convergence. Very low or high avg turns suggest damage scaling
                issues.
              </SectionTooltip>
            </div>
            <CardDescription>
              Average turns and genome diversity across generations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MetricsChart
              snapshots={snapshots}
              population={population ?? 100}
            />
            <TurnsTargetIndicator avgTurns={snapshots.at(-1)?.avgTurns ?? 0} />
            <DiversityIndicator
              diversity={
                ((snapshots.at(-1)?.uniqueGenomes ?? 0) / (population ?? 100)) *
                100
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Formation Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle>Formation Distribution</CardTitle>
            <SectionTooltip>
              How teams arrange creatures across front/back rows. Dominance of
              one formation may indicate row mechanics need tuning.
            </SectionTooltip>
          </div>
        </CardHeader>
        <CardContent>
          <FormationChart formationShares={meta.formationMetaShare} />
        </CardContent>
      </Card>

      {/* Top Creatures */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle>Top Creatures</CardTitle>
            <SectionTooltip>
              Creatures most frequently appearing in top-performing teams,
              ranked by number of appearances and average team fitness.
            </SectionTooltip>
          </div>
          <CardDescription>
            Meta presence by appearances in top teams
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <CreatureLeaderboard leaderboard={meta.creatureLeaderboard} constants={constants} />
        </CardContent>
      </Card>

      {/* Ability Leaderboard */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle>Ability Presence</CardTitle>
            <SectionTooltip>
              Which active and passive abilities appear most in winning teams.
              High concentration may indicate an ability is overtuned.
            </SectionTooltip>
          </div>
        </CardHeader>
        <CardContent>
          <AbilityLeaderboard leaderboard={meta.abilityLeaderboard} snapshots={snapshots} creatures={creatures} />
        </CardContent>
      </Card>

      {/* Hall of Fame */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle>Hall of Fame</CardTitle>
            <SectionTooltip>
              The top 10 performing teams from the final generation. Shows team
              composition and win/loss records.
            </SectionTooltip>
          </div>
          <CardDescription>
            Top 10 teams from the final generation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HallOfFame hallOfFame={meta.hallOfFame} />
        </CardContent>
      </Card>

      {/* Synergy Meta Share */}
      {Object.keys(meta.synergyMetaShare).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle>Synergy Presence</CardTitle>
              <SectionTooltip>
                Type-based team synergies triggered by shared creature types.
                High presence suggests the synergy bonus may be too strong.
              </SectionTooltip>
            </div>
          </CardHeader>
          <CardContent>
            <SynergyBars synergyShares={meta.synergyMetaShare} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SectionTooltip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info
          size={13}
          className="text-muted-foreground/75 hover:text-muted-foreground transition-colors"
        />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{children}</TooltipContent>
    </Tooltip>
  )
}

function CreatureLeaderboard({
  leaderboard,
  constants,
}: {
  leaderboard: MetaResult['creatureLeaderboard']
  constants?: ConstantsSnapshot | null
}) {
  const templateMap = useMemo(() => {
    if (!constants) return new Map<string, AbilityTemplate>()
    const map = new Map<string, AbilityTemplate>()
    for (const t of [...constants.activeTemplates, ...constants.passiveTemplates]) {
      map.set(t.id, t)
    }
    return map
  }, [constants])

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border">
          <th className="px-4 py-1.5 text-left text-muted-foreground">#</th>
          <th className="px-2 py-1.5 text-left text-muted-foreground">Name</th>
          <th className="px-2 py-1.5 text-left text-muted-foreground">Role</th>
          <th className="px-2 py-1.5 text-left text-muted-foreground">Active</th>
          <th className="px-2 py-1.5 text-left text-muted-foreground">Passive</th>
          <th className="px-2 py-1.5 text-right text-muted-foreground">
            Appearances
          </th>
          <th className="px-4 py-1.5 text-right text-muted-foreground">
            Avg Fitness
          </th>
        </tr>
      </thead>
      <tbody>
        {leaderboard.slice(0, 20).map((entry, i) => {
          const activeTpl = templateMap.get(entry.creature.active.templateId)
          const passiveTpl = templateMap.get(entry.creature.passive.templateId)
          return (
            <tr
              key={entry.creature.id}
              className="border-b border-border/20 hover:bg-muted/30 transition-colors"
            >
              <td className="px-4 py-1.5 text-muted-foreground">{i + 1}</td>
              <td className="px-2 py-1.5 font-medium">
                <span className={`text-rarity-${entry.creature.rarity}`}>
                  {entry.creature.name}
                </span>
              </td>
              <td className="px-2 py-1.5">
                <span className={cn('capitalize', `text-role-${entry.creature.role}`)}>
                  {entry.creature.role}
                </span>
              </td>
              <td className="px-2 py-1.5">
                <AbilityCell template={activeTpl} displayName={entry.creature.active.displayName} />
              </td>
              <td className="px-2 py-1.5">
                <AbilityCell template={passiveTpl} displayName={entry.creature.passive.displayName} />
              </td>
              <td className="px-2 py-1.5 text-right">{entry.appearances}</td>
              <td className="px-4 py-1.5 text-right font-mono">
                {(entry.avgFitness * 100).toFixed(1)}%
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function formatTarget(target: string): string {
  switch (target) {
    case 'self': return 'self'
    case 'single_enemy': return 'single target'
    case 'all_enemies': return 'AOE'
    case 'lowest_hp_ally': return 'lowest HP ally'
    case 'all_allies': return 'all allies'
    default: return target
  }
}

function formatEffect(e: Effect): string {
  switch (e.type) {
    case 'damage':
      return `${e.multiplier}x ${e.scaling} dmg`
    case 'heal':
      return `heal ${e.percent}%`
    case 'dot':
      return `${e.dotKind} ${e.percent}% ${e.duration}t`
    case 'buff':
      return `+${e.percent}% ${e.stat} ${e.duration}t`
    case 'debuff':
      return `-${e.percent}% ${e.stat} ${e.duration}t`
    case 'shield':
      return `shield ${e.percent}% ${e.duration}t`
    case 'stun':
      return `stun ${e.duration}t`
    case 'taunt':
      return `taunt ${e.duration}t`
    case 'lifesteal':
      return `lifesteal ${e.percent}%`
    case 'reflect':
      return `reflect ${e.percent}% ${e.duration}t`
    case 'damage_reduction':
      return `dmg red ${e.percent}%`
    case 'crit_reduction':
      return `crit red ${e.percent}%`
    case 'flat_reduction':
      return `flat red ${e.scalingPercent}% def`
    case 'dodge':
      return `dodge ${e.basePercent}%`
  }
}

function formatTrigger(template: AbilityTemplate): string {
  const t = template.trigger
  switch (t.type) {
    case 'onUse': return `Active · cd: ${t.cooldown}t`
    case 'onBasicAttack': return 'On basic attack'
    case 'onHit': return 'On hit'
    case 'onKill': return 'On kill'
    case 'onEnemyKO': return 'On enemy KO'
    case 'onAllyKO': return 'On ally KO'
    case 'onTurnStart': return 'On turn start'
    case 'onTurnEnd': return 'On turn end'
    case 'onBattleStart': return 'On battle start'
    case 'always': return 'Always active'
    default: return (t as { type: string }).type
  }
}

function AbilityCell({
  template,
  displayName,
}: {
  template?: AbilityTemplate
  displayName: string
}) {
  if (!template) {
    return <span className="text-muted-foreground">{displayName}</span>
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="text-left text-muted-foreground hover:text-foreground transition-colors">
          {displayName}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" className="w-64 p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{template.name}</span>
          <div className="flex gap-0.5">
            {template.roleAffinity.map((role) => (
              <span
                key={role}
                className={cn('h-1.5 w-1.5 rounded-full', `bg-role-${role}`)}
                title={role}
              />
            ))}
          </div>
        </div>

        <div className="mt-1 text-[10px] text-muted-foreground">
          {formatTrigger(template)} · {formatTarget(template.target)}
        </div>

        <p className="mt-1.5 text-[10px] text-muted-foreground/80">
          {template.description}
        </p>

        <div className="mt-2 flex flex-col gap-1 border-t border-border/50 pt-2">
          {template.effects.map((effect, i) => (
            <div key={i} className="flex items-start gap-2 text-[10px]">
              <span className="shrink-0 font-medium text-muted-foreground uppercase">
                {effect.type}
                {'stat' in effect && ` (${(effect as { stat: string }).stat})`}
                {'dotKind' in effect && ` (${(effect as { dotKind: string }).dotKind})`}
              </span>
              <span className="font-mono text-foreground">
                {formatEffect(effect)}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function AbilityLeaderboard({
  leaderboard,
  snapshots,
  creatures,
}: {
  leaderboard: MetaResult['abilityLeaderboard']
  snapshots: Array<GenerationSnapshot>
  creatures?: Array<CreatureRecord>
}) {
  // Build per-ability sparkline data from generation snapshots
  const sparklines = useMemo(() => {
    const map = new Map<string, Array<number>>()
    for (const snap of snapshots) {
      for (const [templateId, count] of Object.entries(snap.abilityPresence)) {
        let arr = map.get(templateId)
        if (!arr) {
          arr = []
          map.set(templateId, arr)
        }
        arr.push(count)
      }
    }
    return map
  }, [snapshots])

  // Count unique creatures per ability template
  const creatureCountByAbility = useMemo(() => {
    if (!creatures) return new Map<string, number>()
    const map = new Map<string, number>()
    for (const c of creatures) {
      map.set(c.active.templateId, (map.get(c.active.templateId) ?? 0) + 1)
      map.set(c.passive.templateId, (map.get(c.passive.templateId) ?? 0) + 1)
    }
    return map
  }, [creatures])

  return (
    <div className="grid grid-cols-2 gap-6">
      {(['active', 'passive'] as const).map((type) => {
        const items = leaderboard.filter((a) => a.abilityType === type)
        const maxAppearances = Math.max(...items.map((a) => a.appearances), 1)

        return (
          <div key={type}>
            <h4 className="mb-3 text-xs font-medium capitalize text-muted-foreground">
              {type}
            </h4>
            <div className="flex flex-col gap-2.5">
              {items.map((a) => {
                const barPct = (a.appearances / maxAppearances) * 100
                const barColor =
                  type === 'active'
                    ? 'oklch(0.65 0.2 25)'
                    : 'oklch(0.65 0.15 245)'
                const points = sparklines.get(a.templateId) ?? []
                const creatureCount =
                  creatureCountByAbility.get(a.templateId) ?? 0
                return (
                  <Tooltip key={a.templateId}>
                    <TooltipTrigger asChild>
                      <div className="group">
                        <div className="mb-0.5 flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1.5 font-medium group-hover:text-primary transition-colors">
                            {a.name}
                            {creatureCount > 0 && (
                              <span className="text-[9px] text-muted-foreground/70">
                                {creatureCount}cr
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            {points.length > 1 && (
                              <Sparkline points={points} color={barColor} />
                            )}
                            <span className="font-mono text-muted-foreground">
                              {a.appearances}
                              <span className="ml-1.5 text-foreground">
                                {(a.avgFitness * 100).toFixed(1)}%
                              </span>
                            </span>
                          </div>
                        </div>
                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${barPct}%`,
                              backgroundColor: barColor,
                              opacity: 0.4 + a.avgFitness * 0.6,
                            }}
                          />
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-[10px]">
                        <div>
                          {a.name} ({type})
                        </div>
                        <div>Appearances: {a.appearances}</div>
                        {creatureCount > 0 && (
                          <div>
                            Used by: {creatureCount} creature
                            {creatureCount !== 1 ? 's' : ''}
                          </div>
                        )}
                        <div>
                          Avg Team Fitness: {(a.avgFitness * 100).toFixed(1)}%
                        </div>
                        {points.length > 1 && (
                          <div>
                            Trend: {points[0]} → {points[points.length - 1]}
                            {points[points.length - 1] > points[0]
                              ? ' (rising)'
                              : points[points.length - 1] < points[0]
                                ? ' (falling)'
                                : ' (stable)'}
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Sparkline({
  points,
  color,
  width = 40,
  height = 14,
}: {
  points: Array<number>
  color: string
  width?: number
  height?: number
}) {
  if (points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const pad = 1

  const d = points
    .map((v, i) => {
      const x = pad + (i / (points.length - 1)) * (width - pad * 2)
      const y = pad + (1 - (v - min) / range) * (height - pad * 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} className="shrink-0">
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SynergyBars({ synergyShares }: { synergyShares: Record<string, number> }) {
  const sorted = entries(synergyShares).sort(([, a], [, b]) => b - a)
  const maxShare = Math.max(...sorted.map(([, s]) => s), 0.01)

  return (
    <div className="flex flex-col gap-2">
      {sorted.map(([synergy, share]) => {
        const barPct = (share / maxShare) * 100
        return (
          <div key={synergy}>
            <div className="mb-0.5 flex items-center justify-between text-[11px]">
              <span className="font-medium">{synergy}</span>
              <span className="font-mono text-muted-foreground">
                {(share * 100).toFixed(1)}%
              </span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${barPct}%`,
                  backgroundColor: 'oklch(0.7 0.17 300)',
                  opacity: 0.4 + share * 0.6,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function HallOfFame({ hallOfFame }: { hallOfFame: MetaResult['hallOfFame'] }) {
  return (
    <div className="flex flex-col gap-2">
      {hallOfFame.slice(0, 10).map((team, i) => (
        <Tooltip key={i}>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2 hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground w-6">
                  #{i + 1}
                </span>
                <div className="flex gap-1.5">
                  {team.members.map((m, j) => (
                    <Badge key={j} variant="secondary" className="text-[10px]">
                      {m.name}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground font-mono">
                  {team.wins}W {team.losses}L {team.draws}D
                </span>
                <span className="font-medium text-primary font-mono">
                  {(team.fitness * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              {team.members.map((m, j) => (
                <div key={j}>
                  {m.name} — {m.role} {m.rarity} ({m.hp}/{m.atk}/{m.def}/{m.spd}
                  )
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

function TargetBandIndicator({
  roleShares,
}: {
  roleShares: Record<string, number>
}) {
  const roles = entries(roleShares)
  const allInBand = roles.every(([, share]) => share >= 0.15 && share <= 0.35)

  return (
    <div
      className={cn(
        'mt-3 rounded-lg px-3 py-2 text-[11px]',
        allInBand
          ? 'bg-success/10 text-success'
          : 'bg-destructive/10 text-destructive',
      )}
    >
      Target band: 15-35% per role.{' '}
      {allInBand
        ? 'All roles within target!'
        : roles
            .filter(([, s]) => s < 0.15 || s > 0.35)
            .map(([r, s]) => `${r}: ${(s * 100).toFixed(1)}%`)
            .join(', ') + ' out of band'}
    </div>
  )
}

function RoleMetaChart({ roleShares }: { roleShares: Record<string, number> }) {
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
          contentStyle={{
            background: 'oklch(0.15 0.025 290)',
            border: '1px solid oklch(1 0 0 / 8%)',
            borderRadius: 8,
            fontSize: 12,
          }}
          itemStyle={{ color: 'oklch(0.9 0.02 290)' }}
          labelStyle={{ color: 'oklch(0.9 0.02 290)' }}
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

function FitnessCurve({ snapshots }: { snapshots: Array<GenerationSnapshot> }) {
  const data = snapshots.map((s) => ({
    gen: s.generation,
    top: Math.round(s.topFitness * 1000) / 10,
    avg: Math.round(s.avgFitness * 1000) / 10,
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 12, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 4%)" />
        <XAxis
          dataKey="gen"
          tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
          label={{
            value: 'Generation',
            position: 'insideBottom',
            offset: -2,
            fontSize: 10,
            fill: 'oklch(0.65 0.03 290)',
          }}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
          tickFormatter={(v: number) => `${v}%`}
          domain={['dataMin - 2', 'dataMax + 2']}
          width={40}
        />
        <RechartsTooltip
          formatter={(value, name) => [
            `${value}%`,
            name === 'top' ? 'Top Fitness' : 'Avg Fitness',
          ]}
          contentStyle={{
            background: 'oklch(0.15 0.025 290)',
            border: '1px solid oklch(1 0 0 / 8%)',
            borderRadius: 8,
            fontSize: 12,
          }}
          itemStyle={{ color: 'oklch(0.9 0.02 290)' }}
          labelStyle={{ color: 'oklch(0.9 0.02 290)' }}
          labelFormatter={(label) => `Gen ${label}`}
        />
        <Legend
          verticalAlign="top"
          height={28}
          formatter={(value: string) => (value === 'top' ? 'Top' : 'Avg')}
          wrapperStyle={{ fontSize: 11 }}
        />
        <Line
          type="monotone"
          dataKey="top"
          stroke={ROLE_COLOR_VALUES.striker}
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="avg"
          stroke={ROLE_COLOR_VALUES.support}
          strokeWidth={2}
          dot={false}
          opacity={0.7}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function MetricsChart({
  snapshots,
  population,
}: {
  snapshots: Array<GenerationSnapshot>
  population: number
}) {
  const data = snapshots.map((s) => ({
    gen: s.generation,
    avgTurns: Math.round(s.avgTurns * 10) / 10,
    diversity: Math.min(
      100,
      Math.round((s.uniqueGenomes / population) * 1000) / 10,
    ),
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 12, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 4%)" />
        <XAxis
          dataKey="gen"
          tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
          label={{
            value: 'Generation',
            position: 'insideBottom',
            offset: -2,
            fontSize: 10,
            fill: 'oklch(0.65 0.03 290)',
          }}
        />
        <YAxis
          yAxisId="turns"
          tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
          width={40}
          label={{
            value: 'Turns',
            angle: -90,
            position: 'insideLeft',
            fontSize: 10,
            fill: 'oklch(0.65 0.03 290)',
          }}
        />
        <YAxis
          yAxisId="diversity"
          orientation="right"
          tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
          tickFormatter={(v: number) => `${v}%`}
          domain={[0, 100]}
          width={40}
        />
        <RechartsTooltip
          formatter={(value, name) => [
            name === 'avgTurns' ? `${value} turns` : `${value}%`,
            name === 'avgTurns' ? 'Avg Turns' : 'Diversity',
          ]}
          contentStyle={{
            background: 'oklch(0.15 0.025 290)',
            border: '1px solid oklch(1 0 0 / 8%)',
            borderRadius: 8,
            fontSize: 12,
          }}
          itemStyle={{ color: 'oklch(0.9 0.02 290)' }}
          labelStyle={{ color: 'oklch(0.9 0.02 290)' }}
          labelFormatter={(label) => `Gen ${label}`}
        />
        <Legend
          verticalAlign="top"
          height={28}
          formatter={(value: string) =>
            value === 'avgTurns' ? 'Avg Turns' : 'Diversity'
          }
          wrapperStyle={{ fontSize: 11 }}
        />
        <ReferenceArea
          yAxisId="turns"
          y1={AVG_TURNS_TARGET_MIN}
          y2={AVG_TURNS_TARGET_MAX}
          fill="oklch(0.65 0.15 145 / 8%)"
          strokeDasharray="4 4"
          stroke="oklch(0.65 0.15 145 / 25%)"
        />
        <Line
          yAxisId="turns"
          type="monotone"
          dataKey="avgTurns"
          stroke={ROLE_COLOR_VALUES.bruiser}
          strokeWidth={2}
          dot={false}
        />
        <Line
          yAxisId="diversity"
          type="monotone"
          dataKey="diversity"
          stroke={ROLE_COLOR_VALUES.tank}
          strokeWidth={2}
          dot={false}
          opacity={0.7}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function TurnsTargetIndicator({ avgTurns }: { avgTurns: number }) {
  const inBand =
    avgTurns >= AVG_TURNS_TARGET_MIN && avgTurns <= AVG_TURNS_TARGET_MAX

  return (
    <div
      className={cn(
        'mt-3 rounded-lg px-3 py-2 text-[11px]',
        inBand
          ? 'bg-success/10 text-success'
          : 'bg-destructive/10 text-destructive',
      )}
    >
      Target: {AVG_TURNS_TARGET_MIN}-{AVG_TURNS_TARGET_MAX} avg turns.{' '}
      {inBand
        ? `${avgTurns.toFixed(1)} turns — within target!`
        : avgTurns < AVG_TURNS_TARGET_MIN
          ? `${avgTurns.toFixed(1)} turns — too short (damage too high or HP too low)`
          : `${avgTurns.toFixed(1)} turns — too long (damage too low or HP too high)`}
    </div>
  )
}

function DiversityIndicator({ diversity }: { diversity: number }) {
  const healthy = diversity >= 30

  return (
    <div
      className={cn(
        'mt-2 rounded-lg px-3 py-2 text-[11px]',
        healthy
          ? 'bg-success/10 text-success'
          : 'bg-warning/10 text-warning',
      )}
    >
      <span className="font-medium">Diversity: {diversity.toFixed(0)}%</span>
      <span className="ml-1.5 opacity-75">
        — % of unique team compositions in the population.{' '}
        {healthy
          ? 'Healthy variety in team building.'
          : 'Low diversity — meta is converging on a few dominant teams.'}
      </span>
    </div>
  )
}

function RoleEvolutionChart({
  snapshots,
}: {
  snapshots: Array<GenerationSnapshot>
}) {
  const data = snapshots.map((s) => {
    const total = Object.values(s.roleDistribution).reduce((a, b) => a + b, 0)
    const row: Record<string, number> = { gen: s.generation }
    for (const role of ROLE_ORDER) {
      row[role] =
        total > 0
          ? Math.round(((s.roleDistribution[role] ?? 0) / total) * 1000) / 10
          : 0
    }
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 5, right: 12, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 4%)" />
        <XAxis
          dataKey="gen"
          tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
          label={{
            value: 'Generation',
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
          formatter={(value, name) => [
            `${value}%`,
            String(name).charAt(0).toUpperCase() + String(name).slice(1),
          ]}
          contentStyle={{
            background: 'oklch(0.15 0.025 290)',
            border: '1px solid oklch(1 0 0 / 8%)',
            borderRadius: 8,
            fontSize: 12,
          }}
          itemStyle={{ color: 'oklch(0.9 0.02 290)' }}
          labelStyle={{ color: 'oklch(0.9 0.02 290)' }}
          labelFormatter={(label) => `Gen ${label}`}
        />
        <Legend
          verticalAlign="top"
          height={28}
          formatter={(value: string) =>
            value.charAt(0).toUpperCase() + value.slice(1)
          }
          wrapperStyle={{ fontSize: 11 }}
        />
        {ROLE_ORDER.map((role) => (
          <Area
            key={role}
            type="monotone"
            dataKey={role}
            stackId="1"
            fill={ROLE_COLOR_VALUES[role] ?? 'oklch(0.5 0 0)'}
            stroke={ROLE_COLOR_VALUES[role] ?? 'oklch(0.5 0 0)'}
            fillOpacity={0.6}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

function FormationChart({
  formationShares,
}: {
  formationShares: Record<string, number>
}) {
  const data = entries(formationShares)
    .sort(([, a], [, b]) => b - a)
    .map(([name, share]) => ({
      name,
      value: Math.round(share * 1000) / 10,
    }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={75}
          innerRadius={40}
          paddingAngle={2}
          label={({ name, value }) => `${name ?? ''} ${value}%`}
          labelLine={{ stroke: 'oklch(0.65 0.03 290)' }}
          fontSize={10}
        >
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={FORMATION_COLORS[i % FORMATION_COLORS.length]}
            />
          ))}
        </Pie>
        <RechartsTooltip
          formatter={(value) => [`${value}%`, 'Usage']}
          contentStyle={{
            background: 'oklch(0.15 0.025 290)',
            border: '1px solid oklch(1 0 0 / 8%)',
            borderRadius: 8,
            fontSize: 12,
          }}
          itemStyle={{ color: 'oklch(0.9 0.02 290)' }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
