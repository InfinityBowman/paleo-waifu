import { useMemo } from 'react'
import { cn } from '../../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { SectionTooltip } from './SectionTooltip'
import { WinRateBadge } from './WinRateBadge'
import type { TeamAbilityImpact } from '../../../shared/types.ts'

interface Props {
  abilities: Array<TeamAbilityImpact>
}

export function TeamAbilityImpactTable({ abilities }: Props) {
  const sorted = useMemo(
    () => [...abilities].sort((a, b) => b.teamWinRate - a.teamWinRate),
    [abilities],
  )

  const outlierCount = sorted.filter(
    (a) => a.teamWinRate > 0.55 || a.teamWinRate < 0.45,
  ).length

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle>Ability Impact (3v3)</CardTitle>
          <SectionTooltip>
            Win rate of teams containing creatures with each ability. Measured
            from 3v3 team battles — reflects how abilities contribute to team
            success. Low sample counts are less reliable.
          </SectionTooltip>
          {outlierCount > 0 && (
            <Badge variant="destructive" className="text-[9px]">
              {outlierCount} outlier{outlierCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-1.5 text-left text-muted-foreground">
                Ability
              </th>
              <th className="px-2 py-1.5 text-left text-muted-foreground">
                Type
              </th>
              <th className="px-2 py-1.5 text-right text-muted-foreground">
                Team WR
              </th>
              <th className="px-2 py-1.5 text-right text-muted-foreground">
                Delta
              </th>
              <th className="px-2 py-1.5 text-right text-muted-foreground">
                Creatures
              </th>
              <th className="px-2 py-1.5 text-right text-muted-foreground">
                Games
              </th>
              <th className="px-2 py-1.5 text-muted-foreground">Impact</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => {
              const delta = a.teamWinRate - 0.5
              const barWidth = Math.abs(delta) * 200
              const lowSample = a.creaturesWithAbility < 5
              const isOutlier = a.teamWinRate > 0.55 || a.teamWinRate < 0.45
              return (
                <tr
                  key={a.templateId}
                  className={cn(
                    'border-b border-border/20',
                    isOutlier && 'bg-destructive/5',
                  )}
                >
                  <td className="px-4 py-1.5 font-medium">{a.name}</td>
                  <td className="px-2 py-1.5">
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                      {a.abilityType}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    <WinRateBadge wr={a.teamWinRate} />
                  </td>
                  <td
                    className={cn(
                      'px-2 py-1.5 text-right font-mono',
                      delta > 0.02
                        ? 'text-success'
                        : delta < -0.02
                          ? 'text-destructive'
                          : 'text-muted-foreground',
                    )}
                  >
                    {delta > 0 ? '+' : ''}
                    {(delta * 100).toFixed(1)}pp
                  </td>
                  <td
                    className={cn(
                      'px-2 py-1.5 text-right',
                      lowSample
                        ? 'text-warning font-medium'
                        : 'text-muted-foreground',
                    )}
                    title={
                      lowSample
                        ? 'Low creature count — may not be reliable'
                        : undefined
                    }
                  >
                    {a.creaturesWithAbility}
                    {lowSample && ' ⚠'}
                  </td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground">
                    {a.sampleSize}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="relative flex h-3 items-center">
                      <div className="absolute left-1/2 h-full w-px bg-border" />
                      <div
                        className={cn(
                          'absolute h-2 rounded-sm',
                          delta > 0 ? 'bg-success/60' : 'bg-destructive/60',
                        )}
                        style={{
                          left:
                            delta > 0
                              ? '50%'
                              : `${50 - Math.min(barWidth, 50)}%`,
                          width: `${Math.min(barWidth, 50)}%`,
                        }}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
