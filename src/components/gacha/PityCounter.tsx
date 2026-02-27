import { HARD_PITY_THRESHOLD, SOFT_PITY_THRESHOLD } from '@/lib/types'

export function PityCounter() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-purple-400/60" />
        <span>
          Soft pity at{' '}
          <span className="font-display font-semibold text-purple-400">
            {SOFT_PITY_THRESHOLD}
          </span>
        </span>
      </div>
      <div className="h-3 w-px bg-border" />
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-400/60" />
        <span>
          Guaranteed legendary at{' '}
          <span className="font-display font-semibold text-amber-400">
            {HARD_PITY_THRESHOLD}
          </span>
        </span>
      </div>
    </div>
  )
}
