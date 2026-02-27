import type {Rarity} from '@/lib/types';
import { cn } from '@/lib/utils'
import { RARITY_BORDER, RARITY_COLORS  } from '@/lib/types'
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'gap-0 overflow-hidden p-0 sm:max-w-md',
          'border-2',
          RARITY_BORDER[rarity],
        )}
      >
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
          <Badge
            variant="secondary"
            className={cn(
              'uppercase',
              RARITY_COLORS[rarity],
              'bg-transparent px-0',
            )}
          >
            {rarity}
          </Badge>
          <DialogTitle className="mt-1 text-2xl font-bold">
            {creature.name}
          </DialogTitle>
          <DialogDescription className="italic">
            {creature.scientificName}
          </DialogDescription>

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
      </DialogContent>
    </Dialog>
  )
}
