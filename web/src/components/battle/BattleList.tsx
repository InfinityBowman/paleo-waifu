import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Check, History, Loader2, Shield, Trophy, Users } from 'lucide-react'
import { toast } from 'sonner'
import { BattleTeamPicker } from './BattleTeamPicker'
import { BattleTransition } from './BattleTransition'
import { ArenaTab } from './ArenaTab'
import { FriendlyTab } from './FriendlyTab'
import { BattleHistory } from './BattleHistory'
import type { BattleOutcome, BattlePlayers } from './BattleTransition'
import type { TeamSlot } from './BattleTeamPicker'
import type { BattleReadyCreature } from './BattleCreatureSlot'
import type { BattleLogItem } from './BattleHistory'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'

interface Teams {
  offense: Array<{ userCreatureId: string; row: 'front' | 'back' }> | null
  defense: Array<{ userCreatureId: string; row: 'front' | 'back' }> | null
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

function serializeTeam(
  team: [TeamSlot | null, TeamSlot | null, TeamSlot | null],
): string {
  return JSON.stringify(
    team.map((s) => (s ? { id: s.creature.id, row: s.row } : null)),
  )
}

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
  const [activeTab, setActiveTab] = useState('arena')
  const [loading, setLoading] = useState<string | null>(null)

  // Battle transition state
  const [transitionActive, setTransitionActive] = useState(false)
  const [transitionOutcome, setTransitionOutcome] =
    useState<BattleOutcome | null>(null)
  const [transitionPlayers, setTransitionPlayers] =
    useState<BattlePlayers | null>(null)

  // Teams state
  const [offenseTeam, setOffenseTeam] = useState<
    [TeamSlot | null, TeamSlot | null, TeamSlot | null]
  >(() => hydrateTeamSlots(teams.offense, battleReadyCreatures))
  const [defenseTeam, setDefenseTeam] = useState<
    [TeamSlot | null, TeamSlot | null, TeamSlot | null]
  >(() => hydrateTeamSlots(teams.defense, battleReadyCreatures))

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
      return data as Record<string, unknown>
    } catch {
      toast.error('Network error')
      return null
    } finally {
      setLoading(null)
    }
  }

  // Auto-save state
  const savedOffenseRef = useRef(serializeTeam(offenseTeam))
  const savedDefenseRef = useRef(serializeTeam(defenseTeam))
  const [offenseSaved, setOffenseSaved] = useState(!!teams.offense)
  const [defenseSaved, setDefenseSaved] = useState(!!teams.defense)
  const [savingOffense, setSavingOffense] = useState(false)
  const [savingDefense, setSavingDefense] = useState(false)

  // Auto-save offense team
  useEffect(() => {
    if (!offenseTeam.every(Boolean)) return
    const current = serializeTeam(offenseTeam)
    if (current === savedOffenseRef.current) return

    const timer = setTimeout(async () => {
      setSavingOffense(true)
      try {
        const members = (offenseTeam.filter(Boolean) as Array<TeamSlot>).map(
          (s) => ({ userCreatureId: s.creature.id, row: s.row }),
        )
        const res = await fetch('/api/battle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'set_team',
            slot: 'offense',
            members,
          }),
        })
        if (res.ok) {
          savedOffenseRef.current = current
          setOffenseSaved(true)
        } else {
          const data = await res.json()
          toast.error(
            (data as { error?: string }).error ?? 'Failed to save offense team',
          )
        }
      } catch {
        toast.error('Network error')
      } finally {
        setSavingOffense(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [offenseTeam])

  // Auto-save defense team
  useEffect(() => {
    if (!defenseTeam.every(Boolean)) return
    const current = serializeTeam(defenseTeam)
    if (current === savedDefenseRef.current) return

    const timer = setTimeout(async () => {
      setSavingDefense(true)
      try {
        const members = (defenseTeam.filter(Boolean) as Array<TeamSlot>).map(
          (s) => ({ userCreatureId: s.creature.id, row: s.row }),
        )
        const res = await fetch('/api/battle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'set_team',
            slot: 'defense',
            members,
          }),
        })
        if (res.ok) {
          savedDefenseRef.current = current
          setDefenseSaved(true)
        } else {
          const data = await res.json()
          toast.error(
            (data as { error?: string }).error ?? 'Failed to save defense team',
          )
        }
      } catch {
        toast.error('Network error')
      } finally {
        setSavingDefense(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [defenseTeam])

  async function handleDeleteTeam(slot: 'offense' | 'defense') {
    const setSaving = slot === 'offense' ? setSavingOffense : setSavingDefense
    setSaving(true)
    try {
      const res = await fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_team', slot }),
      })
      if (res.ok) {
        if (slot === 'offense') {
          setOffenseTeam(EMPTY_TEAM)
          savedOffenseRef.current = serializeTeam(EMPTY_TEAM)
          setOffenseSaved(false)
        } else {
          setDefenseTeam(EMPTY_TEAM)
          savedDefenseRef.current = serializeTeam(EMPTY_TEAM)
          setDefenseSaved(false)
        }
      } else {
        const data = await res.json()
        toast.error(
          (data as { error?: string }).error ?? 'Failed to clear team',
        )
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  function startTransition(defenderName: string, defenderImage: string | null) {
    setTransitionPlayers({
      attackerName: userName,
      attackerImage: userImage,
      defenderName,
      defenderImage,
    })
    setTransitionActive(true)
    setTransitionOutcome(null)
  }

  async function handleArenaAttack(defenderId: string) {
    startTransition('Opponent', null)
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
      setTransitionActive(false)
    }
  }

  async function handleFriendlyBattle(defenderId: string) {
    startTransition('Opponent', null)
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
      setTransitionActive(false)
    }
  }

  const handleBattleNavigate = useCallback(
    (battleId: string) => {
      setTransitionActive(false)
      router.invalidate()
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
      <Tabs value={activeTab} onValueChange={setActiveTab}>
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

        <TabsContent value="arena" className="space-y-4">
          <ArenaTab
            hasOffenseTeam={offenseSaved}
            onGoToTeams={() => setActiveTab('teams')}
            userId={userId}
            dailyLimit={dailyLimit}
            loading={loading}
            onArenaAttack={handleArenaAttack}
          />
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
              <div className="flex items-center gap-2">
                {savingOffense ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Saving
                  </span>
                ) : offenseTeam.every(Boolean) &&
                  serializeTeam(offenseTeam) === savedOffenseRef.current ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <Check className="h-3 w-3" />
                    Saved
                  </span>
                ) : null}
                {offenseSaved && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTeam('offense')}
                    disabled={savingOffense}
                    className="text-red-400 hover:text-red-300"
                  >
                    Clear
                  </Button>
                )}
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
              <div className="flex items-center gap-2">
                {savingDefense ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Saving
                  </span>
                ) : defenseTeam.every(Boolean) &&
                  serializeTeam(defenseTeam) === savedDefenseRef.current ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <Check className="h-3 w-3" />
                    Saved
                  </span>
                ) : null}
                {defenseSaved && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTeam('defense')}
                    disabled={savingDefense}
                    className="text-red-400 hover:text-red-300"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <BattleTeamPicker
              creatures={battleReadyCreatures}
              value={defenseTeam}
              onChange={setDefenseTeam}
            />
          </div>
        </TabsContent>

        <TabsContent value="friendly" className="space-y-4">
          <FriendlyTab
            hasOffenseTeam={offenseSaved}
            onGoToTeams={() => setActiveTab('teams')}
            userId={userId}
            loading={loading}
            onFriendlyBattle={handleFriendlyBattle}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-2">
          <BattleHistory history={history} userId={userId} />
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
