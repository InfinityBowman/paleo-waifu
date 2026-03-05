import {
  HARD_PITY_THRESHOLD,
  SOFT_PITY_THRESHOLD,
} from '@paleo-waifu/shared/types'

export function PityCounter() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-rarity-epic/60" />
        <span>
          Soft pity at{' '}
          <span className="font-display font-semibold text-rarity-epic/80">
            {SOFT_PITY_THRESHOLD}
          </span>
        </span>
      </div>
      <div className="h-3 w-px bg-border" />
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-rarity-legendary/60" />
        <span>
          Guaranteed legendary at{' '}
          <span className="font-display font-semibold text-rarity-legendary/85">
            {HARD_PITY_THRESHOLD}
          </span>
        </span>
      </div>
    </div>
  )
}
