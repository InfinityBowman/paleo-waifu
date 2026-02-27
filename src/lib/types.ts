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

export const RARITY_COLORS: Record<Rarity, string> = {
  common: 'text-neutral-400',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-amber-400',
}

export const RARITY_BORDER: Record<Rarity, string> = {
  common: 'border-neutral-400/30',
  uncommon: 'border-green-400/30',
  rare: 'border-blue-400/30',
  epic: 'border-purple-400/30',
  legendary: 'border-amber-400/30',
}

export const RARITY_BG: Record<Rarity, string> = {
  common: 'bg-neutral-400/10',
  uncommon: 'bg-green-400/10',
  rare: 'bg-blue-400/10',
  epic: 'bg-purple-400/10',
  legendary: 'bg-amber-400/10',
}

export const RARITY_GLOW: Record<Rarity, string> = {
  common: '',
  uncommon: 'shadow-green-400/20',
  rare: 'shadow-blue-400/20',
  epic: 'shadow-purple-400/30',
  legendary: 'shadow-amber-400/40',
}

export const RARITY_SHIMMER: Partial<Record<Rarity, string>> = {
  rare: 'rarity-shimmer-rare',
  epic: 'rarity-shimmer-epic',
  legendary: 'rarity-shimmer-legendary',
}

export const RARITY_GLOW_ANIM: Partial<Record<Rarity, string>> = {
  epic: 'rarity-glow-epic',
  legendary: 'rarity-glow-legendary',
}

export const PULL_COST_SINGLE = 1
export const PULL_COST_MULTI = 10
export const MULTI_PULL_COUNT = 10
export const NEW_USER_BONUS = 20
export const DAILY_FOSSILS = 3
export const SOFT_PITY_THRESHOLD = 50
export const HARD_PITY_THRESHOLD = 90

export const BASE_RATES: Record<Rarity, number> = {
  common: 0.5,
  uncommon: 0.3,
  rare: 0.15,
  epic: 0.04,
  legendary: 0.01,
}

export const RATE_UP_SHARE = 0.5
