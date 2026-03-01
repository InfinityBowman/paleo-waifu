import type { Rarity } from '@/lib/types'

/** Rarity hex colors for Discord embeds (OKLCH → hex approximations) */
export const RARITY_HEX: Record<Rarity, number> = {
  common: 0x9ea3b8,
  uncommon: 0x4bc9a0,
  rare: 0x5a8be8,
  epic: 0xb563e8,
  legendary: 0xe8c95a,
}

/** Rarity emoji labels for compact displays */
export const RARITY_EMOJI: Record<Rarity, string> = {
  common: '\u2B1C',     // white square
  uncommon: '\uD83D\uDFE9', // green square
  rare: '\uD83D\uDFE6',     // blue square
  epic: '\uD83D\uDFEA',     // purple square
  legendary: '\uD83D\uDFE8', // yellow square
}

/** Rarity display labels */
export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
}

export const APP_URL = 'https://paleo-waifu.jacobmaynard.dev'
export const UNLINKED_MESSAGE = `You haven't linked your Discord account yet! Sign in at ${APP_URL} with Discord to get started.`
export const BANNED_MESSAGE = 'Your account has been banned.'
