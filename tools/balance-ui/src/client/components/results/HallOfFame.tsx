import { Badge } from '../ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import type { MetaResult } from '../../../shared/types.ts'

export function HallOfFame({ hallOfFame }: { hallOfFame: MetaResult['hallOfFame'] }) {
  return (
    <div className="flex flex-col gap-2">
      {hallOfFame.slice(0, 10).map((team, i) => (
        <Tooltip key={i}>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2 hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground w-6">
                  #{i + 1}
                </span>
                <div className="flex gap-1.5">
                  {team.members.map((m, j) => (
                    <Badge key={j} variant="secondary" className="text-[10px]">
                      {m.name}
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
                  {m.name} — {m.role} {m.rarity} ({m.hp}/{m.atk}/{m.def}/{m.spd}
                  )
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}
