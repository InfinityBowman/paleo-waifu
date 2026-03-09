import { useState } from 'react'
import { Badge } from '../ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { ROLE_COLOR_VALUES } from './constants'
import type { MetaResult } from '../../../shared/types.ts'

export function HallOfFame({ hallOfFame }: { hallOfFame: MetaResult['hallOfFame'] }) {
  const [showAll, setShowAll] = useState(false)
  const displayed = showAll ? hallOfFame : hallOfFame.slice(0, 10)

  return (
    <div>
      <div className={`flex flex-col gap-2 ${showAll ? 'max-h-150 overflow-y-auto' : ''}`}>
      {displayed.map((team, i) => (
        <Tooltip key={i}>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2 hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground w-6">
                  #{i + 1}
                </span>
                <div className="flex gap-1.5">
                  {team.members.map((m, j) => (
                    <Badge
                      key={j}
                      variant="secondary"
                      className="text-[10px]"
                      style={{ color: ROLE_COLOR_VALUES[m.role] }}
                    >
                      {m.name}
                      <span className="ml-0.5 text-[8px] opacity-50">
                        {team.genome[j].row === 'front' ? 'F' : 'B'}
                      </span>
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground font-mono">
                  {team.wins}W {team.losses}L {team.draws}D
                </span>
                <span className="font-medium text-primary font-mono">
                  {(team.fitness * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              {team.members.map((m, j) => (
                <div key={j}>
                  {m.name} — {m.role} {m.rarity} ({m.hp}/{m.atk}/{m.def}/{m.spd}) · {team.genome[j].row}
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      ))}
      </div>
      {hallOfFame.length > 10 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 w-full text-center text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          {showAll ? 'Show top 10' : `Show all ${hallOfFame.length} teams`}
        </button>
      )}
    </div>
  )
}
