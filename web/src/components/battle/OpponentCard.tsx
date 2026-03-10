import { Swords } from 'lucide-react'
import type { Rarity } from '@paleo-waifu/shared/types'
import { IconFossil } from '@/components/icons'
import { cn } from '@/lib/utils'
import { RARITY_BORDER, RARITY_COLORS } from '@/lib/rarity-styles'
import { Button } from '@/components/ui/button'

export interface ArenaOpponent {
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

const ROLE_COLOR: Record<string, string> = {
  striker: 'text-red-400',
  tank: 'text-blue-400',
  support: 'text-green-400',
  bruiser: 'text-orange-400',
}

export function OpponentCard({
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
              {opponent.name[0] || '?'}
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
