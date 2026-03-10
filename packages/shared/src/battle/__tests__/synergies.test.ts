import { describe, expect, it } from 'vitest'
import { applySynergies, calculateSynergies } from '../synergies'
import { makeCreature } from './test-helpers'

describe('Synergies', () => {
  it('applies type synergy for 2 matching types', () => {
    const team = [
      makeCreature({ id: 'a', type: 'large theropod' }),
      makeCreature({ id: 'b', type: 'large theropod' }),
      makeCreature({ id: 'c', type: 'sauropod' }),
    ]
    const bonuses = calculateSynergies(team)
    const typeSyn = bonuses.find((b) => b.kind === 'type')
    expect(typeSyn).toBeDefined()
    expect(typeSyn!.affectedCreatureIds).toEqual(['a', 'b'])
    expect(typeSyn!.statBonuses.hp).toBe(5)
  })

  it('applies type synergy for 3 matching types', () => {
    const team = [
      makeCreature({ id: 'a', type: 'large theropod' }),
      makeCreature({ id: 'b', type: 'large theropod' }),
      makeCreature({ id: 'c', type: 'large theropod' }),
    ]
    const bonuses = calculateSynergies(team)
    const typeSyn = bonuses.find((b) => b.kind === 'type')
    expect(typeSyn).toBeDefined()
    expect(typeSyn!.affectedCreatureIds).toHaveLength(3)
    expect(typeSyn!.statBonuses.hp).toBe(7)
    expect(typeSyn!.statBonuses.atk).toBe(3)
  })

  it('applies diet synergy for all carnivores', () => {
    const team = [
      makeCreature({ id: 'a', diet: 'Carnivorous' }),
      makeCreature({ id: 'b', diet: 'Carnivorous' }),
      makeCreature({ id: 'c', diet: 'Carnivorous' }),
    ]
    const bonuses = calculateSynergies(team)
    const dietSyn = bonuses.find((b) => b.kind === 'diet')
    expect(dietSyn).toBeDefined()
    expect(dietSyn!.statBonuses.atk).toBe(10)
  })

  it('applies mixed diet synergy', () => {
    const team = [
      makeCreature({ id: 'a', diet: 'Carnivorous' }),
      makeCreature({ id: 'b', diet: 'Herbivorous' }),
      makeCreature({ id: 'c', diet: 'Omnivorous' }),
    ]
    const bonuses = calculateSynergies(team)
    const dietSyn = bonuses.find((b) => b.kind === 'diet')
    expect(dietSyn).toBeDefined()
    expect(dietSyn!.statBonuses.spd).toBe(12)
  })

  it('normalizes Herbivorous/omnivorous diet', () => {
    const team = [
      makeCreature({ id: 'a', diet: 'Herbivorous' }),
      makeCreature({ id: 'b', diet: 'Herbivorous/omnivorous' }),
      makeCreature({ id: 'c', diet: 'Herbivorous' }),
    ]
    const bonuses = calculateSynergies(team)
    const dietSyn = bonuses.find((b) => b.kind === 'diet')
    expect(dietSyn).toBeDefined()
    expect(dietSyn!.statBonuses.def).toBe(10)
  })

  it('applySynergies modifies creature stats', () => {
    const team = [
      makeCreature({
        id: 'a',
        type: 'large theropod',
        era: 'Cretaceous',
        diet: 'Omnivorous',
        maxHp: 100,
        currentHp: 100,
        baseStats: { hp: 100, atk: 30, def: 20, spd: 25 },
      }),
      makeCreature({
        id: 'b',
        type: 'large theropod',
        era: 'Jurassic',
        diet: 'Piscivorous',
        maxHp: 100,
        currentHp: 100,
        baseStats: { hp: 100, atk: 30, def: 20, spd: 25 },
      }),
      makeCreature({
        id: 'c',
        type: 'sauropod',
        era: 'Triassic',
        diet: 'Herbivorous',
        maxHp: 100,
        currentHp: 100,
        baseStats: { hp: 100, atk: 30, def: 20, spd: 25 },
      }),
    ]
    const bonuses = calculateSynergies(team)
    // With all different eras/diets, only type synergy applies (2x large theropod)
    applySynergies(team, bonuses)

    // Team members a and b should have +5% HP from type synergy (2-match)
    expect(team[0].maxHp).toBe(105)
    expect(team[0].currentHp).toBe(105)
    expect(team[1].maxHp).toBe(105)
    // c should not be affected by the type synergy HP bonus
    expect(team[2].maxHp).toBe(100)
  })
})
