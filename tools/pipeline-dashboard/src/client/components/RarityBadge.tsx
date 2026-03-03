import { clsx } from 'clsx'
import type { Rarity } from '../lib/types'

const RARITY_STYLES: Record<Rarity, string> = {
  common: 'bg-rarity-common/15 text-rarity-common',
  uncommon: 'bg-rarity-uncommon/15 text-rarity-uncommon',
  rare: 'bg-rarity-rare/15 text-rarity-rare',
  epic: 'bg-rarity-epic/15 text-rarity-epic',
  legendary: 'bg-rarity-legendary/15 text-rarity-legendary',
}

export function RarityBadge({
  rarity,
  className,
}: {
  rarity: Rarity
  className?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        RARITY_STYLES[rarity],
        className,
      )}
    >
      {rarity}
    </span>
  )
}
