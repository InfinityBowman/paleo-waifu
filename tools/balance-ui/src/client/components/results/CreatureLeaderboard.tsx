import { useMemo, useState } from 'react'
import { cn } from '../../lib/utils'
import { AbilityCell } from './AbilityCell'
import type { AbilityTemplate } from '@paleo-waifu/shared/battle/types'
import type { ConstantsSnapshot, MetaResult } from '../../../shared/types.ts'

export function CreatureLeaderboard({
  leaderboard,
  constants,
}: {
  leaderboard: MetaResult['creatureLeaderboard']
  constants?: ConstantsSnapshot | null
}) {
  const [showAll, setShowAll] = useState(false)
  const displayed = showAll ? leaderboard : leaderboard.slice(0, 20)

  const templateMap = useMemo(() => {
    if (!constants) return new Map<string, AbilityTemplate>()
    const map = new Map<string, AbilityTemplate>()
    for (const t of [...constants.activeTemplates, ...constants.passiveTemplates]) {
      map.set(t.id, t)
    }
    return map
  }, [constants])

  return (
    <div>
      <div className={showAll ? 'max-h-150 overflow-y-auto' : ''}>
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-border">
              <th className="px-4 py-1.5 text-left text-muted-foreground">#</th>
              <th className="px-2 py-1.5 text-left text-muted-foreground">Name</th>
              <th className="px-2 py-1.5 text-left text-muted-foreground">Role</th>
              <th className="px-2 py-1.5 text-left text-muted-foreground">Active</th>
              <th className="px-2 py-1.5 text-left text-muted-foreground">Passive</th>
              <th className="px-2 py-1.5 text-right text-muted-foreground">
                Appearances
              </th>
              <th className="px-4 py-1.5 text-right text-muted-foreground">
                Avg Fitness
              </th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((entry, i) => {
          const activeTpl = templateMap.get(entry.creature.active.templateId)
          const passiveTpl = templateMap.get(entry.creature.passive.templateId)
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
                <span className={cn('capitalize', `text-role-${entry.creature.role}`)}>
                  {entry.creature.role}
                </span>
              </td>
              <td className="px-2 py-1.5">
                <AbilityCell template={activeTpl} displayName={entry.creature.active.displayName} />
              </td>
              <td className="px-2 py-1.5">
                <AbilityCell template={passiveTpl} displayName={entry.creature.passive.displayName} />
              </td>
              <td className="px-2 py-1.5 text-right">{entry.appearances}</td>
              <td className="px-4 py-1.5 text-right font-mono">
                {(entry.avgFitness * 100).toFixed(1)}%
              </td>
            </tr>
          )
        })}
          </tbody>
        </table>
      </div>
      {leaderboard.length > 20 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 w-full text-center text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          {showAll ? 'Show top 20' : `Reveal all ${leaderboard.length} creatures`}
        </button>
      )}
    </div>
  )
}
