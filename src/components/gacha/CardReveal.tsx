import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { RARITY_COLORS, RARITY_BORDER, RARITY_BG, RARITY_GLOW, type Rarity } from '@/lib/types'
import type { PullResult } from '@/lib/gacha'
import { Sparkles } from 'lucide-react'

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

  const rarity = result.rarity as Rarity

  if (!revealed) {
    return (
      <div className="flex aspect-[3/4] items-center justify-center rounded-lg border-2 border-dashed border-muted bg-muted/30">
        <div className="animate-pulse text-3xl">🪨</div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border-2 transition-all duration-500 animate-in fade-in zoom-in-95',
        RARITY_BORDER[rarity],
        RARITY_BG[rarity],
        RARITY_GLOW[rarity] && `shadow-lg ${RARITY_GLOW[rarity]}`,
      )}
    >
      <div className="aspect-[3/4] bg-gradient-to-b from-transparent to-background/80 p-3">
        {result.imageUrl ? (
          <img
            src={result.imageUrl}
            alt={result.name}
            className="h-full w-full rounded object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">
            🦖
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-center gap-1">
          {result.isNew && (
            <span className="flex items-center gap-0.5 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
              <Sparkles className="h-3 w-3" />
              NEW
            </span>
          )}
          <span className={cn('text-xs font-semibold uppercase', RARITY_COLORS[rarity])}>
            {rarity}
          </span>
        </div>
        <div className="mt-1 text-sm font-bold leading-tight">{result.name}</div>
        <div className="text-[11px] italic text-muted-foreground">
          {result.scientificName}
        </div>
      </div>
    </div>
  )
}
