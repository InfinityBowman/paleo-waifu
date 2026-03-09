import { useCallback, useMemo, useState } from 'react'
import { Check, ChevronDown, ClipboardCopy, Eye, RotateCcw } from 'lucide-react'
import { cn } from '../lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { BaselineDiffSummary } from './BaselineDiffSummary'
import { buildTextSummary } from './results/buildTextSummary'
import { SectionTooltip } from './results/SectionTooltip'
import { CreatureLeaderboard } from './results/CreatureLeaderboard'
import { AbilityLeaderboard } from './results/AbilityLeaderboard'
import { AbilityUsageTable } from './results/AbilityUsageTable'
import { HallOfFame } from './results/HallOfFame'
import { SynergyBars } from './results/SynergyBars'
import {
  DiversityIndicator,
  MetaBreadthIndicator,
  TargetBandIndicator,
  TurnsTargetIndicator,
} from './results/indicators'
import { RoleMetaChart } from './results/charts/RoleMetaChart'
import { FitnessCurve } from './results/charts/FitnessCurve'
import { MetricsChart } from './results/charts/MetricsChart'
import { RoleWinRateChart } from './results/charts/RoleWinRateChart'
import { CompArchetypeChart } from './results/charts/CompArchetypeChart'
import { AbilityScatterChart } from './results/charts/AbilityScatterChart'
import { CreatureScatterChart } from './results/charts/CreatureScatterChart'
import { RoleEvolutionChart } from './results/charts/RoleEvolutionChart'
import { RoleHpCurvesChart } from './results/charts/RoleHpCurvesChart'
import { RoleContributionsChart } from './results/charts/RoleContributionsChart'
import { FormationChart } from './results/charts/FormationChart'
import type {
  ConstantsOverride,
  ConstantsSnapshot,
  CreatureOverridePatch,
  CreatureRecord,
  MetaRunResult,
  SimRequest,
} from '../../shared/types.ts'

