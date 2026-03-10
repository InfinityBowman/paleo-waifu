import { Link } from '@tanstack/react-router'
import { History } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BattleLogItem {
  id: string
  attackerId: string
  attackerName: string
  attackerImage: string | null
  defenderId: string
  defenderName: string
  defenderImage: string | null
  mode: string
  winnerId: string | null
  ratingChange: number | null
  createdAt: Date | null
}

interface BattleHistoryProps {
  history: Array<BattleLogItem>
  userId: string
}

export function BattleHistory({ history, userId }: BattleHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-muted-foreground/50">
        <History className="mb-3 h-8 w-8" />
        <p className="text-sm">No battle history yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {history.map((b) => {
        const isAttacker = b.attackerId === userId
        const iWon = b.winnerId === userId
        const isDraw = !b.winnerId
        const opponentName = isAttacker ? b.defenderName : b.attackerName
        const opponentImage = isAttacker ? b.defenderImage : b.attackerImage

        return (
          <Link
            key={b.id}
            to="/battle/$id"
            params={{ id: b.id }}
            className={cn(
              'flex items-center justify-between rounded-xl border px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:bg-muted/10',
              iWon
                ? 'border-green-500/20 bg-green-500/5'
                : isDraw
                  ? 'border-border bg-muted/5'
                  : 'border-red-500/20 bg-red-500/5',
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'w-10 font-display text-xs font-bold',
                  iWon
                    ? 'text-green-400'
                    : isDraw
                      ? 'text-muted-foreground'
                      : 'text-red-400',
                )}
              >
                {iWon ? 'WIN' : isDraw ? 'DRAW' : 'LOSS'}
              </span>
              {opponentImage ? (
                <img
                  src={opponentImage}
                  alt=""
                  className="h-7 w-7 rounded-full"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/30 text-xs">
                  {opponentName?.[0] ?? '?'}
                </div>
              )}
              <div>
                <p className="text-sm">
                  vs{' '}
                  <span className="font-display font-medium">
                    {opponentName}
                  </span>
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                  <span className="capitalize">{b.mode}</span>
                  {b.ratingChange != null &&
                    (() => {
                      // ratingChange is stored as attacker's delta; negate for defender
                      const delta = isAttacker
                        ? b.ratingChange
                        : -b.ratingChange
                      return (
                        <span
                          className={cn(
                            'font-medium',
                            delta > 0
                              ? 'text-green-400'
                              : delta < 0
                                ? 'text-red-400'
                                : '',
                          )}
                        >
                          {delta > 0 ? `+${delta}` : delta}
                        </span>
                      )
                    })()}
                  {b.createdAt && (
                    <span>{new Date(b.createdAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
