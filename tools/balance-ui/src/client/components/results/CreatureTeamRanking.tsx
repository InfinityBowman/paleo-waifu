import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Swords, Shield } from 'lucide-react'
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
import type { CreatureTeamStats } from '../../../shared/types.ts'

type SortMode = 'teamWr' | 'delta'

interface Props {
  creatures: Array<CreatureTeamStats>
  creatureAbilities?: Map<string, { active: string; passive: string }>
}

export function CreatureTeamRanking({ creatures, creatureAbilities }: Props) {
  const [showAll, setShowAll] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('teamWr')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const sorted = useMemo(() => {
    const items = [...creatures]
    if (sortMode === 'delta') {
      items.sort((a, b) => b.teamDelta - a.teamDelta)
    } else {
      items.sort((a, b) => b.teamWinRate - a.teamWinRate)
    }
    return items
  }, [creatures, sortMode])

  const displayed = showAll ? sorted : sorted.slice(0, 20)

  const teamCarried = sorted.filter((c) => c.teamDelta > 0.03).length
  const soloCarry = sorted.filter((c) => c.teamDelta < -0.03).length

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle>Creature Team Performance</CardTitle>
          <SectionTooltip>
            How each creature performs in random 3v3 teams compared to their 1v1
            solo win rate. Positive delta = creature benefits from team context.
            Negative delta = creature is weaker in teams than solo.
            Click a creature name to see their abilities.
          </SectionTooltip>
          {teamCarried > 0 && (
            <Badge variant="outline" className="text-[9px] text-success border-success/30">
              {teamCarried} team-boosted
            </Badge>
          )}
          {soloCarry > 0 && (
            <Badge variant="outline" className="text-[9px] text-warning border-warning/30">
              {soloCarry} solo-reliant
            </Badge>
          )}
        </div>
        <CardDescription>
          {creatures.length} creatures — 3v3 team win rate vs 1v1 solo
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <div className="flex items-center gap-2 px-4 pb-2">
          <span className="text-[10px] text-muted-foreground">Sort:</span>
          {([
            { mode: 'teamWr' as const, label: 'Team Win Rate' },
            { mode: 'delta' as const, label: 'Team Δ (biggest boost)' },
          ]).map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSortMode(mode)}
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-full transition-colors',
                sortMode === mode
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
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
                Team WR
              </th>
              <th className="px-2 py-1.5 text-right text-muted-foreground">
                Solo WR
              </th>
              <th className="px-2 py-1.5 text-right text-muted-foreground">
                Δ
              </th>
              <th className="px-2 py-1.5 text-right text-muted-foreground">
                Games
              </th>
              <th className="px-2 py-1.5 text-left text-muted-foreground">
                Best Teammate
              </th>
              <th className="px-2 py-1.5 text-left text-muted-foreground">
                Worst Teammate
              </th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((c, i) => {
              const isOutlier = c.teamWinRate > 0.6 || c.teamWinRate < 0.4
              const isExpanded = expandedId === c.id
              const abilities = creatureAbilities?.get(c.id)
              return (
                <Fragment key={c.id}>
                  <tr
                    className={cn(
                      'border-b border-border/20 transition-colors',
                      isOutlier && 'bg-destructive/5',
                      abilities && 'cursor-pointer hover:bg-muted/30',
                    )}
                    onClick={() => {
                      if (abilities) setExpandedId(isExpanded ? null : c.id)
                    }}
                  >
                    <td className="px-4 py-1.5 text-muted-foreground">
                      {i + 1}
                    </td>
                    <td className="px-2 py-1.5 font-medium">
                      <span className="inline-flex items-center gap-1">
                        {abilities && (
                          <ChevronRight
                            size={10}
                            className={cn(
                              'text-muted-foreground transition-transform shrink-0',
                              isExpanded && 'rotate-90',
                            )}
                          />
                        )}
                        {c.name}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <span
                        className="capitalize"
                        style={{ color: ROLE_COLOR_VALUES[c.role] }}
                      >
                        {c.role}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      <WinRateBadge wr={c.teamWinRate} />
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">
                      {(c.soloWinRate * 100).toFixed(1)}%
                    </td>
                    <td
                      className={cn(
                        'px-2 py-1.5 text-right font-mono font-semibold',
                        c.teamDelta > 0.02
                          ? 'text-success'
                          : c.teamDelta < -0.02
                            ? 'text-destructive'
                            : 'text-muted-foreground',
                      )}
                    >
                      {c.teamDelta > 0 ? '+' : ''}
                      {(c.teamDelta * 100).toFixed(1)}pp
                    </td>
                    <td className="px-2 py-1.5 text-right text-muted-foreground">
                      {c.teamTotal}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {c.bestTeammate.name !== '—' && (
                        <span>
                          {c.bestTeammate.name}{' '}
                          <span className="font-mono text-success">
                            {(c.bestTeammate.winRate * 100).toFixed(0)}%
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {c.worstTeammate.name !== '—' && (
                        <span>
                          {c.worstTeammate.name}{' '}
                          <span className="font-mono text-destructive">
                            {(c.worstTeammate.winRate * 100).toFixed(0)}%
                          </span>
                        </span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && abilities && (
                    <tr key={`${c.id}-abilities`} className="border-b border-border/20 bg-muted/20">
                      <td />
                      <td colSpan={8} className="px-2 py-2">
                        <div className="flex items-center gap-4 text-[11px]">
                          <span className="inline-flex items-center gap-1.5">
                            <Swords size={11} className="text-amber-400" />
                            <span className="text-muted-foreground">Active:</span>
                            <span className="font-medium">{abilities.active}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Shield size={11} className="text-sky-400" />
                            <span className="text-muted-foreground">Passive:</span>
                            <span className="font-medium">{abilities.passive}</span>
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
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