import type { SimState } from './results/constants'

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
  const [copied, setCopied] = useState(false)

  const summaryText = useMemo(() => {
    if (!result) return ''
    return buildTextSummary(
      result.result,
      result.snapshots,
      population,
      config,
      constants,
      creatures?.length,
    )
  }, [result, population, config, constants])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(summaryText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [summaryText])

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
      {/* Copy Summary */}
      <div className="flex items-center justify-end gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Eye size={14} />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="end"
            className="w-125 max-h-100 overflow-y-auto p-3"
          >
            <pre className="text-[10px] leading-tight whitespace-pre-wrap font-mono text-muted-foreground">
              {summaryText}
            </pre>
          </PopoverContent>
        </Popover>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleCopy}
        >
          {copied ? (
            <Check size={14} className="text-green-500" />
          ) : (
            <ClipboardCopy size={14} />
          )}
        </Button>
      </div>

      {/* Changes from Baseline */}
      {config && (
        <Card className="py-1">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setBaselineOpen((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setBaselineOpen((v) => !v)
            }}
            className="flex items-center justify-between px-4 py-1.5"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">
                Changes from Baseline
              </span>
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

      {/* Role Win Rate vs Presence */}
      {meta.roleWinRates && Object.keys(meta.roleWinRates).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle>Role Win Rate vs Presence</CardTitle>
              <SectionTooltip>
                Compares how often a role appears in top teams (presence) vs how
                often teams containing that role actually win (win rate). A role
                with high presence but low win rate is a noob trap. High win
                rate but low presence means it's undervalued.
              </SectionTooltip>
            </div>
            <CardDescription>
              Pick rate vs actual win rate per role
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RoleWinRateChart
              roleShares={meta.roleMetaShare}
              roleWinRates={meta.roleWinRates}
            />
          </CardContent>
        </Card>
      )}

      {/* Team Comp Archetypes */}
      {meta.compMetaShare && Object.keys(meta.compMetaShare).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle>Team Compositions</CardTitle>
              <SectionTooltip>
                Distribution of role combinations across all teams, with win
                rates. High presence + high win rate = meta dominant. High win
                rate + low presence = underexplored strong comp.
              </SectionTooltip>
            </div>
            <CardDescription>
              Presence and win rate per team archetype
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompArchetypeChart
              compShares={meta.compMetaShare}
              compWinRates={meta.compWinRates}
            />
          </CardContent>
        </Card>
      )}

      {/* Ability Pick Rate vs Win Rate Scatter */}
      {meta.abilityLeaderboard.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle>Ability Balance Scatter</CardTitle>
              <SectionTooltip>
                Each dot is an ability. X = pick rate, Y = win rate differential
                (WR of teams with ability minus WR of teams without). Above 0 =
                having it helps, below 0 = having it hurts. Top-right =
                meta-defining, top-left = sleeper OP, bottom-right = noob trap.
              </SectionTooltip>
            </div>
            <CardDescription>
              Pick rate vs WR differential per ability
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AbilityScatterChart leaderboard={meta.abilityLeaderboard} />
          </CardContent>
        </Card>
      )}

      {/* Creature Balance Scatter */}
      {meta.creatureLeaderboard.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle>Creature Balance Scatter</CardTitle>
              <SectionTooltip>
                Each dot is a creature. X = presence across all teams, Y = win
                rate differential (WR of teams with creature minus WR of teams
                without). Color = role. Above 0 = having it helps, below 0 =
                having it hurts. Top-right = meta dominant.
              </SectionTooltip>
            </div>
            <CardDescription>
              Presence vs WR differential per creature (all teams)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreatureScatterChart leaderboard={meta.creatureLeaderboard} />
          </CardContent>
        </Card>
      )}

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
                Fitness = (wins + draws × 0.5) / total matches — essentially a
                win rate from 0 to 1. Shows how the best and average team
                fitness evolve across generations. Converging lines suggest a
                stable meta.
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
                Avg turns per battle, population diversity (unique genomes), and
                meta breadth (% of creatures in top teams) over generations.
                Falling diversity signals convergence. Low meta breadth means
                few creatures dominate.
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
              totalCreatures={creatures?.length ?? 0}
            />
            <TurnsTargetIndicator avgTurns={snapshots.at(-1)?.avgTurns ?? 0} />
            <DiversityIndicator
              diversity={
                ((snapshots.at(-1)?.uniqueGenomes ?? 0) / (population ?? 100)) *
                100
              }
            />
            <MetaBreadthIndicator
              breadth={
                (creatures?.length ?? 0) > 0
                  ? (Object.keys(snapshots.at(-1)?.creatureFrequency ?? {})
                      .length /
                      (creatures?.length ?? 1)) *
                    100
                  : 0
              }
            />
          </CardContent>
        </Card>
      )}

      {/* HP Curves (final gen telemetry) */}
      {meta.roleHpCurves && Object.keys(meta.roleHpCurves).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle>HP Curves</CardTitle>
              <SectionTooltip>
                Average HP% per role at each turn of the final generation&apos;s
                battles. Solid lines = wins, dashed = losses. Shows which roles
                survive longest and how win/loss trajectories diverge.
              </SectionTooltip>
            </div>
            <CardDescription>
              Turn-by-turn HP% per role (final generation, wins vs losses)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RoleHpCurvesChart roleHpCurves={meta.roleHpCurves} />
          </CardContent>
        </Card>
      )}

      {/* Role Contributions (final gen telemetry) */}
      {meta.roleContributions &&
        Object.keys(meta.roleContributions).length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CardTitle>Role Contributions</CardTitle>
                <SectionTooltip>
                  Average damage dealt, damage taken, healing done, shields
                  applied, and debuffs landed per role per battle in the final
                  generation. Shows whether strikers dominate damage, tanks
                  absorb hits, and supports contribute through healing and
                  shields.
                </SectionTooltip>
              </div>
              <CardDescription>
                Per-role averages from final generation battles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RoleContributionsChart
                roleContributions={meta.roleContributions}
              />
            </CardContent>
          </Card>
        )}

      <div className="grid grid-cols-2 gap-4">
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

      {/* Top Creatures */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle>Top Creatures</CardTitle>
            <SectionTooltip>
              Creatures most frequently appearing in top-performing teams,
              ranked by number of appearances and average team fitness. Fitness
              = (wins + draws × 0.5) / total matches.
            </SectionTooltip>
          </div>
          <CardDescription>
            Meta presence by appearances in top teams
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <CreatureLeaderboard
            leaderboard={meta.creatureLeaderboard}
            constants={constants}
          />
        </CardContent>
      </Card>

      {/* Ability Leaderboard */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle>Ability Presence</CardTitle>
            <SectionTooltip>
              Which active and passive abilities appear most in winning teams,
              with average team fitness. Fitness = (wins + draws × 0.5) / total
              matches. High concentration may indicate an ability is overtuned.
            </SectionTooltip>
          </div>
        </CardHeader>
        <CardContent>
          <AbilityLeaderboard
            leaderboard={meta.abilityLeaderboard}
            snapshots={snapshots}
            creatures={creatures}
          />
        </CardContent>
      </Card>

      {/* Ability Usage (from final gen battles) */}
      {meta.abilityUsage && meta.abilityUsage.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle>Ability Usage</CardTitle>
              <SectionTooltip>
                How often each ability (including basic attack) is actually used
                in final generation battles, and how much damage it deals. Shows
                whether abilities are firing or creatures are mostly basic
                attacking.
              </SectionTooltip>
            </div>
            <CardDescription>
              Actual usage and damage from final generation battles
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <AbilityUsageTable abilityUsage={meta.abilityUsage} />
          </CardContent>
        </Card>
      )}

      {/* Hall of Fame */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle>Hall of Fame</CardTitle>
            <SectionTooltip>
              The top 10 performing teams from the final generation, ranked by
              fitness. Fitness = (wins + draws × 0.5) / total matches. Shows
              team composition and win/loss records.
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
    </div>
  )
}
