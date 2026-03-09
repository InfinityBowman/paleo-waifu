import { useMemo } from 'react'
import { cn } from '../../lib/utils'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { SectionTooltip } from './SectionTooltip'
import { pct } from './constants'
import type { SynergyImpact } from '../../../shared/types.ts'

interface Props {
  synergies: Array<SynergyImpact>
}

export function FieldSynergyValueTable({ synergies }: Props) {
  const sorted = useMemo(
    () => [...synergies].sort((a, b) => b.delta - a.delta),
    [synergies],
  )

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle>Synergy Value</CardTitle>
          <SectionTooltip>
            Measured win rate delta for teams with vs without each synergy type.
            Positive delta = synergy helps, negative = synergy hurts or is
            noise.
          </SectionTooltip>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-1.5 text-left text-muted-foreground">
                Synergy
              </th>
              <th className="px-2 py-1.5 text-right text-muted-foreground">
                With
              </th>
              <th className="px-2 py-1.5 text-right text-muted-foreground">
                Without
              </th>
              <th className="px-2 py-1.5 text-right text-muted-foreground">
                Delta
              </th>
              <th className="px-2 py-1.5 text-right text-muted-foreground">
                Sample
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.synergy} className="border-b border-border/20">
                <td className="px-4 py-1.5 font-medium">{s.synergy}</td>
                <td className="px-2 py-1.5 text-right font-mono">
                  {pct(s.avgWinRate)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">
                  {pct(s.avgWinRateWithout)}
                </td>
                <td
                  className={cn(
                    'px-2 py-1.5 text-right font-mono font-semibold',
                    s.delta > 0.02
                      ? 'text-success'
                      : s.delta < -0.02
                        ? 'text-destructive'
                        : 'text-muted-foreground',
                  )}
                >
                  {s.delta > 0 ? '+' : ''}
                  {(s.delta * 100).toFixed(1)}%
                </td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">
                  {s.sampleSize}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
