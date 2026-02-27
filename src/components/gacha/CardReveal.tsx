import { useEffect, useState } from 'react'
import { Skull, Sparkles } from 'lucide-react'
import type { PullResult } from '@/lib/gacha'
import { cn } from '@/lib/utils'
import {
  RARITY_BG,
  RARITY_BORDER,
  RARITY_COLORS,
  RARITY_GLOW,
  RARITY_GLOW_ANIM,
  RARITY_SHIMMER,
} from '@/lib/types'
import { Badge } from '@/components/ui/badge'

export function CardReveal({
  result,
  delay,
}: {
  result: PullResult
  delay: number
}) {
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  const rarity = result.rarity

  if (!revealed) {
    return (
      <div className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted bg-gradient-to-b from-muted/40 to-muted/20">
        <Skull className="h-8 w-8 animate-pulse text-muted-foreground/50" />
        <div className="h-1 w-12 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full w-full animate-shimmer rounded-full bg-gradient-to-r from-transparent via-muted-foreground/30 to-transparent"
            style={{ backgroundSize: '200% 100%' }}
          />
        </div>
      </div>
    )
  }

  const shimmerClass = RARITY_SHIMMER[rarity]
  const glowClass = RARITY_GLOW_ANIM[rarity]

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border-2 animate-rarity-flash',
        RARITY_BORDER[rarity],
        RARITY_BG[rarity],
        RARITY_GLOW[rarity] && `shadow-lg ${RARITY_GLOW[rarity]}`,
        glowClass,
      )}
    >
      {/* Shimmer overlay for rare+ */}
      {shimmerClass && (
        <div
          className={cn(
            'pointer-events-none absolute inset-0 z-10',
            shimmerClass,
          )}
        />
      )}

      <div className="aspect-[3/4] bg-gradient-to-b from-transparent to-background/80 p-3">
        {result.imageUrl ? (
          <img
            src={result.imageUrl}
            alt={result.name}
            className="h-full w-full rounded object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Skull className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-center gap-1">
          {result.isNew && (
            <Badge className="bg-primary/20 text-primary">
              <Sparkles className="h-3 w-3" />
              NEW
            </Badge>
          )}
          <span
            className={cn(
              'font-display text-xs font-semibold uppercase',
              RARITY_COLORS[rarity],
            )}
          >
            {rarity}
          </span>
        </div>
        <div className="mt-1 font-display text-sm font-bold leading-tight">
          {result.name}
        </div>
        <div className="text-[11px] italic text-muted-foreground">
          {result.scientificName}
        </div>
      </div>
    </div>
  )
}
