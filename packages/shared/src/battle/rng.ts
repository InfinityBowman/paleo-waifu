import type { SeededRng } from './types'

/**
 * Mulberry32 seeded PRNG — fast, deterministic, 32-bit state.
 */
export function createRng(seed: number): SeededRng {
  let state = seed | 0

  function next(): number {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  function nextInt(min: number, max: number): number {
    return min + Math.floor(next() * (max - min + 1))
  }

  function nextFloat(min: number, max: number): number {
    return min + next() * (max - min)
  }

  return { next, nextInt, nextFloat }
}
