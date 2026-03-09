import { useMemo, useState } from 'react'
import { cn } from '../../lib/utils'
import { AbilityCell } from './AbilityCell'
import type { AbilityTemplate } from '@paleo-waifu/shared/battle/types'
import type { ConstantsSnapshot, MetaResult } from '../../../shared/types.ts'

type SortMode = 'appearances' | 'winRate'

function wrColor(diff: number): string {
  if (diff < -0.02) return 'text-red-400'
  if (diff > 0.02) return 'text-green-400'
  return ''
}

export function CreatureLeaderboard({
  leaderboard,
  constants,
}: {
  leaderboard: MetaResult['creatureLeaderboard']
  constants?: ConstantsSnapshot | null
}) {
  const [showAll, setShowAll] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('appearances')

  const sorted = useMemo(() => {
    const items = [...leaderboard]
    if (sortMode === 'winRate') {
      items.sort((a, b) => a.allTeamWinRate - b.allTeamWinRate)
    }
    return items
  }, [leaderboard, sortMode])

  const displayed = showAll ? sorted : sorted.slice(0, 20)

  const templateMap = useMemo(() => {
    if (!constants) return new Map<string, AbilityTemplate>()
    const map = new Map<string, AbilityTemplate>()
    for (const t of [
      ...constants.activeTemplates,
      ...constants.passiveTemplates,
    ]) {
      map.set(t.id, t)
    }
    return map
  }, [constants])

  return (
    <div>
      <div className="flex items-center gap-2 px-4 pb-2">
        <span className="text-[10px] text-muted-foreground">Sort:</span>
        {(['appearances', 'winRate'] as const).map((mode) => (
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
            {mode === 'appearances' ? 'Appearances' : 'WR Diff (worst first)'}
          </button>
        ))}
      </div>
      <div className={showAll ? 'max-h-150 overflow-y-auto' : ''}>
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-border">
              <th className="px-4 py-1.5 text-left text-muted-foreground">#</th>
              <th className="px-2 py-1.5 text-left text-muted-foreground">
                Name
              </th>
              <th className="px-2 py-1.5 text-left text-muted-foreground">
                Role
              </th>
              <th className="px-2 py-1.5 text-left text-muted-foreground">
                Active
              </th>
              <th className="px-2 py-1.5 text-left text-muted-foreground">
                Passive
              </th>
              <th className="px-2 py-1.5 text-right text-muted-foreground">
                Appearances
              </th>
              <th className="px-2 py-1.5 text-right text-muted-foreground">
                Win %
              </th>
              <th className="px-2 py-1.5 text-right text-muted-foreground">
                WR Diff
              </th>
              <th className="px-4 py-1.5 text-right text-muted-foreground">
                Avg Fitness
              </th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((entry, i) => {
              const activeTpl = templateMap.get(
                entry.creature.active.templateId,
              )
              const passiveTpl = templateMap.get(
                entry.creature.passive.templateId,
              )
              return (
                <tr
                  key={entry.creature.id}
                  className="border-b border-border/20 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-1.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-1.5 font-medium">
                    <span className={`text-rarity-${entry.creature.rarity}`}>
                      {entry.creature.name}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <span
                      className={cn(
                        'capitalize',
                        `text-role-${entry.creature.role}`,
                      )}
                    >
                      {entry.creature.role}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <AbilityCell
                      template={activeTpl}
                      displayName={entry.creature.active.displayName}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <AbilityCell
                      template={passiveTpl}
                      displayName={entry.creature.passive.displayName}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {entry.appearances}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    {(entry.winRate * 100).toFixed(1)}%
                  </td>
                  <td
                    className={cn(
                      'px-2 py-1.5 text-right font-mono',
                      wrColor(entry.allTeamWinRate),
                    )}
                  >
                    {entry.allTeamWinRate > 0 ? '+' : ''}
                    {(entry.allTeamWinRate * 100).toFixed(1)}pp
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono">
                    {(entry.avgFitness * 100).toFixed(1)}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {sorted.length > 20 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 w-full text-center text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          {showAll ? 'Show top 20' : `Reveal all ${sorted.length} creatures`}
        </button>
      )}
    </div>
  )
}
