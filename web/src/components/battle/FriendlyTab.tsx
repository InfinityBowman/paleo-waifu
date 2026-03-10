import { useState } from 'react'
import { Swords } from 'lucide-react'
import { IconMagnifyingGlass } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { searchUsers } from '@/routes/_app/battle.index'

interface FriendlyTabProps {
  hasOffenseTeam: boolean
  userId: string
  loading: string | null
  onFriendlyBattle: (defenderId: string) => void
}

export function FriendlyTab({
  hasOffenseTeam,
  userId,
  loading,
  onFriendlyBattle,
}: FriendlyTabProps) {
  const [friendlySearch, setFriendlySearch] = useState('')
  const [friendlyResults, setFriendlyResults] = useState<
    Array<{ id: string; name: string; image: string | null }>
  >([])

  async function handleFriendlySearch() {
    if (friendlySearch.length < 2) return
    const results = await searchUsers({
      data: { query: friendlySearch, excludeId: userId },
    })
    setFriendlyResults(results)
  }

  if (!hasOffenseTeam) {
    return (
      <div className="flex flex-col items-center py-12 text-muted-foreground/50">
        <Swords className="mb-3 h-8 w-8" />
        <p className="text-sm">Set your offense team first</p>
        <p className="mt-1 text-xs">
          Go to the Teams tab to configure your lineup.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card/50 p-5">
      <h3 className="mb-1 font-display text-sm font-semibold">
        Challenge a Friend
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Friendly battles don&apos;t affect your rating.
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <IconMagnifyingGlass className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by username..."
            value={friendlySearch}
            onChange={(e) => setFriendlySearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFriendlySearch()}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          onClick={handleFriendlySearch}
          disabled={friendlySearch.length < 2}
        >
          Search
        </Button>
      </div>
      {friendlyResults.length > 0 && (
        <div className="mt-3 space-y-1 rounded-lg border border-border/50 bg-muted/10 p-1">
          {friendlyResults.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-muted/20"
            >
              <div className="flex items-center gap-2.5">
                {u.image ? (
                  <img
                    src={u.image}
                    alt=""
                    className="h-7 w-7 rounded-full"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/30 text-xs">
                    {u.name?.[0] ?? '?'}
                  </div>
                )}
                <span className="text-sm font-medium">{u.name}</span>
              </div>
              <Button
                size="sm"
                onClick={() => onFriendlyBattle(u.id)}
                disabled={loading === `friendly:${u.id}`}
              >
                <Swords className="mr-1.5 h-3.5 w-3.5" />
                {loading === `friendly:${u.id}` ? 'Battling...' : 'Battle'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
