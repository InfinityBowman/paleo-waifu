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

const SYNERGY_DESCRIPTIONS: Record<string, string> = {
  'Type 3x': 'All 3 creatures share the same type',
  'Type 2x': '2 of 3 creatures share the same type',
  'Era 3x': 'All 3 creatures from the same era',
  'Era 2x': '2 of 3 creatures from the same era',
  'All Carnivore': 'All 3 creatures are carnivores',
  'All Herbivore': 'All 3 creatures are herbivores',
  'Mixed Diet': 'Team has both carnivores and herbivores',
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
            Positive delta = synergy helps, negative = synergy hurts or is noise.
            Low sample counts (&lt;30) may not be statistically significant.
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
              <th className="px-2 py-1.5 text-muted-foreground">
                Impact
              </th>
              <th className="px-2 py-1.5 text-right text-muted-foreground">
                Sample
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => {
              const barWidth = Math.abs(s.delta) * 200
              const lowSample = s.sampleSize < 30
              return (
                <tr key={s.synergy} className="border-b border-border/20">
                  <td className="px-4 py-1.5">
                    <div className="font-medium">{s.synergy}</div>
                    {SYNERGY_DESCRIPTIONS[s.synergy] && (
                      <div className="text-[10px] text-muted-foreground">
                        {SYNERGY_DESCRIPTIONS[s.synergy]}
                      </div>
                    )}
                  </td>
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
                  <td className="px-2 py-1.5">
                    <div className="relative flex h-3 items-center">
                      <div className="absolute left-1/2 h-full w-px bg-border" />
                      <div
                        className={cn(
                          'absolute h-2 rounded-sm',
                          s.delta > 0 ? 'bg-success/60' : 'bg-destructive/60',
                        )}
                        style={{
                          left: s.delta > 0 ? '50%' : `${50 - Math.min(barWidth, 50)}%`,
                          width: `${Math.min(barWidth, 50)}%`,
                        }}
                      />
                    </div>
                  </td>
                  <td
                    className={cn(
                      'px-2 py-1.5 text-right',
                      lowSample
                        ? 'text-warning font-medium'
                        : 'text-muted-foreground',
                    )}
                    title={lowSample ? 'Low sample size — may not be statistically significant' : undefined}
                  >
                    {s.sampleSize}
                    {lowSample && ' ⚠'}
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
