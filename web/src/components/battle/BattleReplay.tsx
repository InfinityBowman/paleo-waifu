import { Skull, Trophy } from 'lucide-react'
import type { Rarity } from '@paleo-waifu/shared/types'
import type { BattleResult } from '@paleo-waifu/shared/battle/types'
import { IconFossil } from '@/components/icons'
import { cn } from '@/lib/utils'
import { RARITY_BG, RARITY_BORDER, RARITY_COLORS } from '@/lib/rarity-styles'
import { KeyMoments, FullBattleLog } from './BattleLogViewer'

// ── Types ──────────────────────────────────────────────────────────

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

// ── Sub-components ────────────────────────────────────────────────

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
            {name?.[0] ?? '?'}
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
        const state =
          finalState?.find((s) => s.name === c.name) ?? finalState?.[i]
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

// ── Main Component ────────────────────────────────────────────────

export function BattleReplay({
  challenge,
  result,
  teamA,
  teamB,
  ratings,
}: BattleReplayProps) {
  const isResolved = challenge.status === 'resolved' && result
  const challengerWon = challenge.winnerId === challenge.challengerId
  const defenderWon = challenge.winnerId === challenge.defenderId
  const isDraw = isResolved && !challenge.winnerId

  // Build creature ID → name/side maps from final state
  const nameMap: Map<string, string> = new Map()
  const sideMap: Map<string, 'A' | 'B'> = new Map()
  if (result) {
    for (const c of result.finalState.teamA) {
      nameMap.set(c.id, c.name)
      sideMap.set(c.id, 'A')
    }
    for (const c of result.finalState.teamB) {
      nameMap.set(c.id, c.name)
      sideMap.set(c.id, 'B')
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
              {result.reason === 'ko'
                ? 'By KO'
                : result.reason === 'mutual_ko'
                  ? 'Mutual KO'
                  : 'By timeout'}
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

      {/* Team Legend */}
      {isResolved && (
        <div className="flex items-center justify-center gap-6 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="text-muted-foreground">
              {challenge.challengerName}&apos;s team
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-400" />
            <span className="text-muted-foreground">
              {challenge.defenderName}&apos;s team
            </span>
          </span>
        </div>
      )}

      {/* Battle Log */}
      {result && (
        <>
          <KeyMoments
            log={result.log}
            nameMap={nameMap}
            sideMap={sideMap}
          />
          <FullBattleLog
            log={result.log}
            nameMap={nameMap}
            sideMap={sideMap}
          />
        </>
      )}
    </div>
  )
}
