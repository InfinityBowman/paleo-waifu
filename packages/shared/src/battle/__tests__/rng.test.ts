import { describe, expect, it } from 'vitest'
import { createRng } from '../rng'

describe('RNG', () => {
  it('produces deterministic output for the same seed', () => {
    const rng1 = createRng(42)
    const rng2 = createRng(42)
    const values1 = Array.from({ length: 100 }, () => rng1.next())
    const values2 = Array.from({ length: 100 }, () => rng2.next())
    expect(values1).toEqual(values2)
  })

  it('produces different output for different seeds', () => {
    const rng1 = createRng(42)
    const rng2 = createRng(43)
    const v1 = rng1.next()
    const v2 = rng2.next()
    expect(v1).not.toEqual(v2)
  })

  it('next() returns values in [0, 1)', () => {
    const rng = createRng(12345)
    for (let i = 0; i < 1000; i++) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('nextInt() returns integers in inclusive range', () => {
    const rng = createRng(999)
    for (let i = 0; i < 100; i++) {
      const v = rng.nextInt(5, 10)
      expect(v).toBeGreaterThanOrEqual(5)
      expect(v).toBeLessThanOrEqual(10)
      expect(Number.isInteger(v)).toBe(true)
    }
  })

  it('nextFloat() returns floats in range', () => {
    const rng = createRng(777)
    for (let i = 0; i < 100; i++) {
      const v = rng.nextFloat(1.5, 3.5)
      expect(v).toBeGreaterThanOrEqual(1.5)
      expect(v).toBeLessThanOrEqual(3.5)
    }
  })
})
