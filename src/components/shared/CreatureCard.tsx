import type { Rarity } from '@/lib/types'
import { IconFossil, IconSparkles } from '@/components/icons'
import { cn } from '@/lib/utils'
import { RARITY_BG, RARITY_BORDER, RARITY_COLORS } from '@/lib/types'
import { Badge } from '@/components/ui/badge'

export interface CreatureCardData {
  name: string
  scientificName: string
  rarity: string
  era: string
  imageUrl: string | null
  imageAspectRatio?: number | null
  diet?: string
  isNew?: boolean
}

export function CreatureCard({
  creature,
  onClick,
  onMouseEnter,
  onMouseLeave,
  className,
  style,
  eager,
}: {
  creature: CreatureCardData
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  className?: string
  style?: React.CSSProperties
  eager?: boolean
}) {
  const rarity = creature.rarity as Rarity

  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        'group overflow-hidden rounded-xl border-2 text-left transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1',
        RARITY_BORDER[rarity],
        RARITY_BG[rarity],
        className,
      )}
      style={style}
    >
      <div
        className="overflow-hidden"
        style={
          creature.imageAspectRatio
            ? { aspectRatio: creature.imageAspectRatio }
            : undefined
        }
      >
        {creature.imageUrl ? (
          <img
            src={creature.imageUrl}
            alt={creature.name}
            loading={eager ? 'eager' : 'lazy'}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex aspect-square items-center justify-center bg-muted/20">
            <IconFossil className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
      </div>
      <div className="p-2">
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'font-display text-[10px] font-semibold uppercase',
              RARITY_COLORS[rarity],
            )}
          >
            {rarity}
          </span>
          {creature.isNew && (
            <Badge className="h-4 px-1 py-0 text-[9px] bg-primary/20 text-primary">
              <IconSparkles className="mr-0.5 h-2.5 w-2.5" />
              NEW
            </Badge>
          )}
        </div>
        <div className="font-display text-sm font-bold leading-tight">
          {creature.name}
        </div>
        <div className="text-[11px] italic text-muted-foreground">
          {creature.scientificName}
        </div>
        {creature.diet && (
          <div className="mt-1 text-[11px] text-muted-foreground">
            {creature.era} &middot; {creature.diet}
          </div>
        )}
      </div>
    </button>
  )
}
