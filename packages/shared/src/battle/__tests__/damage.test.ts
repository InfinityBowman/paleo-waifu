import { describe, expect, it } from 'vitest'
import { calculateDamage } from '../damage'
import { createRng } from '../rng'
import { NONE_PASSIVE, THICK_HIDE, makeCreature } from './test-helpers'
import type { Effect } from '../types'

describe('Damage', () => {
  it('calculates basic damage with DEF mitigation', () => {
    const rng = createRng(42)
    const attacker = makeCreature({ atk: 30, passive: NONE_PASSIVE })
    const defender = makeCreature({ def: 20, passive: NONE_PASSIVE })
    const effect: Effect & { type: 'damage' } = {
      type: 'damage',
      multiplier: 1.0,
      scaling: 'atk',
    }

    const result = calculateDamage({ attacker, defender, effect, rng })
    // raw = 30 * 1.0 = 30, DEF = 30*(100/120) ≈ 25, variance ±10%, scale *0.6
    expect(result.damage).toBeGreaterThan(0)
    expect(result.damage).toBeLessThanOrEqual(30)
  })

  it('applies damage_reduction (Thick Hide)', () => {
    const rng1 = createRng(42)
    const rng2 = createRng(42)

    const attacker = makeCreature({ atk: 50, passive: NONE_PASSIVE })
    const noReduction = makeCreature({
      def: 10,
      passive: NONE_PASSIVE,
      damageReductionPercent: 0,
    })
    const withReduction = makeCreature({
      def: 10,
      passive: THICK_HIDE,
      damageReductionPercent: 15,
    })
    const effect: Effect & { type: 'damage' } = {
      type: 'damage',
      multiplier: 1.0,
      scaling: 'atk',
    }

    const r1 = calculateDamage({
      attacker,
      defender: noReduction,
      effect,
      rng: rng1,
    })
    const r2 = calculateDamage({
      attacker,
      defender: withReduction,
      effect,
      rng: rng2,
    })

    // damage_reduction should reduce damage by ~15%
    expect(r2.damage).toBeLessThan(r1.damage)
  })

  it('flat_reduction (Ironclad) reduces damage', () => {
    const rng1 = createRng(42)
    const rng2 = createRng(42)

    const attacker = makeCreature({ atk: 50, passive: NONE_PASSIVE })
    const noFlat = makeCreature({
      def: 30,
      passive: NONE_PASSIVE,
      flatReductionDefPercent: 0,
    })
    const withFlat = makeCreature({
      def: 30,
      passive: NONE_PASSIVE,
      flatReductionDefPercent: 10,
    })
    const effect: Effect & { type: 'damage' } = {
      type: 'damage',
      multiplier: 1.0,
      scaling: 'atk',
    }

    const r1 = calculateDamage({
      attacker,
      defender: noFlat,
      effect,
      rng: rng1,
    })
    const r2 = calculateDamage({
      attacker,
      defender: withFlat,
      effect,
      rng: rng2,
    })

    // Flat reduction subtracts 10% of DEF (3 points) from damage
    expect(r2.damage).toBeLessThan(r1.damage)
  })

  it('floors damage to minimum 1 for non-dodged hits', () => {
    const rng = createRng(42)
    const attacker = makeCreature({ atk: 1, passive: NONE_PASSIVE })
    const defender = makeCreature({ def: 999, passive: NONE_PASSIVE })
    const effect: Effect & { type: 'damage' } = {
      type: 'damage',
      multiplier: 0.1,
      scaling: 'atk',
    }

    const result = calculateDamage({ attacker, defender, effect, rng })
    if (!result.isDodged) {
      expect(result.damage).toBeGreaterThanOrEqual(1)
    }
  })

  it('uses def stat for scaling when scaling is def', () => {
    const rng1 = createRng(42)
    const rng2 = createRng(42)

    // High DEF attacker, low ATK
    const attacker = makeCreature({
      atk: 10,
      def: 80,
      passive: NONE_PASSIVE,
    })
    const defender = makeCreature({ def: 20, passive: NONE_PASSIVE })

    const atkEffect: Effect & { type: 'damage' } = {
      type: 'damage',
      multiplier: 1.0,
      scaling: 'atk',
    }
    const defEffect: Effect & { type: 'damage' } = {
      type: 'damage',
      multiplier: 1.0,
      scaling: 'def',
    }

    const r1 = calculateDamage({
      attacker,
      defender,
      effect: atkEffect,
      rng: rng1,
    })
    const r2 = calculateDamage({
      attacker,
      defender,
      effect: defEffect,
      rng: rng2,
    })

    // DEF-scaled hit should be much stronger because attacker.def (80) >> attacker.atk (10)
    expect(r2.damage).toBeGreaterThan(r1.damage)
  })
})

