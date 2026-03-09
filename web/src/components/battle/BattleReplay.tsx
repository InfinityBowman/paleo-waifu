import { useState } from 'react'
import { ChevronDown, ChevronRight, Trophy } from 'lucide-react'
import type { Rarity } from '@paleo-waifu/shared/types'
import type {
  BattleLogEvent,
  BattleResult,
} from '@paleo-waifu/shared/battle/types'
import { RARITY_BORDER } from '@/lib/rarity-styles'

interface ChallengeInfo {
  id: string
  challengerName: string
  challengerImage: string | null
  defenderName: string
  defenderImage: string | null
  winnerId: string | null
  challengerId: string
  defenderId: string
  status: string
  createdAt: Date | null
  resolvedAt: Date | null
}

interface TeamCreature {
  name: string
  rarity: string
  role: string
  imageUrl: string | null
  row: string
}

interface BattleReplayProps {
  challenge: ChallengeInfo
  result: BattleResult | null
  teamA: Array<TeamCreature>
  teamB: Array<TeamCreature>
  ratings: {
    challenger: { rating: number; tier: string }
    defender: { rating: number; tier: string }
  }
}

function HpBar({ current, max }: { current: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100))
  const color =
    pct > 60 ? 'bg-green-500' : pct > 30 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function TeamDisplay({
  label,
  creatures,
  isWinner,
  finalState,
}: {
  label: string
  creatures: Array<TeamCreature>
  isWinner: boolean
  finalState?: Array<{ currentHp: number; maxHp: number; name: string }>
}) {
  return (
    <div className="flex-1">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-semibold">{label}</h3>
        {isWinner && <Trophy className="h-4 w-4 text-amber-400" />}
      </div>
      <div className="space-y-2">
        {creatures.map((c, i) => {
          const rarity = c.rarity as Rarity
          const state = finalState?.[i]
          return (
            <div
              key={i}
              className={`rounded-lg border p-2 ${RARITY_BORDER[rarity]}`}
            >
              <div className="flex items-center gap-2">
                {c.imageUrl ? (
                  <img
                    src={c.imageUrl}
                    alt={c.name}
                    className="h-8 w-8 rounded object-contain"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-muted/30 text-sm">
                    🦴
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-[10px] capitalize text-muted-foreground">
                    {c.role} &middot; {c.row}
                  </p>
                </div>
              </div>
              {state && (
                <div className="mt-1">
                  <HpBar current={state.currentHp} max={state.maxHp} />
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {state.currentHp}/{state.maxHp} HP
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatEvent(event: BattleLogEvent): string | null {
  switch (event.type) {
    case 'creature_action':
      return `${event.creatureName} uses ${event.abilityName}`
    case 'damage':
      if (event.isDodged) return `  → Dodged!`
      return `  → ${event.amount} damage${event.isCrit ? ' (CRIT!)' : ''}`
    case 'heal':
      return `  → Heals for ${event.amount}`
    case 'ko':
      return `  💀 ${event.creatureName} is KO'd!`
    case 'status_applied':
      return `  → ${event.effect.kind} applied`
    case 'stun_skip':
      return `  ⚡ Stunned — skips turn`
    case 'synergy_applied':
      return `Synergy: ${event.synergy.description}`
    case 'battle_end':
      return event.winner
        ? `Battle ends in ${event.turns} turns`
        : `Battle ends in a draw after ${event.turns} turns`
    default:
      return null
  }
}

export function BattleReplay({
  challenge,
  result,
  teamA,
  teamB,
  ratings,
}: BattleReplayProps) {
  const [showFullLog, setShowFullLog] = useState(false)

  const isResolved = challenge.status === 'resolved' && result
  const challengerWon = challenge.winnerId === challenge.challengerId
  const defenderWon = challenge.winnerId === challenge.defenderId

  // Key moments: KOs, crits, synergies, battle end
  const keyMoments = result?.log.filter(
    (e) =>
      e.type === 'ko' ||
      e.type === 'synergy_applied' ||
      e.type === 'battle_end' ||
      (e.type === 'damage' && e.isCrit && e.amount > 0),
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
        <h1 className="font-display text-2xl font-bold">
          {challenge.challengerName} vs {challenge.defenderName}
        </h1>
        {isResolved && (
          <>
            <p className="mt-2 text-lg font-semibold text-amber-400">
              {challengerWon
                ? `${challenge.challengerName} wins!`
                : defenderWon
                  ? `${challenge.defenderName} wins!`
                  : 'Draw!'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {result.turns} turns &middot;{' '}
              {result.reason === 'ko' ? 'By KO' : 'By timeout'}
            </p>
          </>
        )}
        {!isResolved && (
          <p className="mt-2 text-sm capitalize text-muted-foreground">
            {challenge.status}
          </p>
        )}
        <div className="mt-3 flex justify-center gap-6 text-sm text-muted-foreground">
          <span>
            {challenge.challengerName}: {ratings.challenger.rating}{' '}
            {ratings.challenger.tier}
          </span>
          <span>
            {challenge.defenderName}: {ratings.defender.rating}{' '}
            {ratings.defender.tier}
          </span>
        </div>
      </div>

      {/* Teams */}
      <div className="flex gap-4">
        <TeamDisplay
          label={challenge.challengerName}
          creatures={teamA}
          isWinner={challengerWon}
          finalState={result?.finalState.teamA.map((c) => ({
            currentHp: c.currentHp,
            maxHp: c.maxHp,
            name: c.name,
          }))}
        />
        <div className="flex items-center px-2 text-lg font-bold text-muted-foreground">
          VS
        </div>
        <TeamDisplay
          label={challenge.defenderName}
          creatures={teamB}
          isWinner={defenderWon}
          finalState={result?.finalState.teamB.map((c) => ({
            currentHp: c.currentHp,
            maxHp: c.maxHp,
            name: c.name,
          }))}
        />
      </div>

      {/* Key Moments */}
      {keyMoments && keyMoments.length > 0 && (
        <div>
          <h2 className="mb-2 font-display text-lg font-semibold">
            Key Moments
          </h2>
          <div className="space-y-1 rounded-lg border border-border bg-card p-3">
            {keyMoments.map((event, i) => {
              const text = formatEvent(event)
              if (!text) return null
              return (
                <p key={i} className="text-sm">
                  {'turn' in event && (
                    <span className="mr-2 text-muted-foreground">
                      T{event.turn}
                    </span>
                  )}
                  {text}
                </p>
              )
            })}
          </div>
        </div>
      )}

      {/* Full Log */}
      {result && (
        <div>
          <button
            onClick={() => setShowFullLog(!showFullLog)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            {showFullLog ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Full Battle Log
          </button>
          {showFullLog && (
            <div className="mt-2 max-h-96 space-y-0.5 overflow-y-auto rounded-lg border border-border bg-card p-3 font-mono text-xs">
              {result.log.map((event, i) => {
                const text = formatEvent(event)
                if (!text) return null
                const isKo = event.type === 'ko'
                const isCrit =
                  event.type === 'damage' && event.isCrit && !event.isDodged
                return (
                  <p
                    key={i}
                    className={
                      isKo
                        ? 'font-bold text-red-400'
                        : isCrit
                          ? 'text-amber-400'
                          : 'text-muted-foreground'
                    }
                  >
                    {'turn' in event && (
                      <span className="mr-2 text-muted-foreground/50">
                        [{event.turn}]
                      </span>
                    )}
                    {text}
                  </p>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
