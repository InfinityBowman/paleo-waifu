import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { PullResult } from '@/lib/gacha'
import type {Rarity} from '@/lib/types';
import { cn } from '@/lib/utils'
import {
  RARITY_BG,
  RARITY_BORDER,
  RARITY_COLORS,
  RARITY_GLOW
  
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
            <Badge className="bg-primary/20 text-primary">
              <Sparkles className="h-3 w-3" />
              NEW
            </Badge>
          )}
          <span
            className={cn(
              'text-xs font-semibold uppercase',
              RARITY_COLORS[rarity],
            )}
          >
            {rarity}
          </span>
        </div>
        <div className="mt-1 text-sm font-bold leading-tight">
          {result.name}
        </div>
        <div className="text-[11px] italic text-muted-foreground">
          {result.scientificName}
        </div>
      </div>
    </div>
  )
}
