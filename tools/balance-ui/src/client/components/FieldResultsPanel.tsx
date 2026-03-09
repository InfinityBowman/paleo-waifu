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
import { SectionTooltip } from './results/SectionTooltip'
import { buildFieldTextSummary } from './results/buildFieldTextSummary'
import { FieldScorecardCard } from './results/FieldScorecardCard'
import { WinRateDistributionChart } from './results/charts/WinRateDistributionChart'
import { RoleMatchupHeatmap } from './results/RoleMatchupHeatmap'
import { CreaturePowerRanking } from './results/CreaturePowerRanking'
import { FieldAbilityImpactTable } from './results/FieldAbilityImpactTable'
import { TeamAbilityImpactTable } from './results/TeamAbilityImpactTable'
import { TeamRoleContribution } from './results/TeamRoleContribution'
import { FieldSynergyValueTable } from './results/FieldSynergyValueTable'
import { FieldCompWinRates } from './results/FieldCompWinRates'
import { FieldFormationWinRates } from './results/FieldFormationWinRates'
import { CreatureTeamRanking } from './results/CreatureTeamRanking'
import { SoloVsTeamScatter } from './results/charts/SoloVsTeamScatter'
import { CrossSimInsights } from './results/CrossSimInsights'
import type { SimState } from './results/constants'
import type {
  ConstantsOverride,
  ConstantsSnapshot,
  CreatureOverridePatch,
  CreatureRecord,
  FieldRunResult,
  FieldSimRequest,
  MetaRunResult,
} from '../../shared/types.ts'

interface Props {
  result: FieldRunResult | null
  error: string | null
  simState: SimState
  metaResult?: MetaRunResult | null
  config?: {
    options: FieldSimRequest['options']
    constants: ConstantsOverride
    creaturePatches: Array<CreatureOverridePatch>
  } | null
  creatures?: Array<CreatureRecord>
  constants?: ConstantsSnapshot | null
  onApplyConfig?: (config: {
    options: FieldSimRequest['options']
    constants: ConstantsOverride
    creaturePatches: Array<CreatureOverridePatch>
  }) => void
}

export function FieldResultsPanel({
  result,
  error,
  simState,
  metaResult,
  config,
  constants,
  creatures,
  onApplyConfig,
}: Props) {
  const [baselineOpen, setBaselineOpen] = useState(false)
  const [soloOpen, setSoloOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const summaryText = useMemo(() => {
    if (!result) return ''
    return buildFieldTextSummary(result.result)
  }, [result])

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(summaryText)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {})
  }, [summaryText])

  const creatureAbilities = useMemo(() => {
    if (!creatures)
      return new Map<string, { active: string; passive: string }>()
    const map = new Map<string, { active: string; passive: string }>()
    for (const c of creatures) {
      map.set(c.id, {
        active: c.active.displayName,
        passive: c.passive.displayName,
      })
    }
    return map
  }, [creatures])

  const teamWinRates = useMemo(
    () =>
      (result?.result.creatureTeamStats ?? [])
        .filter((c) => c.teamTotal > 0)
        .map((c) => ({ winRate: c.teamWinRate })),
    [result],
  )

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
        Run a field sim to see results
      </div>
    )
  }

  const {
    creatureStats,
    roleMatchupMatrix,
    abilityImpact,
    synergyImpact,
    compWinRates,
    formationWinRates,
    creatureTeamStats,
    scorecard,
    teamAbilityImpact,
    teamRoleMatchup,
  } = result.result

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

      {/* ── 3v3 Team Results (primary view) ── */}
      <FieldScorecardCard scorecard={scorecard} />

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle>Team Win Rate Distribution</CardTitle>
            <SectionTooltip>
              Histogram of creature team win rates in 5% buckets. A healthy game
              has most creatures clustered around 50%. Wide spread indicates
              imbalance.
            </SectionTooltip>
          </div>
          <CardDescription>
            {teamWinRates.length} creatures across 5% team win rate buckets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WinRateDistributionChart creatures={teamWinRates} />
        </CardContent>
      </Card>

      <CreatureTeamRanking
        creatures={creatureTeamStats}
        creatureAbilities={creatureAbilities}
      />

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle>Solo vs Team Performance</CardTitle>
            <SectionTooltip>
              Each dot is a creature. X = 1v1 solo win rate, Y = 3v3 team win
              rate. Dots above the diagonal benefit from teams; dots below are
              weaker in teams.
            </SectionTooltip>
          </div>
          <CardDescription>
            Comparing 1v1 solo WR to 3v3 team WR per creature
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SoloVsTeamScatter creatures={creatureTeamStats} />
        </CardContent>
      </Card>

      {teamAbilityImpact.length > 0 && (
        <TeamAbilityImpactTable abilities={teamAbilityImpact} />
      )}

      {teamRoleMatchup.length > 0 && (
        <TeamRoleContribution roles={teamRoleMatchup} />
      )}

      {synergyImpact.length > 0 && (
        <FieldSynergyValueTable synergies={synergyImpact} />
      )}

      <FieldCompWinRates compWinRates={compWinRates} />
      <FieldFormationWinRates formationWinRates={formationWinRates} />

      {/* ── 1v1 Details (collapsed) ── */}
      <div className="mt-4">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSoloOpen((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setSoloOpen((v) => !v)
          }}
          className="flex cursor-pointer items-center gap-3"
        >
          <div className="h-px flex-1 bg-border" />
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            1v1 Solo Details
            <ChevronDown
              size={12}
              className={cn('transition-transform', soloOpen && 'rotate-180')}
            />
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {soloOpen && (
          <div className="mt-4 flex flex-col gap-4">
            <RoleMatchupHeatmap matchups={roleMatchupMatrix} />
            <CreaturePowerRanking creatures={creatureStats} />
            <FieldAbilityImpactTable abilities={abilityImpact} />
          </div>
        )}
      </div>

      {metaResult && (
        <CrossSimInsights
          fieldCreatures={creatureStats}
          metaResult={metaResult}
        />
      )}
    </div>
  )
}
