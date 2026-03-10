import type { Rarity } from '@paleo-waifu/shared/types'
import type { BattleStatsData } from '@/components/shared/BattleStatsPanel'
import { IconFossil, IconSparkles } from '@/components/icons'
import { cn } from '@/lib/utils'
import {
  RARITY_BORDER,
  RARITY_COLORS,
  RARITY_SHIMMER,
} from '@/lib/rarity-styles'
import { Badge } from '@/components/ui/badge'
import { BattleStatsPanel } from '@/components/shared/BattleStatsPanel'

export interface CreatureDetailData {
  name: string
  scientificName: string
  rarity: string
  era: string
  diet: string
  imageUrl: string | null
  description: string
  period: string | null
  sizeMeters: number | null
  weightKg: number | null
  funFacts: string | null
  battleStats: BattleStatsData | null
}

const RARITY_IMAGE_GRADIENT: Record<string, string> = {
  common: 'from-rarity-common/10 to-background',
  uncommon: 'from-rarity-uncommon/14 to-background',
  rare: 'from-rarity-rare/18 to-background',
  epic: 'from-rarity-epic/22 to-background',
  legendary: 'from-rarity-legendary/25 to-background',
}

export function CreatureDetail({
  creature,
  className,
}: {
  creature: CreatureDetailData
  className?: string
}) {
  const rarity = creature.rarity as Rarity
  const shimmerClass = RARITY_SHIMMER[rarity]

  let funFacts: Array<string> = []
  if (creature.funFacts) {
    try {
      const parsed = JSON.parse(creature.funFacts)
      if (Array.isArray(parsed)) funFacts = parsed
    } catch {
      funFacts = [creature.funFacts]
    }
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border-2',
        RARITY_BORDER[rarity],
        className,
      )}
    >
      <div
        className={cn(
          'relative flex max-h-72 shrink-0 items-center justify-center bg-linear-to-b p-6',
          RARITY_IMAGE_GRADIENT[rarity] ?? 'from-muted/30 to-background',
        )}
      >
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
        <h1 className="mt-1 font-display text-2xl font-bold">
          {creature.name}
        </h1>
        <p className="italic text-muted-foreground">
          {creature.scientificName}
        </p>

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
                  <span className="mt-0.5 text-primary/60">&bull;</span>
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {creature.battleStats && (
          <BattleStatsPanel stats={creature.battleStats} />
        )}
      </div>
    </div>
  )
}
