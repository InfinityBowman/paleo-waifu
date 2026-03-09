import { useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { History, Pencil, Plus, Shield, Swords, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { BattleTeamPicker } from './BattleTeamPicker'
import type { TeamSlot } from './BattleTeamPicker'
import type { BattleReadyCreature } from './BattleCreatureSlot'
import { IconMagnifyingGlass } from '@/components/icons'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { searchUsers } from '@/routes/_app/battle'

interface ChallengeItem {
  id: string
  challengerId: string
  challengerName: string
  challengerImage: string | null
  defenderId: string
  defenderName: string
  defenderImage: string | null
  status: string
  winnerId: string | null
  createdAt: Date | null
  resolvedAt: Date | null
}

interface PresetItem {
  id: string
  name: string
  members: Array<{ userCreatureId: string; row: 'front' | 'back' }>
  createdAt: Date | null
  updatedAt: Date | null
}

interface BattleListProps {
  incoming: Array<ChallengeItem>
  outgoing: Array<ChallengeItem>
  history: Array<ChallengeItem>
  presets: Array<PresetItem>
  battleReadyCreatures: Array<BattleReadyCreature>
  userId: string
}

const EMPTY_TEAM: [TeamSlot | null, TeamSlot | null, TeamSlot | null] = [
  null,
  null,
  null,
]

export function BattleList({
  incoming,
  outgoing,
  history,
  presets,
  battleReadyCreatures,
  userId,
}: BattleListProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  // Challenge tab state
  const [opponentSearch, setOpponentSearch] = useState('')
  const [searchResults, setSearchResults] = useState<
    Array<{ id: string; name: string; image: string | null }>
  >([])
  const [selectedOpponent, setSelectedOpponent] = useState<{
    id: string
    name: string
  } | null>(null)
  const [challengeTeam, setChallengeTeam] =
    useState<[TeamSlot | null, TeamSlot | null, TeamSlot | null]>(EMPTY_TEAM)

  // Accept dialog state
  const [acceptingChallengeId, setAcceptingChallengeId] = useState<
    string | null
  >(null)
  const [acceptTeam, setAcceptTeam] =
    useState<[TeamSlot | null, TeamSlot | null, TeamSlot | null]>(EMPTY_TEAM)

  // Preset dialog state
  const [presetDialogOpen, setPresetDialogOpen] = useState(false)
  const [editingPreset, setEditingPreset] = useState<PresetItem | null>(null)
  const [presetName, setPresetName] = useState('')
  const [presetTeam, setPresetTeam] =
    useState<[TeamSlot | null, TeamSlot | null, TeamSlot | null]>(EMPTY_TEAM)

  async function battleAction(
    body: Record<string, unknown>,
    key: string,
  ): Promise<boolean> {
    if (loading) return false
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
        return false
      }
      router.invalidate()
      return true
    } catch {
      toast.error('Network error')
      return false
    } finally {
      setLoading(null)
    }
  }

  async function handleSearchUsers() {
    if (opponentSearch.length < 2) return
    const results = await searchUsers({
      data: { query: opponentSearch, excludeId: userId },
    })
    setSearchResults(results)
  }

  async function handleChallenge() {
    if (!selectedOpponent) return
    const filled = challengeTeam.filter(Boolean) as Array<TeamSlot>
    if (filled.length !== 3) {
      toast.error('Select 3 creatures for your team')
      return
    }
    const success = await battleAction(
      {
        action: 'challenge',
        defenderId: selectedOpponent.id,
        team: filled.map((s) => ({
          userCreatureId: s.creature.id,
          row: s.row,
        })),
      },
      'challenge',
    )
    if (success) {
      setChallengeTeam(EMPTY_TEAM)
      setSelectedOpponent(null)
      setOpponentSearch('')
      setSearchResults([])
    }
  }

  async function handleAccept(challengeId: string) {
    const filled = acceptTeam.filter(Boolean) as Array<TeamSlot>
    if (filled.length !== 3) {
      toast.error('Select 3 creatures for your team')
      return
    }
    const success = await battleAction(
      {
        action: 'accept',
        challengeId,
        team: filled.map((s) => ({
          userCreatureId: s.creature.id,
          row: s.row,
        })),
      },
      `accept:${challengeId}`,
    )
    if (success) {
      setAcceptingChallengeId(null)
      setAcceptTeam(EMPTY_TEAM)
    }
  }

  async function handleSavePreset() {
    if (!presetName.trim()) {
      toast.error('Enter a name for your preset')
      return
    }
    const filled = presetTeam.filter(Boolean) as Array<TeamSlot>
    if (filled.length !== 3) {
      toast.error('Select 3 creatures')
      return
    }

    const action = editingPreset ? 'update_preset' : 'save_preset'
    const body: Record<string, unknown> = {
      action,
      name: presetName.trim(),
      members: filled.map((s) => ({
        userCreatureId: s.creature.id,
        row: s.row,
      })),
    }
    if (editingPreset) body.presetId = editingPreset.id

    const success = await battleAction(body, 'preset')
    if (success) {
      setPresetDialogOpen(false)
      setEditingPreset(null)
      setPresetName('')
      setPresetTeam(EMPTY_TEAM)
    }
  }

  function loadPreset(preset: PresetItem) {
    const slots: [TeamSlot | null, TeamSlot | null, TeamSlot | null] = [
      null,
      null,
      null,
    ]
    preset.members.forEach((m, i) => {
      if (i >= 3) return
      const creature = battleReadyCreatures.find(
        (c) => c.id === m.userCreatureId,
      )
      if (creature) {
        slots[i] = { creature, row: m.row }
      }
    })
    return slots
  }

  return (
    <Tabs defaultValue="challenge">
      <TabsList variant="glass" className="w-full">
        <TabsTrigger value="challenge" className="flex-1 gap-1.5">
          <Swords className="h-4 w-4" />
          Challenge
          {outgoing.length > 0 && (
            <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 text-xs font-semibold text-amber-400">
              {outgoing.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="incoming" className="flex-1 gap-1.5">
          <Shield className="h-4 w-4" />
          Incoming
          {incoming.length > 0 && (
            <span className="ml-1 rounded-full bg-red-500/20 px-1.5 text-xs font-semibold text-red-400">
              {incoming.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="history" className="flex-1 gap-1.5">
          <History className="h-4 w-4" />
          History
        </TabsTrigger>
      </TabsList>

      {/* ── Challenge Tab ────────────────────────────── */}
      <TabsContent value="challenge" className="space-y-6">
        {/* Opponent Search */}
        <div className="rounded-xl border border-border bg-card/50 p-5">
          <h3 className="mb-3 font-display text-sm font-semibold">
            Find Opponent
          </h3>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <IconMagnifyingGlass className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by username..."
                value={opponentSearch}
                onChange={(e) => setOpponentSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleSearchUsers}
              disabled={opponentSearch.length < 2}
            >
              Search
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-3 space-y-1 rounded-lg border border-border/50 bg-muted/10 p-1">
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setSelectedOpponent(u)
                    setSearchResults([])
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    selectedOpponent?.id === u.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted/30'
                  }`}
                >
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
                  <span className="font-medium">{u.name}</span>
                </button>
              ))}
            </div>
          )}
          {selectedOpponent && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-primary/8 px-3 py-2 text-sm">
              <Swords className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">Challenging</span>
              <span className="font-display font-semibold text-primary">
                {selectedOpponent.name}
              </span>
            </div>
          )}
        </div>

        {/* Team Picker */}
        <div className="rounded-xl border border-border bg-card/50 p-5">
          <h3 className="mb-3 font-display text-sm font-semibold">
            Your Team
          </h3>
          <BattleTeamPicker
            creatures={battleReadyCreatures}
            value={challengeTeam}
            onChange={setChallengeTeam}
          />
          <Button
            className="mt-4 w-full"
            onClick={handleChallenge}
            disabled={
              !selectedOpponent ||
              challengeTeam.filter(Boolean).length !== 3 ||
              loading === 'challenge'
            }
          >
            <Swords className="mr-2 h-4 w-4" />
            {loading === 'challenge' ? 'Sending...' : 'Send Challenge'}
          </Button>
        </div>

        {/* Team Presets */}
        <div className="rounded-xl border border-border bg-card/50 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold">
              Team Presets
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingPreset(null)
                setPresetName('')
                setPresetTeam(EMPTY_TEAM)
                setPresetDialogOpen(true)
              }}
            >
              <Plus className="mr-1 h-3 w-3" />
              New
            </Button>
          </div>
          {presets.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground/60">
              Save a team preset to quickly load it for battles.
            </p>
          ) : (
            <div className="space-y-2">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/10 px-4 py-2.5 transition-colors hover:bg-muted/20"
                >
                  <div>
                    <p className="font-display text-sm font-medium">
                      {preset.name}
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      {preset.members.length} creatures
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setChallengeTeam(loadPreset(preset))
                      }}
                    >
                      Load
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingPreset(preset)
                        setPresetName(preset.name)
                        setPresetTeam(loadPreset(preset))
                        setPresetDialogOpen(true)
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-3 w-3 text-red-400" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete preset?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete &quot;{preset.name}
                            &quot;.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              battleAction(
                                {
                                  action: 'delete_preset',
                                  presetId: preset.id,
                                },
                                `delete:${preset.id}`,
                              )
                            }
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Outgoing Challenges */}
        {outgoing.length > 0 && (
          <div>
            <h3 className="mb-2 font-display text-sm font-semibold text-muted-foreground">
              Pending Outgoing
            </h3>
            <div className="space-y-2">
              {outgoing.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3"
                >
                  <div>
                    <p className="text-sm">
                      You challenged{' '}
                      <span className="font-display font-semibold">
                        {c.defenderName}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      {c.createdAt
                        ? new Date(c.createdAt).toLocaleDateString()
                        : ''}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      battleAction(
                        { action: 'cancel', challengeId: c.id },
                        `cancel:${c.id}`,
                      )
                    }
                    disabled={loading === `cancel:${c.id}`}
                  >
                    Cancel
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </TabsContent>

      {/* ── Incoming Tab ─────────────────────────────── */}
      <TabsContent value="incoming" className="space-y-3">
        {incoming.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-muted-foreground/50">
            <Shield className="mb-3 h-8 w-8" />
            <p className="text-sm">No pending challenges</p>
          </div>
        ) : (
          incoming.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {c.challengerImage ? (
                  <img
                    src={c.challengerImage}
                    alt=""
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/30 text-xs font-medium">
                    {c.challengerName[0]}
                  </div>
                )}
                <div>
                  <p className="text-sm">
                    <span className="font-display font-semibold">
                      {c.challengerName}
                    </span>{' '}
                    challenges you!
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    {c.createdAt
                      ? new Date(c.createdAt).toLocaleDateString()
                      : ''}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setAcceptingChallengeId(c.id)
                    setAcceptTeam(EMPTY_TEAM)
                  }}
                >
                  <Swords className="mr-1.5 h-3.5 w-3.5" />
                  Accept
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    battleAction(
                      { action: 'decline', challengeId: c.id },
                      `decline:${c.id}`,
                    )
                  }
                  disabled={loading === `decline:${c.id}`}
                >
                  Decline
                </Button>
              </div>
            </div>
          ))
        )}
      </TabsContent>

      {/* ── History Tab ──────────────────────────────── */}
      <TabsContent value="history" className="space-y-2">
        {history.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-muted-foreground/50">
            <History className="mb-3 h-8 w-8" />
            <p className="text-sm">No battle history yet</p>
          </div>
        ) : (
          history.map((c) => {
            const iWon = c.winnerId === userId
            const isDraw = !c.winnerId && c.status === 'resolved'
            const opponentName =
              c.challengerId === userId ? c.defenderName : c.challengerName
            const opponentImage =
              c.challengerId === userId ? c.defenderImage : c.challengerImage
            return (
              <Link
                key={c.id}
                to="/battle/$id"
                params={{ id: c.id }}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:bg-muted/10 ${
                  c.status === 'resolved'
                    ? iWon
                      ? 'border-green-500/20 bg-green-500/5'
                      : isDraw
                        ? 'border-border bg-muted/5'
                        : 'border-red-500/20 bg-red-500/5'
                    : 'border-border bg-muted/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  {c.status === 'resolved' && (
                    <span
                      className={`font-display text-xs font-bold ${
                        iWon
                          ? 'text-green-400'
                          : isDraw
                            ? 'text-muted-foreground'
                            : 'text-red-400'
                      }`}
                    >
                      {iWon ? 'WIN' : isDraw ? 'DRAW' : 'LOSS'}
                    </span>
                  )}
                  {c.status !== 'resolved' && (
                    <span className="text-xs capitalize text-muted-foreground/60">
                      {c.status}
                    </span>
                  )}
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
                    <p className="text-xs text-muted-foreground/60">
                      {c.resolvedAt
                        ? new Date(c.resolvedAt).toLocaleDateString()
                        : c.createdAt
                          ? new Date(c.createdAt).toLocaleDateString()
                          : ''}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </TabsContent>

      {/* ── Accept Dialog ────────────────────────────── */}
      <Dialog
        open={acceptingChallengeId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAcceptingChallengeId(null)
            setAcceptTeam(EMPTY_TEAM)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Pick Your Team</DialogTitle>
            <DialogDescription>
              Choose 3 creatures to battle with
            </DialogDescription>
          </DialogHeader>
          <BattleTeamPicker
            creatures={battleReadyCreatures}
            value={acceptTeam}
            onChange={setAcceptTeam}
          />
          {/* Quick-load from presets */}
          {presets.length > 0 && (
            <div className="rounded-lg border border-border/50 bg-muted/10 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground/60">
                Quick load preset
              </p>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p) => (
                  <Button
                    key={p.id}
                    variant="outline"
                    size="sm"
                    onClick={() => setAcceptTeam(loadPreset(p))}
                    className="text-xs"
                  >
                    {p.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <Button
            className="mt-2 w-full"
            onClick={() =>
              acceptingChallengeId && handleAccept(acceptingChallengeId)
            }
            disabled={
              acceptTeam.filter(Boolean).length !== 3 ||
              loading?.startsWith('accept:')
            }
          >
            <Swords className="mr-2 h-4 w-4" />
            {loading?.startsWith('accept:')
              ? 'Battling...'
              : 'Accept & Battle!'}
          </Button>
        </DialogContent>
      </Dialog>

      {/* ── Preset Dialog ────────────────────────────── */}
      <Dialog
        open={presetDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPresetDialogOpen(false)
            setEditingPreset(null)
            setPresetName('')
            setPresetTeam(EMPTY_TEAM)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingPreset ? 'Edit Preset' : 'New Preset'}
            </DialogTitle>
            <DialogDescription>
              Save a team composition for quick access
            </DialogDescription>
          </DialogHeader>
          <div>
            <Input
              placeholder="Preset name (required)"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className={
                !presetName.trim() && presetTeam.some(Boolean)
                  ? 'border-red-500/50'
                  : ''
              }
            />
            {!presetName.trim() && presetTeam.some(Boolean) && (
              <p className="mt-1 text-xs text-red-400">
                Give your preset a name to save it
              </p>
            )}
          </div>
          <BattleTeamPicker
            creatures={battleReadyCreatures}
            value={presetTeam}
            onChange={setPresetTeam}
          />
          <Button
            className="mt-2 w-full"
            onClick={handleSavePreset}
            disabled={
              presetTeam.filter(Boolean).length !== 3 ||
              !presetName.trim() ||
              loading === 'preset'
            }
          >
            {loading === 'preset' ? 'Saving...' : 'Save Preset'}
          </Button>
        </DialogContent>
      </Dialog>
    </Tabs>
  )
}
