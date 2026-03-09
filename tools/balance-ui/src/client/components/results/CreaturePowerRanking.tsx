import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { SectionTooltip } from './SectionTooltip'
import { WinRateBadge } from './WinRateBadge'
import { ROLE_COLOR_VALUES } from './constants'
import type { CreatureFieldStats } from '../../../shared/types.ts'

interface Props {
  creatures: Array<CreatureFieldStats>
}

export function CreaturePowerRanking({ creatures }: Props) {
  const [showAll, setShowAll] = useState(false)
  const sorted = useMemo(
    () => [...creatures].sort((a, b) => b.winRate - a.winRate),
    [creatures],
  )

  const outlierCount = sorted.filter(
    (c) => c.winRate > 0.6 || c.winRate < 0.4,
  ).length

  const displayed = showAll ? sorted : sorted.slice(0, 20)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle>Creature Power Ranking</CardTitle>
          <SectionTooltip>
            All creatures ranked by field win rate. Red rows are outliers
            (&gt;60% or &lt;40%). Shows best/worst matchup for each creature.
          </SectionTooltip>
          {outlierCount > 0 && (
            <Badge variant="destructive" className="text-[9px]">
              {outlierCount} outlier{outlierCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <CardDescription>
          {creatures.length} creatures by field win rate
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-1.5 text-left text-muted-foreground w-8">
                #
              </th>
              <th className="px-2 py-1.5 text-left text-muted-foreground">
                Creature
              </th>
              <th className="px-2 py-1.5 text-left text-muted-foreground">
                Role
              </th>
              <th className="px-2 py-1.5 text-right text-muted-foreground">
                Win Rate
              </th>
              <th className="px-2 py-1.5 text-right text-muted-foreground">
                W / Total
              </th>
              <th className="px-2 py-1.5 text-left text-muted-foreground">
                Best Matchup
              </th>
              <th className="px-2 py-1.5 text-left text-muted-foreground">
                Worst Matchup
              </th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((c, i) => {
              const isOutlier = c.winRate > 0.6 || c.winRate < 0.4
              return (
                <tr
                  key={c.id}
                  className={cn(
                    'border-b border-border/20 transition-colors',
                    isOutlier && 'bg-destructive/5',
                  )}
                >
                  <td className="px-4 py-1.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-1.5 font-medium">{c.name}</td>
                  <td className="px-2 py-1.5">
                    <span
                      className="capitalize"
                      style={{ color: ROLE_COLOR_VALUES[c.role] }}
                    >
                      {c.role}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    <WinRateBadge wr={c.winRate} />
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">
                    {c.wins}/{c.total}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">
                    {c.bestMatchup.opponentName && (
                      <span>
                        vs {c.bestMatchup.opponentName}{' '}
                        <span className="font-mono text-success">
                          {(c.bestMatchup.winRate * 100).toFixed(0)}%
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">
                    {c.worstMatchup.opponentName && (
                      <span>
                        vs {c.worstMatchup.opponentName}{' '}
                        <span className="font-mono text-destructive">
                          {(c.worstMatchup.winRate * 100).toFixed(0)}%
                        </span>
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {sorted.length > 20 && (
          <div className="flex justify-center pt-2">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setShowAll(!showAll)}
            >
              <ChevronDown
                size={12}
                className={cn(showAll && 'rotate-180', 'transition-transform')}
              />
              {showAll ? 'Show Top 20' : `Show All ${sorted.length}`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
