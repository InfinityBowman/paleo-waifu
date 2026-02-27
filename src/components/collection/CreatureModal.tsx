import { cn } from '@/lib/utils'
import { RARITY_COLORS, RARITY_BORDER, type Rarity } from '@/lib/types'
import { X } from 'lucide-react'

interface Creature {
  name: string
  scientificName: string
  rarity: string
  era: string
  diet: string
  imageUrl: string | null
  description: string
}

export function CreatureModal({
  creature,
  onClose,
}: {
  creature: Creature
  onClose: () => void
}) {
  const rarity = creature.rarity as Rarity

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          'relative mx-4 w-full max-w-md overflow-hidden rounded-xl border-2 bg-card shadow-2xl',
          RARITY_BORDER[rarity],
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-background/80 p-1.5 hover:bg-background"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="aspect-square bg-gradient-to-b from-muted/30 to-background p-8">
          {creature.imageUrl ? (
            <img
              src={creature.imageUrl}
              alt={creature.name}
              className="h-full w-full rounded-lg object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-8xl">
              🦖
            </div>
          )}
        </div>

        <div className="p-6">
          <span
            className={cn(
              'text-xs font-semibold uppercase',
              RARITY_COLORS[rarity],
            )}
          >
            {rarity}
          </span>
          <h2 className="mt-1 text-2xl font-bold">{creature.name}</h2>
          <p className="text-sm italic text-muted-foreground">
            {creature.scientificName}
          </p>

          <div className="mt-4 flex gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Era:</span>{' '}
              <span className="font-medium">{creature.era}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Diet:</span>{' '}
              <span className="font-medium">{creature.diet}</span>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {creature.description}
          </p>
        </div>
      </div>
    </div>
  )
}
