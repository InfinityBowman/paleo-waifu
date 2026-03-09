import { useMemo, useState } from 'react'
import { Shuffle, Swords, Trophy } from 'lucide-react'
import { cn } from '../lib/utils'
import { runTeamBattle } from '../lib/api'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Card, CardContent } from './ui/card'
import { Input } from './ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import type {
  ConstantsOverride,
  CreatureOverridePatch,
  CreatureRecord,
  TeamBattleCreatureSlot,
  TeamBattleProgressEvent,
  TeamBattleResult,
} from '../../shared/types.ts'

const ROLE_COLORS: Record<string, string> = {
  striker: 'text-red-400',
  tank: 'text-blue-400',
  support: 'text-green-400',
  bruiser: 'text-amber-400',
}

interface SlotState {
  creatureId: string
  row: 'front' | 'back'
}

const EMPTY_SLOT: SlotState = { creatureId: '', row: 'front' }

type TeamState = [SlotState, SlotState, SlotState]

interface Props {
  creatures: Array<CreatureRecord>
  patches: Map<string, CreatureOverridePatch>
  constantsOverride: ConstantsOverride
  sharedOptions: {
    normalizeStats: boolean
    noActives: boolean
    noPassives: boolean
    syntheticMode: boolean
  }
}

export function BattlePanel({
  creatures,
  patches,
  constantsOverride,
  sharedOptions,
}: Props) {
  const [teamA, setTeamA] = useState<TeamState>([
    { ...EMPTY_SLOT },
    { ...EMPTY_SLOT },
    { ...EMPTY_SLOT },
  ])
  const [teamB, setTeamB] = useState<TeamState>([
    { ...EMPTY_SLOT },
    { ...EMPTY_SLOT },
    { ...EMPTY_SLOT },
  ])
  const [trials, setTrials] = useState(10)
  const [randomizeRows, setRandomizeRows] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{
    trial: number
    total: number
  } | null>(null)
  const [result, setResult] = useState<TeamBattleResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Group creatures by role for the select dropdown
  const creaturesByRole = useMemo(() => {
    const groups: Record<string, Array<CreatureRecord>> = {}
    // Filter out disabled creatures
    const enabled = creatures.filter((c) => {
      const patch = patches.get(c.id)
      return !patch?.disabled
    })
    for (const c of enabled) {
      const list = (groups[c.role] ??= [])
      list.push(c)
    }
    // Sort each group alphabetically
    for (const role of Object.keys(groups)) {
      groups[role].sort((a, b) => a.name.localeCompare(b.name))
    }
    return groups
  }, [creatures, patches])

  const creatureMap = useMemo(
    () => new Map(creatures.map((c) => [c.id, c])),
    [creatures],
  )

  const allSlotsValid =
    teamA.every((s) => s.creatureId) &&
    teamB.every((s) => s.creatureId) &&
    new Set(teamA.map((s) => s.creatureId)).size === 3 &&
    new Set(teamB.map((s) => s.creatureId)).size === 3

  function updateSlot(
    team: 'A' | 'B',
    index: number,
    update: Partial<SlotState>,
  ) {
    const setter = team === 'A' ? setTeamA : setTeamB
    setter((prev) => {
      const next = [...prev] as TeamState
      next[index] = { ...next[index], ...update }
      return next
    })
  }

  function randomizeAllRows() {
    const randomRow = (): 'front' | 'back' =>
      Math.random() < 0.5 ? 'front' : 'back'
    setTeamA((prev) => prev.map((s) => ({ ...s, row: randomRow() })) as TeamState)
    setTeamB((prev) => prev.map((s) => ({ ...s, row: randomRow() })) as TeamState)
  }

  async function handleRun() {
    if (!allSlotsValid) return
    setRunning(true)
    setResult(null)
    setError(null)
    setProgress(null)

    const request = {
      teamA: teamA.map((s) => ({
        creatureId: s.creatureId,
        row: s.row,
      })) as [TeamBattleCreatureSlot, TeamBattleCreatureSlot, TeamBattleCreatureSlot],
      teamB: teamB.map((s) => ({
        creatureId: s.creatureId,
        row: s.row,
      })) as [TeamBattleCreatureSlot, TeamBattleCreatureSlot, TeamBattleCreatureSlot],
      trials,
      randomizeRows,
      creaturePatches: [...patches.values()],
      constants: constantsOverride,
      options: sharedOptions,
    }

    try {
      await runTeamBattle(request, (event: TeamBattleProgressEvent) => {
        if (event.type === 'trial') {
          setProgress({ trial: event.trial, total: event.total })
        } else if (event.type === 'done') {
          setResult(event.result)
        } else {
          setError(event.message)
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Swords size={18} className="text-primary" />
        <h2 className="text-sm font-semibold">Team Battle</h2>
        <span className="text-xs text-muted-foreground">
          Pit two 3v3 teams against each other
        </span>
      </div>

      {/* Teams side by side */}
      <div className="grid grid-cols-2 gap-6">
        <TeamPicker
          label="Team A"
          team={teamA}
          creaturesByRole={creaturesByRole}
          creatureMap={creatureMap}
          randomizeRows={randomizeRows}
          onUpdate={(index, update) => updateSlot('A', index, update)}
        />
        <TeamPicker
          label="Team B"
          team={teamB}
          creaturesByRole={creaturesByRole}
          creatureMap={creatureMap}
          randomizeRows={randomizeRows}
          onUpdate={(index, update) => updateSlot('B', index, update)}
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Trials</label>
          <Input
            type="number"
            min={1}
            max={1000}
            value={trials}
            onChange={(e) =>
              setTrials(Math.max(1, Math.min(1000, Number(e.target.value))))
            }
            className="h-7 w-20 text-xs"
          />
        </div>

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={randomizeRows}
            onChange={(e) => setRandomizeRows(e.target.checked)}
            className="accent-primary"
          />
          Randomize rows each trial
        </label>

        {!randomizeRows && (
          <Button variant="ghost" size="xs" onClick={randomizeAllRows}>
            <Shuffle size={12} />
            Shuffle Rows
          </Button>
        )}

        <Button
          onClick={handleRun}
          disabled={!allSlotsValid || running}
          size="sm"
          className="ml-auto gap-1.5"
        >
          <Swords size={14} />
          {running
            ? `Running ${progress?.trial ?? 0}/${progress?.total ?? trials}...`
            : 'Fight'}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <BattleResults
          result={result}
          teamA={teamA}
          teamB={teamB}
          creatureMap={creatureMap}
        />
      )}
    </div>
  )
}

// ─── Team Picker ──────────────────────────────────────────────

function TeamPicker({
  label,
  team,
  creaturesByRole,
  creatureMap,
  randomizeRows,
  onUpdate,
}: {
  label: string
  team: TeamState
  creaturesByRole: Record<string, Array<CreatureRecord>>
  creatureMap: Map<string, CreatureRecord>
  randomizeRows: boolean
  onUpdate: (index: number, update: Partial<SlotState>) => void
}) {
  const roles = ['striker', 'bruiser', 'tank', 'support']

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <span className="text-xs font-medium">{label}</span>
        {team.map((slot, i) => {
          const creature = creatureMap.get(slot.creatureId)
          return (
            <div key={i} className="flex items-center gap-2">
              <Select
                value={slot.creatureId || undefined}
                onValueChange={(v) => onUpdate(i, { creatureId: v })}
              >
                <SelectTrigger size="sm" className="h-7 w-full text-xs">
                  <SelectValue placeholder="Select creature..." />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => {
                    const group = creaturesByRole[role]
                    if (!group?.length) return null
                    return (
                      <SelectGroup key={role}>
                        <SelectLabel className="capitalize">
                          {role}
                        </SelectLabel>
                        {group.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className={cn('capitalize', ROLE_COLORS[c.role])}>
                              {c.role[0]}
                            </span>
                            {' '}
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )
                  })}
                </SelectContent>
              </Select>

              {/* Row toggle */}
              {!randomizeRows && (
                <div className="flex rounded-md border border-border text-[10px]">
                  <button
                    onClick={() => onUpdate(i, { row: 'front' })}
                    className={cn(
                      'px-1.5 py-0.5 transition-colors',
                      slot.row === 'front'
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    F
                  </button>
                  <button
                    onClick={() => onUpdate(i, { row: 'back' })}
                    className={cn(
                      'px-1.5 py-0.5 transition-colors',
                      slot.row === 'back'
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    B
                  </button>
                </div>
              )}

              {/* Stat preview */}
              {creature && (
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {creature.hp}/{creature.atk}/{creature.def}/{creature.spd}
                </span>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ─── Battle Results ───────────────────────────────────────────

function BattleResults({
  result,
  teamA,
  teamB,
  creatureMap,
}: {
  result: TeamBattleResult
  teamA: TeamState
  teamB: TeamState
  creatureMap: Map<string, CreatureRecord>
}) {
  const teamANames = teamA
    .map((s) => creatureMap.get(s.creatureId)?.name ?? '?')
    .join(', ')
  const teamBNames = teamB
    .map((s) => creatureMap.get(s.creatureId)?.name ?? '?')
    .join(', ')

  const total = result.winsA + result.winsB + result.draws
  const barWidthA = total > 0 ? (result.winsA / total) * 100 : 0
  const barWidthB = total > 0 ? (result.winsB / total) * 100 : 0
  const barWidthDraw = total > 0 ? (result.draws / total) * 100 : 0

  const winner =
    result.winsA > result.winsB
      ? 'A'
      : result.winsB > result.winsA
        ? 'B'
        : 'draw'

  return (
    <div className="flex flex-col gap-4">
      {/* Summary card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy
                size={14}
                className={cn(
                  winner === 'A'
                    ? 'text-blue-400'
                    : winner === 'B'
                      ? 'text-red-400'
                      : 'text-muted-foreground',
                )}
              />
              <span className="text-sm font-medium">
                {winner === 'draw'
                  ? 'Draw!'
                  : `Team ${winner} wins`}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {total} trials | Avg {result.avgTurns.toFixed(1)} turns
            </span>
          </div>

          {/* Win rate bar */}
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-mono w-12 text-right text-blue-400">
              {result.winsA}
            </span>
            <div className="flex h-4 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="bg-blue-500 transition-all"
                style={{ width: `${barWidthA}%` }}
              />
              <div
                className="bg-muted-foreground/30 transition-all"
                style={{ width: `${barWidthDraw}%` }}
              />
              <div
                className="bg-red-500 transition-all"
                style={{ width: `${barWidthB}%` }}
              />
            </div>
            <span className="text-xs font-mono w-12 text-red-400">
              {result.winsB}
            </span>
          </div>

          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>A: {teamANames}</span>
            {result.draws > 0 && (
              <span>{result.draws} draw{result.draws !== 1 ? 's' : ''}</span>
            )}
            <span>B: {teamBNames}</span>
          </div>
        </CardContent>
      </Card>

      {/* Per-trial breakdown */}
      <div>
        <span className="text-xs font-medium mb-2 block">Trial Log</span>
        <div className="grid grid-cols-1 gap-1">
          {result.trials.map((trial) => (
            <div
              key={trial.trial}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-1.5 text-xs',
                trial.winner === 'A'
                  ? 'bg-blue-500/10'
                  : trial.winner === 'B'
                    ? 'bg-red-500/10'
                    : 'bg-muted',
              )}
            >
              <span className="w-8 text-muted-foreground font-mono">
                #{trial.trial}
              </span>
              <Badge
                variant={
                  trial.winner === 'A'
                    ? 'default'
                    : trial.winner === 'B'
                      ? 'destructive'
                      : 'secondary'
                }
                className="text-[10px] px-1.5 py-0"
              >
                {trial.winner ? `Team ${trial.winner}` : 'Draw'}
              </Badge>
              <span className="text-muted-foreground">
                {trial.turns} turns
              </span>
              <span className="ml-auto text-muted-foreground font-mono">
                <span className="text-blue-400">
                  {trial.teamAHpPercent.toFixed(0)}%
                </span>
                {' vs '}
                <span className="text-red-400">
                  {trial.teamBHpPercent.toFixed(0)}%
                </span>
                {' HP'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