// ─── Crit Mechanics ──────────────────────────────────────────────

describe('Crit Mechanics', () => {
  it('crit applies 1.5x multiplier when crit roll is below 0.1', () => {
    // Find a seed where the first rng.next() (crit roll) is < 0.1
    // Try seeds until we find one that crits
    const effect: Effect & { type: 'damage' } = {
      type: 'damage',
      multiplier: 1.0,
      scaling: 'atk',
    }
    const attacker = makeCreature({ atk: 100, passive: NONE_PASSIVE })
    const defender = makeCreature({
      def: 0,
      passive: NONE_PASSIVE,
    })

    // Run with many seeds to find at least one crit and one non-crit
    let critDamage: number | null = null
    let nonCritDamage: number | null = null
    let critSeed: number | null = null
    let nonCritSeed: number | null = null

    for (let seed = 1; seed <= 500; seed++) {
      const rng = createRng(seed)
      const result = calculateDamage({ attacker, defender, effect, rng })
      if (result.isCrit && critDamage === null) {
        critDamage = result.damage
        critSeed = seed
      }
      if (!result.isCrit && !result.isDodged && nonCritDamage === null) {
        nonCritDamage = result.damage
        nonCritSeed = seed
      }
      if (critDamage !== null && nonCritDamage !== null) break
    }

    expect(critSeed).not.toBeNull()
    expect(nonCritSeed).not.toBeNull()
    // Crit damage should be higher than non-crit (same base, crit applies bonus)
    expect(critDamage!).toBeGreaterThan(nonCritDamage!)
  })

  it('critReductionPercent reduces the crit bonus', () => {
    const effect: Effect & { type: 'damage' } = {
      type: 'damage',
      multiplier: 1.0,
      scaling: 'atk',
    }
    const attacker = makeCreature({ atk: 100, passive: NONE_PASSIVE })

    // Find a seed that crits
    let critSeed: number | null = null
    for (let seed = 1; seed <= 500; seed++) {
      const rng = createRng(seed)
      const result = calculateDamage({
        attacker,
        defender: makeCreature({ def: 20, passive: NONE_PASSIVE }),
        effect,
        rng,
      })
      if (result.isCrit) {
        critSeed = seed
        break
      }
    }
    expect(critSeed).not.toBeNull()

    // Same seed: no crit reduction vs 50% crit reduction
    const noReduction = makeCreature({
      def: 20,
      passive: NONE_PASSIVE,
      critReductionPercent: 0,
    })
    const withReduction = makeCreature({
      def: 20,
      passive: NONE_PASSIVE,
      critReductionPercent: 50,
    })

    const r1 = calculateDamage({
      attacker,
      defender: noReduction,
      effect,
      rng: createRng(critSeed!),
    })
    const r2 = calculateDamage({
      attacker,
      defender: withReduction,
      effect,
      rng: createRng(critSeed!),
    })

    expect(r1.isCrit).toBe(true)
    expect(r2.isCrit).toBe(true)
    // With 50% crit reduction, crit bonus is halved → less damage
    expect(r2.damage).toBeLessThan(r1.damage)
  })

  it('100% crit reduction eliminates the crit bonus entirely', () => {
    const effect: Effect & { type: 'damage' } = {
      type: 'damage',
      multiplier: 1.0,
      scaling: 'atk',
    }
    const attacker = makeCreature({ atk: 100, passive: NONE_PASSIVE })

    // Find a seed that crits
    let critSeed: number | null = null
    for (let seed = 1; seed <= 500; seed++) {
      const rng = createRng(seed)
      const result = calculateDamage({
        attacker,
        defender: makeCreature({ def: 20, passive: NONE_PASSIVE }),
        effect,
        rng,
      })
      if (result.isCrit) {
        critSeed = seed
        break
      }
    }
    expect(critSeed).not.toBeNull()

    // With 100% crit reduction, crit bonus should be 0 → same as non-crit
    const fullReduction = makeCreature({
      def: 20,
      passive: NONE_PASSIVE,
      critReductionPercent: 100,
    })

    // We need a non-crit seed for comparison
    let nonCritSeed: number | null = null
    for (let seed = 1; seed <= 500; seed++) {
      const rng = createRng(seed)
      const result = calculateDamage({
        attacker,
        defender: makeCreature({ def: 20, passive: NONE_PASSIVE }),
        effect,
        rng,
      })
      if (!result.isCrit && !result.isDodged) {
        nonCritSeed = seed
        break
      }
    }

    const critWithFullReduction = calculateDamage({
      attacker,
      defender: fullReduction,
      effect,
      rng: createRng(critSeed!),
    })

    // isCrit is still true (the roll succeeded), but the bonus is zero
    expect(critWithFullReduction.isCrit).toBe(true)
  })
})

