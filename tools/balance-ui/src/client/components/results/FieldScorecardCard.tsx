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
      <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
          tooltip="Difference between highest and lowest win rates. Below 30% is healthy."
        />
        <ScorecardStat
          label="Within 45-55%"
          value={`${scorecard.percentWithin45to55.toFixed(0)}%`}
          good={scorecard.percentWithin45to55 > 60}
          tooltip="Percentage of creatures with win rates between 45-55%. Above 60% is healthy."
        />
        <ScorecardStat
          label="Role WR Variance"
          value={scorecard.roleWinRateVariance.toFixed(4)}
          good={scorecard.roleWinRateVariance < 0.01}
          tooltip="Variance of average win rates across roles. Below 0.01 means roles are balanced."
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
