export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export type TradeStatus =
  | 'open'
  | 'pending'
  | 'accepted'
  | 'cancelled'
  | 'expired'

export const RARITY_ORDER: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
}

export const PULL_COST_SINGLE = 1
export const PULL_COST_MULTI = 10
export const MULTI_PULL_COUNT = 10
export const NEW_USER_BONUS = 10
export const DAILY_FOSSILS = 3
export const SOFT_PITY_THRESHOLD = 75
export const HARD_PITY_THRESHOLD = 90
/** Per-pull legendary rate increase once soft pity kicks in (linear ramp) */
export const SOFT_PITY_RATE_INCREMENT = 0.06

export const BASE_RATES: Record<Rarity, number> = {
  common: 0.5,
  uncommon: 0.3,
  rare: 0.15,
  epic: 0.04,
  legendary: 0.01,
}

export const RATE_UP_SHARE = 0.5