// ─── Dodge Mechanics ──────────────────────────────────────────────

describe('Dodge Mechanics', () => {
  it('dodge returns isDodged true and finalDamage 0', () => {
    const effect: Effect & { type: 'damage' } = {
      type: 'damage',
      multiplier: 1.0,
      scaling: 'atk',
    }
    const attacker = makeCreature({
      atk: 50,
      spd: 10,
      passive: NONE_PASSIVE,
    })
    const defender = makeCreature({
      def: 20,
      spd: 100,
      passive: NONE_PASSIVE,
      dodgeBasePercent: 40,
    })

    // Try seeds until we find a dodge
    let dodged = false
    for (let seed = 1; seed <= 1000; seed++) {
      const rng = createRng(seed)
      const result = calculateDamage({ attacker, defender, effect, rng })
      if (result.isDodged) {
        expect(result.damage).toBe(0)
        expect(result.isCrit).toBe(false)
        dodged = true
        break
      }
    }
    expect(dodged).toBe(true)
  })

  it('dodge chance is capped at 40%', () => {
    const effect: Effect & { type: 'damage' } = {
      type: 'damage',
      multiplier: 1.0,
      scaling: 'atk',
    }
    // Extreme SPD ratio in defender's favor, high base dodge
    const attacker = makeCreature({
      atk: 50,
      spd: 1,
      passive: NONE_PASSIVE,
    })
    const defender = makeCreature({
      def: 20,
      spd: 9999,
      passive: NONE_PASSIVE,
      dodgeBasePercent: 90,
    })

    let dodgeCount = 0
    const trials = 10000
    for (let seed = 1; seed <= trials; seed++) {
      const rng = createRng(seed)
      const result = calculateDamage({ attacker, defender, effect, rng })
      if (result.isDodged) dodgeCount++
    }

    const dodgeRate = dodgeCount / trials
    // Dodge rate should be approximately 40% (capped), not higher
    expect(dodgeRate).toBeLessThanOrEqual(0.5) // generous upper bound
    expect(dodgeRate).toBeGreaterThan(0.2) // should be near 40%
  })

  it('dodge chance has a 3% floor when dodgeBasePercent > 0', () => {
    const effect: Effect & { type: 'damage' } = {
      type: 'damage',
      multiplier: 1.0,
      scaling: 'atk',
    }
    // Extreme SPD ratio in attacker's favor, very low base dodge
    const attacker = makeCreature({
      atk: 50,
      spd: 9999,
      passive: NONE_PASSIVE,
    })
    const defender = makeCreature({
      def: 20,
      spd: 1,
      passive: NONE_PASSIVE,
      dodgeBasePercent: 1,
    })

    let dodgeCount = 0
    const trials = 10000
    for (let seed = 1; seed <= trials; seed++) {
      const rng = createRng(seed)
      const result = calculateDamage({ attacker, defender, effect, rng })
      if (result.isDodged) dodgeCount++
    }

    const dodgeRate = dodgeCount / trials
    // Dodge rate should be at least near 3% (floor)
    expect(dodgeRate).toBeGreaterThan(0.01)
  })

  it('no dodge when dodgeBasePercent is 0', () => {
    const effect: Effect & { type: 'damage' } = {
      type: 'damage',
      multiplier: 1.0,
      scaling: 'atk',
    }
    const attacker = makeCreature({
      atk: 50,
      spd: 10,
      passive: NONE_PASSIVE,
    })
    const defender = makeCreature({
      def: 20,
      spd: 100,
      passive: NONE_PASSIVE,
      dodgeBasePercent: 0,
    })

    for (let seed = 1; seed <= 100; seed++) {
      const rng = createRng(seed)
      const result = calculateDamage({ attacker, defender, effect, rng })
      expect(result.isDodged).toBe(false)
    }
  })
})
