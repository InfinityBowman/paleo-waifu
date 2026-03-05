import { useState } from 'react'
import { ChevronDown, Info } from 'lucide-react'
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
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { BaselineDiffSummary } from './BaselineDiffSummary'
import type {
  ConstantsOverride,
  ConstantsSnapshot,
  CreatureOverridePatch,
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
}

export function ResultsPanel({
  result,
  error,
  simState,
  population,
  config,
  constants,
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
          <button
            type="button"
            onClick={() => setBaselineOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-1.5"
          >
            <span className="text-sm font-semibold">Changes from Baseline</span>
            <ChevronDown
              size={14}
              className={cn(
                'text-muted-foreground transition-transform',
                baselineOpen && 'rotate-180',
              )}
            />
          </button>
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
          <CreatureLeaderboard leaderboard={meta.creatureLeaderboard} />
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
          <AbilityLeaderboard leaderboard={meta.abilityLeaderboard} />
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
            <div className="flex flex-wrap gap-2">
              {entries(meta.synergyMetaShare)
                .sort(([, a], [, b]) => b - a)
                .map(([synergy, share]) => (
                  <Badge key={synergy} variant="outline" className="text-xs">
                    {synergy}
                    <span className="ml-1 text-muted-foreground">
                      {(share * 100).toFixed(1)}%
                    </span>
                  </Badge>
                ))}
            </div>
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
          className="cursor-help text-muted-foreground/75 hover:text-muted-foreground transition-colors"
        />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{children}</TooltipContent>
    </Tooltip>
  )
}

function CreatureLeaderboard({
  leaderboard,
}: {
  leaderboard: MetaResult['creatureLeaderboard']
}) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border">
          <th className="px-4 py-1.5 text-left text-muted-foreground">#</th>
          <th className="px-2 py-1.5 text-left text-muted-foreground">Name</th>
          <th className="px-2 py-1.5 text-left text-muted-foreground">
            Rarity
          </th>
          <th className="px-2 py-1.5 text-left text-muted-foreground">Role</th>
          <th className="px-2 py-1.5 text-right text-muted-foreground">
            Appearances
          </th>
          <th className="px-4 py-1.5 text-right text-muted-foreground">
            Avg Fitness
          </th>
        </tr>
      </thead>
      <tbody>
        {leaderboard.slice(0, 20).map((entry, i) => (
          <Tooltip key={entry.creature.id}>
            <TooltipTrigger asChild>
              <tr className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-1.5 text-muted-foreground">{i + 1}</td>
                <td className="px-2 py-1.5 font-medium">
                  {entry.creature.name}
                </td>
                <td className="px-2 py-1.5">
                  <span
                    className={cn(
                      'capitalize',
                      `text-rarity-${entry.creature.rarity}`,
                    )}
                  >
                    {entry.creature.rarity}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <span
                    className={cn(
                      'capitalize',
                      `text-role-${entry.creature.role}`,
                    )}
                  >
                    {entry.creature.role}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right">{entry.appearances}</td>
                <td className="px-4 py-1.5 text-right font-mono">
                  {(entry.avgFitness * 100).toFixed(1)}%
                </td>
              </tr>
            </TooltipTrigger>
            <TooltipContent>
              {entry.creature.name} — {entry.creature.role}{' '}
              {entry.creature.rarity}
              <br />
              Stats: {entry.creature.hp}/{entry.creature.atk}/
              {entry.creature.def}/{entry.creature.spd}
              <br />
              Active: {entry.creature.active.displayName} | Passive:{' '}
              {entry.creature.passive.displayName}
            </TooltipContent>
          </Tooltip>
        ))}
      </tbody>
    </table>
  )
}

function AbilityLeaderboard({
  leaderboard,
}: {
  leaderboard: MetaResult['abilityLeaderboard']
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {(['active', 'passive'] as const).map((type) => (
        <div key={type}>
          <h4 className="mb-2 text-xs font-medium capitalize text-muted-foreground">
            {type}
          </h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="px-2 py-1 text-left text-muted-foreground">
                  Ability
                </th>
                <th className="px-2 py-1 text-right text-muted-foreground">
                  Count
                </th>
                <th className="px-2 py-1 text-right text-muted-foreground">
                  Avg Fitness
                </th>
              </tr>
            </thead>
            <tbody>
              {leaderboard
                .filter((a) => a.abilityType === type)
                .map((a) => (
                  <tr
                    key={a.templateId}
                    className="border-b border-border/20 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-2 py-1">{a.name}</td>
                    <td className="px-2 py-1 text-right">{a.appearances}</td>
                    <td className="px-2 py-1 text-right font-mono">
                      {(a.avgFitness * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}
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
