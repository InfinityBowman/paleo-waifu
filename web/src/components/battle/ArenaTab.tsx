import { useState } from 'react'
import { RefreshCw, Swords } from 'lucide-react'
import { toast } from 'sonner'
import { OpponentCard } from './OpponentCard'
import type { ArenaOpponent } from './OpponentCard'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { refreshOpponents } from '@/routes/_app/battle.index'

interface ArenaTabProps {
  hasOffenseTeam: boolean
  onGoToTeams: () => void
  userId: string
  dailyLimit: { remaining: number; total: number }
  loading: string | null
  onArenaAttack: (defenderId: string) => void
}

export function ArenaTab({
  hasOffenseTeam,
  onGoToTeams,
  userId,
  dailyLimit,
  loading,
  onArenaAttack,
}: ArenaTabProps) {
  const [opponents, setOpponents] = useState<Array<ArenaOpponent>>([])
  const [loadingOpponents, setLoadingOpponents] = useState(false)

  async function handleRefreshOpponents() {
    setLoadingOpponents(true)
    try {
      const results = await refreshOpponents({ data: userId })
      setOpponents(results)
    } catch {
      toast.error('Failed to load opponents')
    } finally {
      setLoadingOpponents(false)
    }
  }

  if (!hasOffenseTeam) {
    return (
      <div className="flex flex-col items-center py-12">
        <Swords className="mb-3 h-10 w-10 text-amber-400" />
        <p className="text-base font-medium text-muted-foreground">
          Set your offense team first
        </p>
        <p className="mt-1 text-sm text-muted-foreground/70">
          Configure your lineup before entering the arena.
        </p>
        <Button
          variant="default"
          size="sm"
          className="mt-4"
          onClick={onGoToTeams}
        >
          Go to Teams
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Daily counter */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card/50 px-5 py-3">
        <div>
          <p className="font-display text-sm font-semibold">Arena Attacks</p>
          <p className="text-xs text-muted-foreground">
            {dailyLimit.remaining} of {dailyLimit.total} remaining today
          </p>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: dailyLimit.total }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-3 w-3 rounded-full transition-colors',
                i < dailyLimit.remaining
                  ? 'bg-primary'
                  : 'bg-muted-foreground/20',
              )}
            />
          ))}
        </div>
      </div>

      {/* Find Opponents */}
      <div className="rounded-xl border border-border bg-card/50 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold">Opponents</h3>
          <Button
            variant="default"
            size="sm"
            onClick={handleRefreshOpponents}
            disabled={loadingOpponents || dailyLimit.remaining === 0}
          >
            <RefreshCw
              className={cn(
                'mr-1.5 h-3 w-3',
                loadingOpponents && 'animate-spin',
              )}
            />
            {opponents.length === 0 ? 'Find Opponents' : 'Refresh'}
          </Button>
        </div>

        {opponents.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-muted-foreground/50">
            <Swords className="mb-2 h-6 w-6" />
            <p className="text-xs">
              Click &quot;Find Opponents&quot; to browse players near your
              rating.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {opponents.map((o) => (
              <OpponentCard
                key={o.userId}
                opponent={o}
                onAttack={() => onArenaAttack(o.userId)}
                loading={loading === `arena:${o.userId}`}
                disabled={dailyLimit.remaining === 0 || loading !== null}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
