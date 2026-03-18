import { describe, expect, it } from 'vitest'
import { calculateRarity, selectCreatureFromPool } from '../engine'
import {
  BASE_RATES,
  HARD_PITY_THRESHOLD,
  SOFT_PITY_THRESHOLD,
} from '../../types'
import type { PoolCreature } from '../engine'

// Helper: create a deterministic RNG that returns values from a sequence
function seqRng(values: Array<number>): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

// Helper: create an RNG that always returns the same value
function fixedRng(value: number): () => number {
  return () => value
}

// Helper: create a test pool creature
function makeCreature(
  id: string,
  rarity: string,
  name = `Creature ${id}`,
): PoolCreature {
  return {
    creatureId: id,
    rarity,
    name,
    scientificName: `Scientificus ${id}`,
    imageUrl: null,
    description: 'A test creature',
    era: 'Jurassic',
    imageAspectRatio: null,
    isBattleReady: false,
  }
}

describe('calculateRarity', () => {
  it('returns legendary on hard pity (pull 90+) regardless of RNG', () => {
    // rng returns 0.99 — would never naturally hit legendary
    const result = calculateRarity(
      HARD_PITY_THRESHOLD,
      HARD_PITY_THRESHOLD,
      fixedRng(0.99),
    )
    expect(result).toBe('legendary')
  })

  it('returns legendary on hard pity even with pullsSinceRare = 0', () => {
    const result = calculateRarity(0, HARD_PITY_THRESHOLD, fixedRng(0.99))
    expect(result).toBe('legendary')
  })

  it('does not trigger hard pity at pull 89', () => {
    // With rng=0.0 (very low), should get common — not forced legendary
    const result = calculateRarity(
      HARD_PITY_THRESHOLD - 1,
      HARD_PITY_THRESHOLD - 1,
      fixedRng(0.0),
    )
    expect(result).toBe('common')
  })

  it('returns common for low RNG values with no pity', () => {
    // BASE_RATES.common = 0.5, so rng < 0.5 should be common (at base rates)
    const result = calculateRarity(0, 0, fixedRng(0.0))
    expect(result).toBe('common')
  })

  it('returns uncommon for appropriate RNG range', () => {
    // common = 0.5, uncommon = 0.3, so normalized common = 0.5, uncommon starts at 0.5
    // rng of 0.5 should be uncommon
    const result = calculateRarity(0, 0, fixedRng(0.5))
    expect(result).toBe('uncommon')
  })

  it('returns rare for appropriate RNG range', () => {
    // common=0.5, uncommon=0.3 → cumulative 0.8, rare=0.15 → cumulative 0.95
    const result = calculateRarity(0, 0, fixedRng(0.81))
    expect(result).toBe('rare')
  })

  it('returns epic for appropriate RNG range', () => {
    // common=0.5, uncommon=0.3, rare=0.15 → cumulative 0.95, epic=0.04 → cumulative 0.99
    const result = calculateRarity(0, 0, fixedRng(0.96))
    expect(result).toBe('epic')
  })

  it('returns legendary for highest RNG values', () => {
    // legendary is the last 1% at base rates
    const result = calculateRarity(0, 0, fixedRng(0.995))
    expect(result).toBe('legendary')
  })

  it('increases legendary rate during soft pity', () => {
    // At soft pity threshold + 5 pulls:
    // legendaryRate = 0.01 + 5 * 0.06 = 0.31
    // Total is inflated, so legendary gets a bigger normalized share
    const pullsSinceLeg = SOFT_PITY_THRESHOLD + 5

    // Count legendaries over many pulls with varying RNG
    let legendaries = 0
    const trials = 1000
    for (let i = 0; i < trials; i++) {
      const result = calculateRarity(0, pullsSinceLeg, fixedRng(i / trials))
      if (result === 'legendary') legendaries++
    }

    // With soft pity, legendary rate should be significantly above 1%
    const legendaryRate = legendaries / trials
    expect(legendaryRate).toBeGreaterThan(0.1) // well above base 1%
  })

  it('increases rare and epic rates during rare soft pity', () => {
    const pullsSinceRare = SOFT_PITY_THRESHOLD + 5

    let rares = 0
    let epics = 0
    const trials = 1000
    for (let i = 0; i < trials; i++) {
      const result = calculateRarity(pullsSinceRare, 0, fixedRng(i / trials))
      if (result === 'rare') rares++
      if (result === 'epic') epics++
    }

    // Rare and epic should be above their base rates
    expect(rares / trials).toBeGreaterThan(BASE_RATES.rare)
    expect(epics / trials).toBeGreaterThan(BASE_RATES.epic)
  })
})

