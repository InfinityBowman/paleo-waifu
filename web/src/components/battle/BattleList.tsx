import { useCallback, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { History, Shield, Trophy, Users } from 'lucide-react'
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

  function startTransition(
    defenderName: string,
    defenderImage: string | null,
  ) {
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

        <TabsContent value="arena" className="space-y-4">
          <ArenaTab
            hasOffenseTeam={!!teams.offense}
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

        <TabsContent value="friendly" className="space-y-4">
          <FriendlyTab
            hasOffenseTeam={!!teams.offense}
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
