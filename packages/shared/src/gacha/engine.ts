import {
  BASE_RATES,
  EPIC_SOFT_PITY_INCREMENT,
  HARD_PITY_THRESHOLD,
  RARE_SOFT_PITY_INCREMENT,
  RATE_UP_SHARE,
  SOFT_PITY_RATE_INCREMENT,
  SOFT_PITY_THRESHOLD,
} from '../types'
import type { Rarity } from '../types'

export interface PoolCreature {
  creatureId: string
  rarity: string
  name: string
  scientificName: string
  imageUrl: string | null
  description: string
  era: string
  imageAspectRatio: number | null
  isBattleReady: boolean
}

/** Calculate adjusted rarity based on pity counters */
export function calculateRarity(
  pullsSinceRare: number,
  pullsSinceLegendary: number,
  rng: () => number,
): Rarity {
  const rand = rng()

  // Hard pity: guaranteed legendary at 90
  if (pullsSinceLegendary >= HARD_PITY_THRESHOLD) {
    return 'legendary'
  }

  // Soft pity for legendary: linear ramp past threshold (+6% per pull)
  let legendaryRate = BASE_RATES.legendary
  if (pullsSinceLegendary >= SOFT_PITY_THRESHOLD) {
    const extraPulls = pullsSinceLegendary - SOFT_PITY_THRESHOLD
    legendaryRate = BASE_RATES.legendary + extraPulls * SOFT_PITY_RATE_INCREMENT
  }

  // Soft pity for rare+: linear ramp past threshold
  let rareRate = BASE_RATES.rare
  let epicRate = BASE_RATES.epic
  if (pullsSinceRare >= SOFT_PITY_THRESHOLD) {
    const extraPulls = pullsSinceRare - SOFT_PITY_THRESHOLD
    rareRate = BASE_RATES.rare + extraPulls * RARE_SOFT_PITY_INCREMENT
    epicRate = BASE_RATES.epic + extraPulls * EPIC_SOFT_PITY_INCREMENT
  }

  // Normalize and roll
  const total =
    BASE_RATES.common +
    BASE_RATES.uncommon +
    rareRate +
    epicRate +
    legendaryRate
  const commonNorm = BASE_RATES.common / total
  const uncommonNorm = BASE_RATES.uncommon / total
  const rareNorm = rareRate / total
  const epicNorm = epicRate / total

  if (rand < commonNorm) return 'common'
  if (rand < commonNorm + uncommonNorm) return 'uncommon'
  if (rand < commonNorm + uncommonNorm + rareNorm) return 'rare'
  if (rand < commonNorm + uncommonNorm + rareNorm + epicNorm) return 'epic'
  return 'legendary'
}

/** Select a creature from pre-fetched pool data (no DB queries) */
export function selectCreatureFromPool(
  poolByRarity: Map<string, Array<PoolCreature>>,
  rarity: Rarity,
  rateUpId: string | null,
  rng: () => number,
): string | null {
  const pool = poolByRarity.get(rarity)
  if (!pool || pool.length === 0) return null

  if (rateUpId) {
    const isRateUpInPool = pool.some((p) => p.creatureId === rateUpId)
    if (isRateUpInPool) {
      if (rng() < RATE_UP_SHARE) return rateUpId
      const others = pool.filter((p) => p.creatureId !== rateUpId)
      if (others.length > 0) {
        return others[Math.floor(rng() * others.length)].creatureId
      }
    }
  }

  return pool[Math.floor(rng() * pool.length)].creatureId
}
