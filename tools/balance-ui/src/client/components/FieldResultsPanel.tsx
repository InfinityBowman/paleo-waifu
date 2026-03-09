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
import { FieldSynergyValueTable } from './results/FieldSynergyValueTable'
import { FieldCompWinRates } from './results/FieldCompWinRates'
import { FieldFormationWinRates } from './results/FieldFormationWinRates'
import { CrossSimInsights } from './results/CrossSimInsights'
import type { SimState } from './results/constants'
import type {
  ConstantsOverride,
  ConstantsSnapshot,
  CreatureOverridePatch,
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
  onApplyConfig,
}: Props) {
  const [baselineOpen, setBaselineOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const summaryText = useMemo(() => {
    if (!result) return ''
    return buildFieldTextSummary(result.result)
  }, [result])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(summaryText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
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
        Run a field sim to see results
      </div>
    )
  }

  const { scorecard, creatureStats, roleMatchupMatrix, abilityImpact, synergyImpact, compWinRates, formationWinRates } =
    result.result

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
          {copied ? <Check size={14} className="text-green-500" /> : <ClipboardCopy size={14} />}
        </Button>
      </div>

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

      <FieldScorecardCard scorecard={scorecard} />

      {/* Win Rate Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle>Win Rate Distribution</CardTitle>
            <SectionTooltip>
              Histogram of creature win rates in 5% buckets. A healthy game has
              most creatures clustered around 50%. Wide spread indicates imbalance.
            </SectionTooltip>
          </div>
          <CardDescription>
            {creatureStats.length} creatures across 5% win rate buckets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WinRateDistributionChart creatures={creatureStats} />
        </CardContent>
      </Card>

      <RoleMatchupHeatmap matchups={roleMatchupMatrix} />
      <CreaturePowerRanking creatures={creatureStats} />
      <FieldAbilityImpactTable abilities={abilityImpact} />

      {synergyImpact.length > 0 && (
        <FieldSynergyValueTable synergies={synergyImpact} />
      )}

      <FieldCompWinRates compWinRates={compWinRates} />
      <FieldFormationWinRates formationWinRates={formationWinRates} />

      {metaResult && (
        <CrossSimInsights fieldCreatures={creatureStats} metaResult={metaResult} />
      )}
    </div>
  )
}
