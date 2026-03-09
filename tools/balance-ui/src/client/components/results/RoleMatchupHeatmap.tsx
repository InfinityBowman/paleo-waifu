import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { SectionTooltip } from './SectionTooltip'
import { ROLE_COLOR_VALUES, ROLE_ORDER } from './constants'
import type { RoleMatchup } from '../../../shared/types.ts'

interface Props {
  matchups: Array<RoleMatchup>
}

export function RoleMatchupHeatmap({ matchups }: Props) {
  const matrix = useMemo(() => {
    const map = new Map<string, RoleMatchup>()
    for (const m of matchups) {
      map.set(`${m.attacker}-${m.defender}`, m)
    }
    return map
  }, [matchups])

  function wrColor(wr: number): string {
    if (wr > 0.55) return 'oklch(0.65 0.15 145)' // green - advantaged
    if (wr > 0.52) return 'oklch(0.65 0.08 145)' // light green
    if (wr >= 0.48) return 'oklch(0.3 0 0)' // neutral dark
    if (wr >= 0.45) return 'oklch(0.5 0.08 25)' // light red
    return 'oklch(0.55 0.15 25)' // red - disadvantaged
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle>Role Matchup Matrix</CardTitle>
          <SectionTooltip>
            Each cell shows how often the row role beats the column role. Read
            as &ldquo;striker beats tank X% of the time.&rdquo; Values near 50%
            mean an even matchup. Asymmetry reveals rock-paper-scissors
            dynamics.
          </SectionTooltip>
        </div>
      </CardHeader>
      <CardContent>
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="px-2 py-1.5 text-left text-muted-foreground">
                Atk \ Def
              </th>
              {ROLE_ORDER.map((role) => (
                <th
                  key={role}
                  className="px-2 py-1.5 text-center capitalize"
                  style={{ color: ROLE_COLOR_VALUES[role] }}
                >
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLE_ORDER.map((attacker) => (
              <tr key={attacker}>
                <td
                  className="px-2 py-1.5 font-medium capitalize"
                  style={{ color: ROLE_COLOR_VALUES[attacker] }}
                >
                  {attacker}
                </td>
                {ROLE_ORDER.map((defender) => {
                  const m = matrix.get(`${attacker}-${defender}`)
                  if (!m) {
                    return (
                      <td
                        key={defender}
                        className="px-2 py-1.5 text-center text-muted-foreground/50"
                      >
                        —
                      </td>
                    )
                  }
                  return (
                    <td key={defender} className="px-2 py-1.5 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className="inline-block rounded px-2 py-0.5 font-mono text-[11px] font-semibold"
                            style={{
                              backgroundColor: wrColor(m.winRate),
                              color: 'oklch(0.95 0 0)',
                            }}
                          >
                            {(m.winRate * 100).toFixed(1)}%
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <span className="capitalize">{attacker}</span> beats{' '}
                          <span className="capitalize">{defender}</span>{' '}
                          {(m.winRate * 100).toFixed(1)}% of the time
                          <span className="block text-[10px] text-muted-foreground">
                            {m.sampleSize} battles
                          </span>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
