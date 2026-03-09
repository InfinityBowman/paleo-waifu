import { cn } from '../../lib/utils'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { SectionTooltip } from './SectionTooltip'
import type { BalanceScorecard } from '../../../shared/types.ts'

interface Props {
  scorecard: BalanceScorecard
}

export function FieldScorecardCard({ scorecard }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle>Balance Scorecard</CardTitle>
          <SectionTooltip>
            Single-glance health metrics. Green = healthy, amber = needs attention.
            Gini near 0 means equal win rates. Higher 45-55% coverage is better.
          </SectionTooltip>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-4 sm:grid-cols-6">
        <ScorecardStat
          label="Gini Coefficient"
          value={scorecard.giniCoefficient.toFixed(3)}
          good={scorecard.giniCoefficient < 0.1}
          tooltip="0 = perfect equality, 1 = one creature wins all. Below 0.1 is healthy."
        />
        <ScorecardStat
          label="Win Rate Spread"
          value={`${(scorecard.winRateSpread * 100).toFixed(1)}%`}
          good={scorecard.winRateSpread < 0.3}
          tooltip={`${(scorecard.minWinRate * 100).toFixed(1)}% min — ${(scorecard.maxWinRate * 100).toFixed(1)}% max. Below 30% spread is healthy.`}
        />
        <ScorecardStat
          label="Within 45-55%"
          value={`${scorecard.percentWithin45to55.toFixed(0)}%`}
          good={scorecard.percentWithin45to55 > 60}
          tooltip="Percentage of creatures with win rates between 45-55%. Above 60% is healthy."
        />
        <ScorecardStat
          label="Within 40-60%"
          value={`${scorecard.percentWithin40to60.toFixed(0)}%`}
          good={scorecard.percentWithin40to60 > 85}
          tooltip="Percentage of creatures within 40-60% WR. Above 85% means few outliers."
        />
        <ScorecardStat
          label="Role WR Variance"
          value={scorecard.roleWinRateVariance.toFixed(4)}
          good={scorecard.roleWinRateVariance < 0.01}
          tooltip="Variance of average win rates across roles. Below 0.01 means roles are balanced."
        />
        <ScorecardStat
          label="Strongest / Weakest"
          value={`${(scorecard.maxWinRate * 100).toFixed(0)}% / ${(scorecard.minWinRate * 100).toFixed(0)}%`}
          good={scorecard.maxWinRate < 0.65 && scorecard.minWinRate > 0.35}
          tooltip="Highest and lowest individual creature win rates. Both within 35-65% is healthy."
        />
      </CardContent>
    </Card>
  )
}

function ScorecardStat({
  label,
  value,
  good,
  tooltip,
}: {
  label: string
  value: string
  good: boolean
  tooltip: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help text-center">
          <div className="text-[10px] text-muted-foreground">{label}</div>
          <div
            className={cn(
              'mt-0.5 text-lg font-mono font-semibold',
              good ? 'text-success' : 'text-warning',
            )}
          >
            {value}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
