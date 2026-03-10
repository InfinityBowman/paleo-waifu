import { useCallback, useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { History, RefreshCw, Shield, Swords, Trophy, Users } from 'lucide-react'
import { toast } from 'sonner'
import { BattleTeamPicker } from './BattleTeamPicker'
import { BattleTransition } from './BattleTransition'
import type { BattleOutcome, BattlePlayers } from './BattleTransition'
import type { TeamSlot } from './BattleTeamPicker'
import type { BattleReadyCreature } from './BattleCreatureSlot'
import type { Rarity } from '@paleo-waifu/shared/types'
import { IconFossil, IconMagnifyingGlass } from '@/components/icons'
import { cn } from '@/lib/utils'
import { RARITY_BORDER, RARITY_COLORS } from '@/lib/rarity-styles'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { refreshOpponents, searchUsers } from '@/routes/_app/battle.index'

interface BattleLogItem {
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

interface Teams {
  offense: Array<{ userCreatureId: string; row: 'front' | 'back' }> | null
  defense: Array<{ userCreatureId: string; row: 'front' | 'back' }> | null
}

interface ArenaOpponent {
  userId: string
  name: string
  image: string | null
  rating: number
  tier: string
  defenseCreatures: Array<{
    name: string
    rarity: string
    role: string
    imageUrl: string | null
    row: string
  }>
}

interface BattleListProps {
  history: Array<BattleLogItem>
  teams: Teams
  battleReadyCreatures: Array<BattleReadyCreature>
  userId: string
  userName: string
  userImage: string | null
  dailyLimit: { remaining: number; total: number }
}

const EMPTY_TEAM: [TeamSlot | null, TeamSlot | null, TeamSlot | null] = [
  null,
  null,
  null,
]

export function BattleList({
  history,
  teams,
  battleReadyCreatures,
  userId,
  userName,
  userImage,
  dailyLimit,
}: BattleListProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  // Battle transition state
  const [transitionActive, setTransitionActive] = useState(false)
  const [transitionOutcome, setTransitionOutcome] =
    useState<BattleOutcome | null>(null)
  const [transitionPlayers, setTransitionPlayers] =
    useState<BattlePlayers | null>(null)

  // Arena state
  const [opponents, setOpponents] = useState<Array<ArenaOpponent>>([])
  const [loadingOpponents, setLoadingOpponents] = useState(false)

  // Teams state
  const [offenseTeam, setOffenseTeam] = useState<
    [TeamSlot | null, TeamSlot | null, TeamSlot | null]
  >(() => hydrateTeamSlots(teams.offense, battleReadyCreatures))
  const [defenseTeam, setDefenseTeam] = useState<
    [TeamSlot | null, TeamSlot | null, TeamSlot | null]
  >(() => hydrateTeamSlots(teams.defense, battleReadyCreatures))

  // Friendly battle state
  const [friendlySearch, setFriendlySearch] = useState('')
  const [friendlyResults, setFriendlyResults] = useState<
    Array<{ id: string; name: string; image: string | null }>
  >([])

  async function battleAction(
    body: Record<string, unknown>,
    key: string,
  ): Promise<Record<string, unknown> | null> {
    if (loading) return null
    setLoading(key)
    try {
      const res = await fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(
          (data as { error?: string }).error ?? 'Something went wrong',
        )
        return null
      }
      router.invalidate()
      return data as Record<string, unknown>
    } catch {
      toast.error('Network error')
      return null
    } finally {
      setLoading(null)
    }
  }

  async function handleSaveTeam(slot: 'offense' | 'defense') {
    const team = slot === 'offense' ? offenseTeam : defenseTeam
    const filled = team.filter(Boolean) as Array<TeamSlot>
    if (filled.length !== 3) {
      toast.error('Select 3 creatures for your team')
      return
    }
    await battleAction(
      {
        action: 'set_team',
        slot,
        members: filled.map((s) => ({
          userCreatureId: s.creature.id,
          row: s.row,
        })),
      },
      `save_${slot}`,
    )
  }

  async function handleDeleteTeam(slot: 'offense' | 'defense') {
    const result = await battleAction(
      { action: 'delete_team', slot },
      `delete_${slot}`,
    )
    if (result) {
      if (slot === 'offense') setOffenseTeam(EMPTY_TEAM)
      else setDefenseTeam(EMPTY_TEAM)
    }
  }

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

  async function handleArenaAttack(defenderId: string) {
    // Start transition immediately
    const opponent = opponents.find((o) => o.userId === defenderId)
    setTransitionPlayers({
      attackerName: userName,
      attackerImage: userImage,
      defenderName: opponent?.name ?? 'Opponent',
      defenderImage: opponent?.image ?? null,
    })
    setTransitionActive(true)
    setTransitionOutcome(null)

    const result = await battleAction(
      { action: 'arena_attack', defenderId },
      `arena:${defenderId}`,
    )
    if (result && result.battleId) {
      setTransitionOutcome({
        battleId: result.battleId as string,
        won: result.winnerId === userId ? true : result.winnerId ? false : null,
        ratingDelta:
          result.attackerDelta != null
            ? (result.attackerDelta as number)
            : null,
        mode: 'arena',
      })
    } else {
      // Error — dismiss transition
      setTransitionActive(false)
    }
  }

  async function handleFriendlySearch() {
    if (friendlySearch.length < 2) return
    const results = await searchUsers({
      data: { query: friendlySearch, excludeId: userId },
    })
    setFriendlyResults(results)
  }

  async function handleFriendlyBattle(defenderId: string) {
    // Start transition immediately
    const target = friendlyResults.find((u) => u.id === defenderId)
    setTransitionPlayers({
      attackerName: userName,
      attackerImage: userImage,
      defenderName: target?.name ?? 'Opponent',
      defenderImage: target?.image ?? null,
    })
    setTransitionActive(true)
    setTransitionOutcome(null)

    const result = await battleAction(
      { action: 'friendly_attack', defenderId },
      `friendly:${defenderId}`,
    )
    if (result && result.battleId) {
      setTransitionOutcome({
        battleId: result.battleId as string,
        won: result.winnerId === userId ? true : result.winnerId ? false : null,
        ratingDelta: null,
        mode: 'friendly',
      })
    } else {
      // Error — dismiss transition
      setTransitionActive(false)
    }
  }

  const handleBattleNavigate = useCallback(
    (battleId: string) => {
      setTransitionActive(false)
      router.navigate({
        to: '/battle/$id',
        params: { id: battleId },
      })
    },
    [router],
  )

  return (
    <>
      <BattleTransition
        active={transitionActive}
        players={transitionPlayers}
        outcome={transitionOutcome}
        onNavigate={handleBattleNavigate}
      />
      <Tabs defaultValue="arena">
        <TabsList variant="glass" className="w-full">
          <TabsTrigger value="arena" className="flex-1 gap-1.5">
            <Trophy className="h-4 w-4" />
            Arena
          </TabsTrigger>
          <TabsTrigger value="teams" className="flex-1 gap-1.5">
            <Shield className="h-4 w-4" />
            Teams
          </TabsTrigger>
          <TabsTrigger value="friendly" className="flex-1 gap-1.5">
            <Users className="h-4 w-4" />
            Friendly
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 gap-1.5">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* ── Arena Tab ──────────────────────────────── */}
        <TabsContent value="arena" className="space-y-4">
          {!teams.offense ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground/50">
              <Swords className="mb-3 h-8 w-8" />
              <p className="text-sm">Set your offense team first</p>
              <p className="mt-1 text-xs">
                Go to the Teams tab to configure your lineup.
              </p>
            </div>
          ) : (
            <>
              {/* Daily counter */}
              <div className="flex items-center justify-between rounded-xl border border-border bg-card/50 px-5 py-3">
                <div>
                  <p className="font-display text-sm font-semibold">
                    Arena Attacks
                  </p>
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
                  <h3 className="font-display text-sm font-semibold">
                    Opponents
                  </h3>
                  <Button
                    variant="outline"
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
                      Click &quot;Find Opponents&quot; to browse players near
                      your rating.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {opponents.map((o) => (
                      <OpponentCard
                        key={o.userId}
                        opponent={o}
                        onAttack={() => handleArenaAttack(o.userId)}
                        loading={loading === `arena:${o.userId}`}
                        disabled={
                          dailyLimit.remaining === 0 || loading !== null
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Teams Tab ──────────────────────────────── */}
        <TabsContent value="teams" className="space-y-6">
          {/* Offense Team */}
          <div className="rounded-xl border border-border bg-card/50 p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-semibold">
                  Offense Team
                </h3>
                <p className="text-xs text-muted-foreground">
                  Used when you attack in arena or friendly battles
                </p>
              </div>
              <div className="flex gap-2">
                {teams.offense && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTeam('offense')}
                    disabled={loading === 'delete_offense'}
                    className="text-red-400 hover:text-red-300"
                  >
                    Clear
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => handleSaveTeam('offense')}
                  disabled={
                    offenseTeam.filter(Boolean).length !== 3 ||
                    loading === 'save_offense'
                  }
                >
                  {loading === 'save_offense' ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
            <BattleTeamPicker
              creatures={battleReadyCreatures}
              value={offenseTeam}
              onChange={setOffenseTeam}
            />
          </div>

          {/* Defense Team */}
          <div className="rounded-xl border border-border bg-card/50 p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-semibold">
                  Defense Team
                </h3>
                <p className="text-xs text-muted-foreground">
                  Visible to opponents — they&apos;ll attack this team
                </p>
              </div>
              <div className="flex gap-2">
                {teams.defense && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTeam('defense')}
                    disabled={loading === 'delete_defense'}
                    className="text-red-400 hover:text-red-300"
                  >
                    Clear
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => handleSaveTeam('defense')}
                  disabled={
                    defenseTeam.filter(Boolean).length !== 3 ||
                    loading === 'save_defense'
                  }
                >
                  {loading === 'save_defense' ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
            <BattleTeamPicker
              creatures={battleReadyCreatures}
              value={defenseTeam}
              onChange={setDefenseTeam}
            />
          </div>
        </TabsContent>

        {/* ── Friendly Tab ───────────────────────────── */}
        <TabsContent value="friendly" className="space-y-4">
          {!teams.offense ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground/50">
              <Swords className="mb-3 h-8 w-8" />
              <p className="text-sm">Set your offense team first</p>
              <p className="mt-1 text-xs">
                Go to the Teams tab to configure your lineup.
              </p>
            </div>
          ) : (
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
                    onKeyDown={(e) =>
                      e.key === 'Enter' && handleFriendlySearch()
                    }
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
                            {u.name[0]}
                          </div>
                        )}
                        <span className="text-sm font-medium">{u.name}</span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleFriendlyBattle(u.id)}
                        disabled={loading === `friendly:${u.id}`}
                      >
                        <Swords className="mr-1.5 h-3.5 w-3.5" />
                        {loading === `friendly:${u.id}`
                          ? 'Battling...'
                          : 'Battle'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── History Tab ────────────────────────────── */}
        <TabsContent value="history" className="space-y-2">
          {history.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground/50">
              <History className="mb-3 h-8 w-8" />
              <p className="text-sm">No battle history yet</p>
            </div>
          ) : (
            history.map((b) => {
              const isAttacker = b.attackerId === userId
              const iWon = b.winnerId === userId
              const isDraw = !b.winnerId
              const opponentName = isAttacker ? b.defenderName : b.attackerName
              const opponentImage = isAttacker
                ? b.defenderImage
                : b.attackerImage

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
                        {opponentName[0]}
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
                        {b.ratingChange != null && (
                          <span
                            className={cn(
                              'font-medium',
                              b.ratingChange > 0
                                ? 'text-green-400'
                                : b.ratingChange < 0
                                  ? 'text-red-400'
                                  : '',
                            )}
                          >
                            {b.ratingChange > 0
                              ? `+${b.ratingChange}`
                              : b.ratingChange}
                          </span>
                        )}
                        {b.createdAt && (
                          <span>
                            {new Date(b.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })
          )}
        </TabsContent>
      </Tabs>
    </>
  )
}

// ── Helpers ───────────────────────────────────────────────────────

function hydrateTeamSlots(
  members: Array<{ userCreatureId: string; row: 'front' | 'back' }> | null,
  creatures: Array<BattleReadyCreature>,
): [TeamSlot | null, TeamSlot | null, TeamSlot | null] {
  if (!members) return [null, null, null]
  const slots: [TeamSlot | null, TeamSlot | null, TeamSlot | null] = [
    null,
    null,
    null,
  ]
  members.forEach((m, i) => {
    if (i >= 3) return
    const creature = creatures.find((c) => c.id === m.userCreatureId)
    if (creature) {
      slots[i] = { creature, row: m.row }
    }
  })
  return slots
}

// ── Opponent Card ─────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  striker: 'text-red-400',
  tank: 'text-blue-400',
  support: 'text-green-400',
  bruiser: 'text-orange-400',
}

function OpponentCard({
  opponent,
  onAttack,
  loading,
  disabled,
}: {
  opponent: ArenaOpponent
  onAttack: () => void
  loading: boolean
  disabled: boolean
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-muted/5 transition-colors hover:bg-muted/10">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {opponent.image ? (
            <img src={opponent.image} alt="" className="h-9 w-9 rounded-full" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/30 font-display text-sm font-bold">
              {opponent.name[0]}
            </div>
          )}
          <div>
            <p className="font-display text-sm font-semibold">
              {opponent.name}
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-primary">{opponent.tier}</span>
              <span className="mx-1 text-muted-foreground/30">|</span>
              {opponent.rating} Rating
            </p>
          </div>
        </div>
        <Button size="sm" onClick={onAttack} disabled={disabled}>
          <Swords className="mr-1.5 h-3.5 w-3.5" />
          {loading ? 'Attacking...' : 'Attack'}
        </Button>
      </div>

      {/* Defense team preview */}
      <div className="flex gap-2 border-t border-border/50 bg-muted/5 px-4 py-2.5">
        {opponent.defenseCreatures.map((c, i) => {
          const rarity = c.rarity as Rarity
          return (
            <div
              key={i}
              className={cn(
                'flex flex-1 items-center gap-2 rounded-lg border px-2 py-1.5',
                RARITY_BORDER[rarity],
              )}
            >
              {c.imageUrl ? (
                <img
                  src={c.imageUrl}
                  alt={c.name}
                  className="h-8 w-8 shrink-0 rounded object-contain"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted/20">
                  <IconFossil className="h-4 w-4 text-muted-foreground/20" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-display text-[11px] font-bold">
                  {c.name}
                </p>
                <div className="flex items-center gap-1">
                  <span
                    className={cn(
                      'text-[9px] font-semibold uppercase',
                      RARITY_COLORS[rarity],
                    )}
                  >
                    {rarity}
                  </span>
                  <span className="text-muted-foreground/30">&middot;</span>
                  <span
                    className={cn(
                      'text-[9px] font-semibold capitalize',
                      ROLE_COLOR[c.role] ?? 'text-muted-foreground',
                    )}
                  >
                    {c.role}
                  </span>
                  <span className="text-muted-foreground/30">&middot;</span>
                  <span className="text-[9px] capitalize text-muted-foreground/60">
                    {c.row}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
