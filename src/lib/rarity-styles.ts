import type { Rarity } from '@paleo-waifu/shared/types'

export const RARITY_COLORS: Record<Rarity, string> = {
  common: 'text-rarity-common',
  uncommon: 'text-rarity-uncommon',
  rare: 'text-rarity-rare',
  epic: 'text-rarity-epic',
  legendary: 'text-rarity-legendary',
}

export const RARITY_BORDER: Record<Rarity, string> = {
  common: 'border-rarity-common/30',
  uncommon: 'border-rarity-uncommon/40',
  rare: 'border-rarity-rare/45',
  epic: 'border-rarity-epic/50',
  legendary: 'border-rarity-legendary/60',
}

export const RARITY_BG: Record<Rarity, string> = {
  common: 'bg-rarity-common/8',
  uncommon: 'bg-rarity-uncommon/10',
  rare: 'bg-rarity-rare/12',
  epic: 'bg-rarity-epic/15',
  legendary: 'bg-rarity-legendary/15',
}

export const RARITY_GLOW: Record<Rarity, string> = {
  common: '',
  uncommon: 'shadow-rarity-uncommon/25',
  rare: 'shadow-rarity-rare/35',
  epic: 'shadow-rarity-epic/40',
  legendary: 'shadow-rarity-legendary/50',
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
