import { HARD_PITY_THRESHOLD, SOFT_PITY_THRESHOLD } from '@/lib/types'

export function PityCounter() {
  // Pity is tracked server-side; this is a placeholder UI
  // TODO: fetch pity data from server and display progress
  return (
    <div className="text-xs text-muted-foreground">
      <span>Soft pity at {SOFT_PITY_THRESHOLD} pulls</span>
      <span className="mx-2">·</span>
      <span>Guaranteed legendary at {HARD_PITY_THRESHOLD}</span>
    </div>
  )
}
