import { useEffect, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import type { Rarity } from '@paleo-waifu/shared/types'
import { IconFossil, IconRoundStar, IconSparkles } from '@/components/icons'
import { cn } from '@/lib/utils'
import { RARITY_BORDER, RARITY_COLORS, RARITY_SHIMMER } from '@/lib/rarity-styles'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

interface Creature {
  id?: string
  name: string
  scientificName: string
  rarity: string
  era: string
  diet?: string
  imageUrl: string | null
  description?: string | null
  period?: string | null
  sizeMeters?: number | null
  weightKg?: number | null
  funFacts?: string | null
  isFavorite?: boolean | null
}

const RARITY_IMAGE_GRADIENT: Record<string, string> = {
  common: 'from-rarity-common/10 to-background',
  uncommon: 'from-rarity-uncommon/14 to-background',
  rare: 'from-rarity-rare/18 to-background',
  epic: 'from-rarity-epic/22 to-background',
  legendary: 'from-rarity-legendary/25 to-background',
}

export function CreatureModal({
  creature,
  open,
  onOpenChange,
}: {
  creature: Creature | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [toggling, setToggling] = useState(false)
  const [optimisticFavorite, setOptimisticFavorite] = useState<boolean | null>(
    null,
  )

  useEffect(() => {
    setOptimisticFavorite(null)
  }, [creature?.id])

  const isFavorite =
    optimisticFavorite ?? creature?.isFavorite ?? false

  if (!creature) return null

  const rarity = creature.rarity as Rarity
  const shimmerClass = RARITY_SHIMMER[rarity]

  const toggleFavorite = async () => {
    if (!creature.id || toggling) return
    setToggling(true)
    setOptimisticFavorite(!isFavorite)
    try {
      const res = await fetch('/api/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggleFavorite',
          userCreatureId: creature.id,
        }),
      })
      if (res.ok) {
        router.invalidate()
      } else {
        setOptimisticFavorite(null)
      }
    } catch {
      setOptimisticFavorite(null)
    } finally {
      setToggling(false)
    }
  }

  let funFacts: Array<string> = []
  if (creature.funFacts) {
    try {
      const parsed = JSON.parse(creature.funFacts)
      if (Array.isArray(parsed)) funFacts = parsed
    } catch {
      // If not valid JSON, treat as single fact
      funFacts = [creature.funFacts]
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md',
          'border-2',
          RARITY_BORDER[rarity],
        )}
      >
        <div
          className={cn(
            'relative flex max-h-72 shrink-0 items-center justify-center bg-linear-to-b p-6',
            RARITY_IMAGE_GRADIENT[rarity] ?? 'from-muted/30 to-background',
          )}
        >
          {/* Shimmer overlay */}
          {shimmerClass && (
            <div
              className={cn(
                'pointer-events-none absolute inset-0 z-10',
                shimmerClass,
              )}
            />
          )}
          {creature.imageUrl ? (
            <img
              src={creature.imageUrl}
              alt={creature.name}
              className="max-h-60 w-auto rounded-lg object-contain"
            />
          ) : (
            <div className="flex h-40 w-full items-center justify-center">
              <IconFossil className="h-20 w-20 text-muted-foreground/20" />
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between">
            <Badge
              variant="secondary"
              className={cn(
                'font-display uppercase',
                RARITY_COLORS[rarity],
                'bg-transparent px-0',
              )}
            >
              {rarity}
            </Badge>
            {creature.id && (
              <button
                onClick={toggleFavorite}
                disabled={toggling}
                className={cn(
                  'rounded-full p-1.5 transition-colors',
                  isFavorite
                    ? 'text-rarity-legendary'
                    : 'text-muted-foreground/40 hover:text-rarity-legendary/60',
                )}
              >
                <IconRoundStar
                  className={cn(
                    'h-5 w-5',
                    isFavorite && 'fill-rarity-legendary',
                  )}
                />
              </button>
            )}
          </div>
          <DialogTitle className="mt-1 font-display text-2xl font-bold">
            {creature.name}
          </DialogTitle>
          <DialogDescription className="italic">
            {creature.scientificName}
          </DialogDescription>

          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-muted/50 px-3 py-1.5">
              <span className="text-muted-foreground">Era:</span>{' '}
              <span className="font-medium">{creature.era}</span>
            </span>
            {creature.diet && (
              <span className="rounded-full bg-muted/50 px-3 py-1.5">
                <span className="text-muted-foreground">Diet:</span>{' '}
                <span className="font-medium">{creature.diet}</span>
              </span>
            )}
            {creature.period && (
              <span className="rounded-full bg-muted/50 px-3 py-1.5">
                <span className="text-muted-foreground">Period:</span>{' '}
                <span className="font-medium">{creature.period}</span>
              </span>
            )}
            {creature.sizeMeters != null && (
              <span className="rounded-full bg-muted/50 px-3 py-1.5">
                <span className="text-muted-foreground">Size:</span>{' '}
                <span className="font-medium">{creature.sizeMeters}m</span>
              </span>
            )}
            {creature.weightKg != null && (
              <span className="rounded-full bg-muted/50 px-3 py-1.5">
                <span className="text-muted-foreground">Weight:</span>{' '}
                <span className="font-medium">{creature.weightKg}kg</span>
              </span>
            )}
          </div>

          {creature.description ? (
            <>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {creature.description}
              </p>

              {funFacts.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                    <IconSparkles className="h-3.5 w-3.5 text-primary" />
                    Fun Facts
                  </div>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {funFacts.map((fact, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-0.5 text-primary/60">•</span>
                        <span>{fact}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="mt-4 space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-muted/50" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-muted/50" />
              <div className="h-4 w-4/6 animate-pulse rounded bg-muted/50" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
