import { useMemo } from 'react'
import { cn } from '../../lib/utils'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { Badge } from '../ui/badge'
import { SectionTooltip } from './SectionTooltip'
import { WinRateBadge } from './WinRateBadge'
import type { AbilityImpact } from '../../../shared/types.ts'

interface Props {
  abilities: Array<AbilityImpact>
}

export function FieldAbilityImpactTable({ abilities }: Props) {
  const sorted = useMemo(
    () =>
      [...abilities].sort((a, b) => b.avgWinRate - a.avgWinRate),
    [abilities],
  )

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle>Ability Impact</CardTitle>
          <SectionTooltip>
            Average win rate of creatures with each ability. Abilities far from
            50% may be over/underpowered. Controlled by creature count.
          </SectionTooltip>
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
                Avg Win Rate
              </th>
              <th className="px-2 py-1.5 text-right text-muted-foreground">
                Creatures
              </th>
              <th className="px-2 py-1.5 text-muted-foreground">Impact</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => {
              const delta = a.avgWinRate - 0.5
              const barWidth = Math.abs(delta) * 200
              return (
                <tr
                  key={a.templateId}
                  className="border-b border-border/20"
                >
                  <td className="px-4 py-1.5 font-medium">{a.name}</td>
                  <td className="px-2 py-1.5">
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5 py-0"
                    >
                      {a.abilityType}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    <WinRateBadge wr={a.avgWinRate} />
                  </td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground">
                    {a.creaturesWithAbility}
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
                          left: delta > 0 ? '50%' : `${50 - Math.min(barWidth, 50)}%`,
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
