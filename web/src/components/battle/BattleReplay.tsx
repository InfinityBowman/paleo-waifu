import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Trophy,
  Zap,
} from 'lucide-react'
import type { Rarity } from '@paleo-waifu/shared/types'
import type {
  BattleLogEvent,
  BattleResult,
} from '@paleo-waifu/shared/battle/types'
import { IconFossil } from '@/components/icons'
import { cn } from '@/lib/utils'
import { RARITY_BG, RARITY_BORDER, RARITY_COLORS } from '@/lib/rarity-styles'

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

const ROLE_COLOR: Record<string, string> = {
  striker: 'text-red-400',
  tank: 'text-blue-400',
  support: 'text-green-400',
  bruiser: 'text-orange-400',
}

function HpBar({ current, max }: { current: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100))
  const color =
    pct > 60 ? 'bg-green-500' : pct > 30 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
      <div
        className={cn('h-full rounded-full transition-all', color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function PlayerBadge({
  name,
  image,
  rating,
  tier,
  isWinner,
  side,
}: {
  name: string
  image: string | null
  rating: number
  tier: string
  isWinner: boolean
  side: 'left' | 'right'
}) {
  return (
    <div
      className={cn(
        'flex flex-1 items-center gap-3',
        side === 'right' && 'flex-row-reverse text-right',
      )}
    >
      <div className="relative">
        {image ? (
          <img src={image} alt={name} className="h-12 w-12 rounded-full" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/30 font-display text-lg font-bold">
            {name[0]}
          </div>
        )}
        {isWinner && (
          <div className="absolute -bottom-1 -right-1 rounded-full bg-amber-500 p-0.5">
            <Trophy className="h-3 w-3 text-black" />
          </div>
        )}
      </div>
      <div>
        <p className="font-display text-lg font-bold">{name}</p>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-primary">{tier}</span>
          <span className="mx-1 text-muted-foreground/30">|</span>
          {rating} Rating
        </p>
      </div>
    </div>
  )
}

function TeamDisplay({
  creatures,
  finalState,
}: {
  creatures: Array<TeamCreature>
  finalState?: Array<{ currentHp: number; maxHp: number; name: string }>
}) {
  return (
    <div className="flex-1 space-y-2">
      {creatures.map((c, i) => {
        const rarity = c.rarity as Rarity
        const state = finalState?.[i]
        const isAlive = state ? state.currentHp > 0 : true
        return (
          <div
            key={i}
            className={cn(
              'overflow-hidden rounded-xl border-2',
              RARITY_BORDER[rarity],
              RARITY_BG[rarity],
              !isAlive && 'opacity-50',
            )}
          >
            <div className="flex items-center gap-3 p-2.5">
              <div className="relative shrink-0">
                {c.imageUrl ? (
                  <img
                    src={c.imageUrl}
                    alt={c.name}
                    className="h-12 w-12 rounded-lg object-contain"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted/20">
                    <IconFossil className="h-6 w-6 text-muted-foreground/20" />
                  </div>
                )}
                {!isAlive && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40">
                    <Skull className="h-5 w-5 text-red-400" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm font-bold">
                  {c.name}
                </p>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'font-display text-[10px] font-semibold uppercase',
                      RARITY_COLORS[rarity],
                    )}
                  >
                    {rarity}
                  </span>
                  <span className="text-muted-foreground/30">&middot;</span>
                  <span
                    className={cn(
                      'text-[10px] font-semibold capitalize',
                      ROLE_COLOR[c.role] ?? 'text-muted-foreground',
                    )}
                  >
                    {c.role}
                  </span>
                  <span className="text-muted-foreground/30">&middot;</span>
                  <span className="text-[10px] capitalize text-muted-foreground/60">
                    {c.row}
                  </span>
                </div>
                {state && (
                  <div className="mt-1.5">
                    <HpBar current={state.currentHp} max={state.maxHp} />
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {state.currentHp}/{state.maxHp} HP
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function formatEvent(event: BattleLogEvent): string | null {
  switch (event.type) {
    case 'creature_action':
      return `${event.creatureName} uses ${event.abilityName}`
    case 'damage':
      if (event.isDodged) return `Dodged!`
      return `${event.amount} damage${event.isCrit ? ' (CRIT!)' : ''}`
    case 'heal':
      return `Heals for ${event.amount}`
    case 'ko':
      return `${event.creatureName} is KO'd!`
    case 'status_applied':
      return `${event.effect.kind} applied${event.effect.turnsRemaining ? ` (${event.effect.turnsRemaining}t)` : ''}`
    case 'status_tick':
      return event.damage > 0
        ? `${event.kind} deals ${event.damage}`
        : `${event.kind} heals ${Math.abs(event.damage)}`
    case 'stun_skip':
      return `Stunned — skips turn`
    case 'shield_absorbed':
      return `Shield absorbs ${event.absorbed} (${event.remaining} left)`
    case 'reflect_damage':
      return `Reflects ${event.amount} damage`
    case 'passive_trigger':
      return `${event.description}`
    case 'synergy_applied':
      return `${event.synergy.description}`
    case 'battle_end':
      return event.winner
        ? `Battle ends in ${event.turns} turns`
        : `Draw after ${event.turns} turns`
    default:
      return null
  }
}

function eventIcon(event: BattleLogEvent) {
  switch (event.type) {
    case 'creature_action':
      return <Zap className="h-3 w-3 text-amber-400" />
    case 'damage':
      return event.isDodged ? (
        <Shield className="h-3 w-3 text-blue-400" />
      ) : (
        <Swords className="h-3 w-3 text-red-400" />
      )
    case 'heal':
      return <Sparkles className="h-3 w-3 text-green-400" />
    case 'ko':
      return <Skull className="h-3 w-3 text-red-500" />
    case 'synergy_applied':
      return <Sparkles className="h-3 w-3 text-amber-400" />
    case 'passive_trigger':
      return <Shield className="h-3 w-3 text-purple-400" />
    default:
      return null
  }
}

function eventColor(event: BattleLogEvent): string {
  switch (event.type) {
    case 'ko':
      return 'text-red-400 font-semibold'
    case 'damage':
      return event.isCrit && !event.isDodged
        ? 'text-amber-300'
        : event.isDodged
          ? 'text-blue-400/70 italic'
          : ''
    case 'heal':
      return 'text-green-400'
    case 'synergy_applied':
      return 'text-amber-300'
    case 'battle_end':
      return 'font-semibold text-foreground'
    default:
      return ''
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
  const isDraw = isResolved && !challenge.winnerId

  // Key moments: KOs, crits, synergies, battle end
  const keyMoments = result?.log.filter(
    (e) =>
      e.type === 'ko' ||
      e.type === 'synergy_applied' ||
      e.type === 'battle_end' ||
      (e.type === 'damage' && e.isCrit && e.amount > 0),
  )

  // Group full log by turns
  const turnGroups: Array<{ turn: number; events: Array<BattleLogEvent> }> = []
  if (result) {
    let currentTurn = 0
    let currentEvents: Array<BattleLogEvent> = []
    for (const event of result.log) {
      if (event.type === 'turn_start') {
        if (currentEvents.length > 0) {
          turnGroups.push({ turn: currentTurn, events: currentEvents })
        }
        currentTurn = event.turn
        currentEvents = []
      } else if (event.type !== 'turn_end') {
        currentEvents.push(event)
      }
    }
    if (currentEvents.length > 0) {
      turnGroups.push({ turn: currentTurn, events: currentEvents })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card/50 p-6">
        <div className="flex items-center gap-4">
          <PlayerBadge
            name={challenge.challengerName}
            image={challenge.challengerImage}
            rating={ratings.challenger.rating}
            tier={ratings.challenger.tier}
            isWinner={challengerWon}
            side="left"
          />
          <div className="flex flex-col items-center gap-1 px-4">
            <span className="font-display text-lg font-bold text-muted-foreground/40">
              VS
            </span>
            {isResolved && (
              <span className="text-[10px] text-muted-foreground/60">
                {result.turns} turns
              </span>
            )}
          </div>
          <PlayerBadge
            name={challenge.defenderName}
            image={challenge.defenderImage}
            rating={ratings.defender.rating}
            tier={ratings.defender.tier}
            isWinner={defenderWon}
            side="right"
          />
        </div>

        {isResolved && (
          <div className="mt-4 text-center">
            <p
              className={cn(
                'font-display text-lg font-bold',
                isDraw ? 'text-muted-foreground' : 'text-amber-400',
              )}
            >
              {challengerWon
                ? `${challenge.challengerName} wins!`
                : defenderWon
                  ? `${challenge.defenderName} wins!`
                  : 'Draw!'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground/60">
              {result.reason === 'ko' ? 'By KO' : 'By timeout'}
            </p>
          </div>
        )}
        {!isResolved && (
          <p className="mt-4 text-center text-sm capitalize text-muted-foreground/60">
            {challenge.status}
          </p>
        )}
      </div>

      {/* Teams */}
      <div className="flex gap-4">
        <TeamDisplay
          creatures={teamA}
          finalState={result?.finalState.teamA.map((c) => ({
            currentHp: c.currentHp,
            maxHp: c.maxHp,
            name: c.name,
          }))}
        />
        <TeamDisplay
          creatures={teamB}
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
          <div className="space-y-1.5 rounded-xl border border-border bg-card/50 p-4">
            {keyMoments.map((event, i) => {
              const text = formatEvent(event)
              if (!text) return null
              const icon = eventIcon(event)
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-2 text-sm',
                    eventColor(event),
                  )}
                >
                  {'turn' in event && (
                    <span className="w-6 shrink-0 text-right text-[10px] text-muted-foreground/50">
                      T{event.turn}
                    </span>
                  )}
                  {icon}
                  <span>{text}</span>
                </div>
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
            className="flex items-center gap-1.5 font-display text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {showFullLog ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Full Battle Log
          </button>
          {showFullLog && (
            <div className="mt-2 max-h-[500px] overflow-y-auto rounded-xl border border-border bg-card/50 p-4">
              {turnGroups.map((group) => (
                <div key={group.turn} className="mb-3 last:mb-0">
                  {group.turn > 0 && (
                    <div className="mb-1.5 flex items-center gap-2">
                      <div className="h-px flex-1 bg-border/50" />
                      <span className="font-display text-[10px] font-semibold text-muted-foreground/40">
                        Turn {group.turn}
                      </span>
                      <div className="h-px flex-1 bg-border/50" />
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {group.events.map((event, i) => {
                      const text = formatEvent(event)
                      if (!text) return null
                      const icon = eventIcon(event)
                      const isIndented =
                        event.type === 'damage' ||
                        event.type === 'heal' ||
                        event.type === 'status_applied' ||
                        event.type === 'status_tick' ||
                        event.type === 'shield_absorbed' ||
                        event.type === 'reflect_damage' ||
                        event.type === 'stun_skip'
                      return (
                        <div
                          key={i}
                          className={cn(
                            'flex items-center gap-1.5 text-xs text-muted-foreground',
                            isIndented && 'ml-4',
                            eventColor(event),
                          )}
                        >
                          {icon}
                          <span>{text}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