describe('selectCreatureFromPool', () => {
  it('returns null for empty pool', () => {
    const pool = new Map<string, Array<PoolCreature>>()
    const result = selectCreatureFromPool(pool, 'common', null, fixedRng(0.5))
    expect(result).toBeNull()
  })

  it('returns null for missing rarity tier', () => {
    const pool = new Map([['rare', [makeCreature('r1', 'rare')]]])
    const result = selectCreatureFromPool(pool, 'common', null, fixedRng(0.5))
    expect(result).toBeNull()
  })

  it('returns the only creature when pool has one entry', () => {
    const pool = new Map([['common', [makeCreature('c1', 'common')]]])
    const result = selectCreatureFromPool(pool, 'common', null, fixedRng(0.5))
    expect(result).toBe('c1')
  })

  it('selects from pool without rate-up', () => {
    const pool = new Map([
      [
        'common',
        [
          makeCreature('c1', 'common'),
          makeCreature('c2', 'common'),
          makeCreature('c3', 'common'),
        ],
      ],
    ])
    // rng = 0.0 → floor(0.0 * 3) = 0 → first creature
    const result = selectCreatureFromPool(pool, 'common', null, fixedRng(0.0))
    expect(result).toBe('c1')
  })

  it('selects rate-up creature when RNG is below RATE_UP_SHARE', () => {
    const pool = new Map([
      [
        'rare',
        [makeCreature('r1', 'rare'), makeCreature('r2', 'rare', 'Rate Up')],
      ],
    ])
    // First rng call (rate-up check): 0.1 < 0.5 (RATE_UP_SHARE) → select rate-up
    const result = selectCreatureFromPool(pool, 'rare', 'r2', fixedRng(0.1))
    expect(result).toBe('r2')
  })

  it('selects non-rate-up creature when RNG is above RATE_UP_SHARE', () => {
    const pool = new Map([
      [
        'rare',
        [makeCreature('r1', 'rare'), makeCreature('r2', 'rare', 'Rate Up')],
      ],
    ])
    // First rng (rate-up check): 0.7 >= 0.5 → skip rate-up
    // Second rng (pick from others): 0.7 → floor(0.7 * 1) = 0 → r1 (the only non-rate-up)
    const result = selectCreatureFromPool(
      pool,
      'rare',
      'r2',
      seqRng([0.7, 0.0]),
    )
    expect(result).toBe('r1')
  })

  it('ignores rate-up when rate-up creature is not in the pool', () => {
    const pool = new Map([
      ['common', [makeCreature('c1', 'common'), makeCreature('c2', 'common')]],
    ])
    // Rate-up ID 'r99' is not in the common pool → normal selection
    const result = selectCreatureFromPool(pool, 'common', 'r99', fixedRng(0.0))
    expect(result).toBe('c1')
  })

  it('returns rate-up creature when it is the only one in the pool', () => {
    const pool = new Map([['legendary', [makeCreature('leg1', 'legendary')]]])
    // Rate-up check: 0.1 < 0.5 → select rate-up
    const result = selectCreatureFromPool(
      pool,
      'legendary',
      'leg1',
      fixedRng(0.1),
    )
    expect(result).toBe('leg1')
  })

  it('distributes rate-up at ~50% over many trials', () => {
    const pool = new Map([
      [
        'rare',
        [
          makeCreature('r1', 'rare'),
          makeCreature('r2', 'rare'),
          makeCreature('rate-up', 'rare'),
        ],
      ],
    ])

    let rateUpCount = 0
    const trials = 1000
    for (let i = 0; i < trials; i++) {
      // Each trial needs multiple rng calls, use sequential values
      let callIdx = 0
      const rng = () => {
        callIdx++
        // Use different values per trial for the rate-up check
        if (callIdx === 1) return i / trials // rate-up coinflip
        return 0.5 // fallback selection
      }
      const result = selectCreatureFromPool(pool, 'rare', 'rate-up', rng)
      if (result === 'rate-up') rateUpCount++
    }

    // Should be approximately 50% (RATE_UP_SHARE = 0.5)
    const ratio = rateUpCount / trials
    expect(ratio).toBeGreaterThan(0.45)
    expect(ratio).toBeLessThan(0.55)
  })
})
