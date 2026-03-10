import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Zap,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { BattleLogEvent } from '@paleo-waifu/shared/battle/types'
import { cn } from '@/lib/utils'

type NameMap = Map<string, string>
type SideMap = Map<string, 'A' | 'B'>

const TEAM_TEXT = {
  A: 'text-rose-400',
  B: 'text-sky-400',
} as const

function C({
  id,
  nameMap,
  sideMap,
}: {
  id: string
  nameMap: NameMap
  sideMap: SideMap
}) {
  const name = nameMap.get(id) ?? id.slice(0, 8)
  const side = sideMap.get(id)
  return (
    <span className={cn('font-semibold', side ? TEAM_TEXT[side] : '')}>
      {name}
    </span>
  )
}

function formatEvent(
  event: BattleLogEvent,
  nameMap: NameMap,
  sideMap: SideMap,
): ReactNode | null {
  const c = (id: string) => <C id={id} nameMap={nameMap} sideMap={sideMap} />

  switch (event.type) {
    case 'creature_action':
      return (
        <>
          {c(event.creatureId)} uses {event.abilityName}
          {event.targetIds.length === 1 && <> → {c(event.targetIds[0])}</>}
        </>
      )
    case 'damage':
      if (event.isDodged)
        return (
          <>
            {c(event.targetId)} dodges {c(event.sourceId)}
          </>
        )
      return (
        <>
          {c(event.sourceId)} deals {event.amount} to {c(event.targetId)}
          {event.isCrit ? ' (CRIT!)' : ''}
        </>
      )
    case 'heal':
      return event.sourceId === event.targetId ? (
        <>
          {c(event.sourceId)} heals for {event.amount}
        </>
      ) : (
        <>
          {c(event.sourceId)} heals {c(event.targetId)} for {event.amount}
        </>
      )
    case 'ko':
      return <>{c(event.creatureId)} is KO&apos;d!</>
    case 'status_applied':
      return (
        <>
          {c(event.targetId)} gains {event.effect.kind}
          {event.effect.turnsRemaining
            ? ` (${event.effect.turnsRemaining}t)`
            : ''}
        </>
      )
    case 'status_tick':
      return event.damage > 0 ? (
        <>
          {event.kind} deals {event.damage} to {c(event.targetId)}
        </>
      ) : (
        <>
          {event.kind} heals {c(event.targetId)} for {Math.abs(event.damage)}
        </>
      )
    case 'stun_skip':
      return <>{c(event.creatureId)} is stunned — skips turn</>
    case 'shield_absorbed':
      return (
        <>
          {c(event.targetId)}&apos;s shield absorbs {event.absorbed} (
          {event.remaining} left)
        </>
      )
    case 'reflect_damage':
      return (
        <>
          {c(event.targetId)} reflects {event.amount} to {c(event.sourceId)}
        </>
      )
    case 'passive_trigger':
      return (
        <>
          {c(event.creatureId)}: {event.description}
        </>
      )
    case 'synergy_applied':
      return <>{event.synergy.description}</>
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

interface BattleLogViewerProps {
  log: Array<BattleLogEvent>
  nameMap: NameMap
  sideMap: SideMap
}

export function KeyMoments({ log, nameMap, sideMap }: BattleLogViewerProps) {
  const keyMoments = log.filter(
    (e) =>
      e.type === 'ko' ||
      e.type === 'synergy_applied' ||
      e.type === 'battle_end' ||
      (e.type === 'damage' && e.isCrit && e.amount > 0),
  )

  if (keyMoments.length === 0) return null

  return (
    <div>
      <h2 className="mb-2 font-display text-lg font-semibold">Key Moments</h2>
      <div className="space-y-1.5 rounded-xl border border-border bg-card/50 p-4">
        {keyMoments.map((event, i) => {
          const text = formatEvent(event, nameMap, sideMap)
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
  )
}

export function FullBattleLog({ log, nameMap, sideMap }: BattleLogViewerProps) {
  const [showFullLog, setShowFullLog] = useState(false)

  // Group log by turns
  const turnGroups: Array<{ turn: number; events: Array<BattleLogEvent> }> = []
  let currentTurn = 0
  let currentEvents: Array<BattleLogEvent> = []
  for (const event of log) {
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

  return (
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
                  const text = formatEvent(event, nameMap, sideMap)
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
  )
}
