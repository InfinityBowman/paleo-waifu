import { Skull, Sparkles } from 'lucide-react'
import type { Rarity } from '@/lib/types'
import { cn } from '@/lib/utils'
import { RARITY_BORDER, RARITY_COLORS, RARITY_SHIMMER } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

interface Creature {
  name: string
  scientificName: string
  rarity: string
  era: string
  diet: string
  imageUrl: string | null
  description: string
  period?: string | null
  sizeMeters?: number | null
  weightKg?: number | null
  funFacts?: string | null
}

const RARITY_IMAGE_GRADIENT: Record<string, string> = {
  common: 'from-neutral-500/10 to-background',
  uncommon: 'from-green-500/10 to-background',
  rare: 'from-blue-500/15 to-background',
  epic: 'from-purple-500/20 to-background',
  legendary: 'from-amber-500/20 to-background',
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
  if (!creature) return null

  const rarity = creature.rarity as Rarity
  const shimmerClass = RARITY_SHIMMER[rarity]

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
          'gap-0 overflow-hidden p-0 sm:max-w-md',
          'border-2',
          RARITY_BORDER[rarity],
        )}
      >
        <div
          className={cn(
            'relative aspect-square bg-gradient-to-b p-8',
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
              className="h-full w-full rounded-lg object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Skull className="h-20 w-20 text-muted-foreground/20" />
            </div>
          )}
        </div>

        <div className="p-6">
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
            <span className="rounded-full bg-muted/50 px-3 py-1.5">
              <span className="text-muted-foreground">Diet:</span>{' '}
              <span className="font-medium">{creature.diet}</span>
            </span>
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

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {creature.description}
          </p>

          {funFacts.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
