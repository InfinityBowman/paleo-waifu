/** XP required to reach level N: 100 * N^2 */
export function xpForLevel(level: number): number {
  return 100 * level * level
}

/** Derive current level from cumulative XP */
export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100))
}

/** XP needed to reach the next level from current XP */
export function xpToNextLevel(xp: number): number {
  const current = levelFromXp(xp)
  return xpForLevel(current + 1) - xp
}

export const XP_MIN_PER_MESSAGE = 15
export const XP_MAX_PER_MESSAGE = 25
export const XP_COOLDOWN_MS = 60_000
export const XP_MIN_MESSAGE_LENGTH = 4

export const LEVEL_UP_FOSSILS_BASE = 1
export const LEVEL_UP_FOSSILS_MILESTONE = 3
export const LEVEL_UP_MILESTONE_INTERVAL = 5

/** Fossils awarded when reaching `newLevel`. Returns 0 for level 0. */
export function fossilsForLevel(newLevel: number): number {
  if (newLevel <= 0) return 0
  return newLevel % LEVEL_UP_MILESTONE_INTERVAL === 0
    ? LEVEL_UP_FOSSILS_MILESTONE
    : LEVEL_UP_FOSSILS_BASE
}
