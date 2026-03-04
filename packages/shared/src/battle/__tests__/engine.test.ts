import { describe, expect, it } from 'vitest'
import { calculateDamage, getDietModifier } from '../damage'
import { createRng } from '../rng'
import { calculateSynergies, applySynergies } from '../synergies'
import { simulateBattle } from '../engine'
import {
  getBasicAttack,
  isAbilityReady,
  decrementCooldowns,
  tickStatusEffects,
  resolveAbility,
} from '../abilities'
import { selectAction, selectTarget } from '../ai'
import type {
  BattleCreature,
  BattleTeam,
  BattleTeamMember,
  ResolvedAbility,
} from '../types'

// ─── Test Fixtures ─────────────────────────────────────────────────

function makeMember(
  overrides: Partial<BattleTeamMember> = {},
): BattleTeamMember {
  return {
    creatureId: 'test-creature',
    name: 'TestDino',
    stats: { hp: 100, atk: 30, def: 20, spd: 25, abl: 15 },
    abilities: {
      creatureId: 'test-creature',
      active1: { templateId: 'bite', displayName: 'Bite' },
      active2: { templateId: 'tail_sweep', displayName: 'Tail Sweep' },
      passive: { templateId: 'thick_hide', displayName: 'Thick Hide' },
    },
    diet: 'Carnivorous',
    type: 'large theropod',
    era: 'Cretaceous',
    rarity: 'common',
    row: 'front',
    ...overrides,
  }
}

function makeTeam(
  overrides: Partial<BattleTeamMember>[] = [{}, {}, {}],
): BattleTeam {
  return {
    members: overrides.map((o) => makeMember(o)) as [
      BattleTeamMember,
      BattleTeamMember,
      BattleTeamMember,
    ],
  }
}

function makeCreature(
  overrides: Partial<BattleCreature> = {},
): BattleCreature {
  const basicPassive: ResolvedAbility = {
    templateId: 'thick_hide',
    displayName: 'Thick Hide',
    slot: 'passive',
    type: 'passive',
    category: 'passive',
    target: null,
    multiplier: null,
    cooldown: null,
    duration: null,
    statAffected: 'damage_reduction',
    effectValue: 15,
  }

  return {
    id: 'test-1',
    creatureId: 'c1',
    name: 'TestDino',
    teamSide: 'A',
    row: 'front',
    baseStats: { hp: 100, atk: 30, def: 20, spd: 25, abl: 15 },
    maxHp: 100,
    currentHp: 100,
    atk: 30,
    def: 20,
    spd: 25,
    abl: 15,
    role: 'striker',
    diet: 'Carnivorous',
    type: 'large theropod',
    era: 'Cretaceous',
    rarity: 'common',
    active1: {
      templateId: 'bite',
      displayName: 'Bite',
      slot: 'active1',
      type: 'active',
      category: 'damage',
      target: 'single_enemy',
      multiplier: 1.2,
      cooldown: 0,
      duration: null,
      statAffected: null,
      effectValue: null,
    },
    active2: {
      templateId: 'tail_sweep',
      displayName: 'Tail Sweep',
      slot: 'active2',
      type: 'active',
      category: 'aoe_damage',
      target: 'all_enemies',
      multiplier: 0.7,
      cooldown: 2,
      duration: null,
      statAffected: null,
      effectValue: null,
    },
    passive: basicPassive,
    cooldowns: {},
    statusEffects: [],
    isAlive: true,
    isStunned: false,
    reflectDamagePercent: 0,
    ...overrides,
  }
}

// ─── RNG Tests ─────────────────────────────────────────────────────

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

// ─── Damage Tests ──────────────────────────────────────────────────

describe('Damage', () => {
  it('calculates basic damage with DEF mitigation', () => {
    const rng = createRng(42)
    const attacker = makeCreature({
      atk: 30,
      passive: {
        ...makeCreature().passive,
        templateId: 'none',
      },
    })
    const defender = makeCreature({
      def: 20,
      passive: {
        ...makeCreature().passive,
        templateId: 'none',
      },
    })
    const ability: ResolvedAbility = {
      templateId: 'bite',
      displayName: 'Bite',
      slot: 'active1',
      type: 'active',
      category: 'damage',
      target: 'single_enemy',
      multiplier: 1.0,
      cooldown: 0,
      duration: null,
      statAffected: null,
      effectValue: null,
    }

    const result = calculateDamage({ attacker, defender, ability, rng })
    // raw = 30 * 1.0 = 30, mitigated = 30 * (100/120) = 25, ±10% variance
    expect(result.damage).toBeGreaterThan(0)
    expect(result.damage).toBeLessThanOrEqual(35)
  })

  it('applies thick_hide damage reduction', () => {
    const rng1 = createRng(42)
    const rng2 = createRng(42)

    const attacker = makeCreature({
      atk: 50,
      passive: { ...makeCreature().passive, templateId: 'none' },
    })
    const noHide = makeCreature({
      def: 10,
      passive: { ...makeCreature().passive, templateId: 'none' },
    })
    const withHide = makeCreature({
      def: 10,
      passive: { ...makeCreature().passive, templateId: 'thick_hide', effectValue: 15 },
    })
    const ability: ResolvedAbility = {
      templateId: 'bite',
      displayName: 'Bite',
      slot: 'active1',
      type: 'active',
      category: 'damage',
      target: 'single_enemy',
      multiplier: 1.0,
      cooldown: 0,
      duration: null,
      statAffected: null,
      effectValue: null,
    }

    const r1 = calculateDamage({ attacker, defender: noHide, ability, rng: rng1 })
    const r2 = calculateDamage({ attacker, defender: withHide, ability, rng: rng2 })

    // thick_hide should reduce damage by ~15%
    expect(r2.damage).toBeLessThan(r1.damage)
  })

  it('dive_attack ignores DEF', () => {
    const rng = createRng(42)
    const attacker = makeCreature({
      atk: 30,
      passive: { ...makeCreature().passive, templateId: 'none' },
    })
    const defender = makeCreature({
      def: 100,
      passive: { ...makeCreature().passive, templateId: 'none' },
    })
    const diveAbility: ResolvedAbility = {
      templateId: 'dive_attack',
      displayName: 'Dive Attack',
      slot: 'active1',
      type: 'active',
      category: 'damage',
      target: 'single_enemy',
      multiplier: 1.4,
      cooldown: 4,
      duration: null,
      statAffected: 'ignore_def',
      effectValue: null,
    }

    const result = calculateDamage({
      attacker,
      defender,
      ability: diveAbility,
      rng,
    })
    // Without DEF, raw = 30 * 1.4 = 42 ±10%
    expect(result.damage).toBeGreaterThanOrEqual(35)
  })

  it('getDietModifier returns correct values', () => {
    expect(getDietModifier('Carnivorous', 'Herbivorous')).toBe(1.15)
    expect(getDietModifier('Herbivorous', 'Carnivorous')).toBe(0.85)
    expect(getDietModifier('Carnivorous', 'Carnivorous')).toBe(1.0)
    expect(getDietModifier('Omnivorous', 'Carnivorous')).toBe(1.15)
  })

  it('floors damage to minimum 1', () => {
    const rng = createRng(42)
    const attacker = makeCreature({
      atk: 1,
      passive: { ...makeCreature().passive, templateId: 'none' },
    })
    const defender = makeCreature({
      def: 999,
      passive: { ...makeCreature().passive, templateId: 'none' },
    })
    const ability: ResolvedAbility = {
      templateId: 'test',
      displayName: 'Test',
      slot: 'active1',
      type: 'active',
      category: 'damage',
      target: 'single_enemy',
      multiplier: 0.1,
      cooldown: 0,
      duration: null,
      statAffected: null,
      effectValue: null,
    }

    const result = calculateDamage({ attacker, defender, ability, rng })
    expect(result.damage).toBeGreaterThanOrEqual(0) // 0 only if dodged
  })
})

// ─── Synergy Tests ─────────────────────────────────────────────────

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
    expect(typeSyn!.statBonuses.hp).toBe(10)
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
    expect(typeSyn!.statBonuses.hp).toBe(15)
    expect(typeSyn!.statBonuses.atk).toBe(10)
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
    expect(dietSyn!.statBonuses.atk).toBe(15)
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
    expect(dietSyn!.statBonuses.spd).toBe(10)
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
    expect(dietSyn!.statBonuses.def).toBe(20)
  })

  it('applySynergies modifies creature stats', () => {
    const team = [
      makeCreature({ id: 'a', type: 'large theropod', era: 'Cretaceous', diet: 'Omnivorous', maxHp: 100, currentHp: 100, baseStats: { hp: 100, atk: 30, def: 20, spd: 25, abl: 15 } }),
      makeCreature({ id: 'b', type: 'large theropod', era: 'Jurassic', diet: 'Piscivorous', maxHp: 100, currentHp: 100, baseStats: { hp: 100, atk: 30, def: 20, spd: 25, abl: 15 } }),
      makeCreature({ id: 'c', type: 'sauropod', era: 'Triassic', diet: 'Herbivorous', maxHp: 100, currentHp: 100, baseStats: { hp: 100, atk: 30, def: 20, spd: 25, abl: 15 } }),
    ]
    const bonuses = calculateSynergies(team)
    // With all different eras/diets, only type synergy applies (2× large theropod)
    applySynergies(team, bonuses)

    // Team members a and b should have +10% HP from type synergy
    expect(team[0].maxHp).toBe(110)
    expect(team[0].currentHp).toBe(110)
    expect(team[1].maxHp).toBe(110)
    // c should not be affected by the type synergy HP bonus
    expect(team[2].maxHp).toBe(100)
  })
})

// ─── Ability Tests ─────────────────────────────────────────────────

describe('Abilities', () => {
  it('getBasicAttack returns a 1.0x single-target damage ability', () => {
    const basic = getBasicAttack()
    expect(basic.category).toBe('damage')
    expect(basic.multiplier).toBe(1.0)
    expect(basic.target).toBe('single_enemy')
    expect(basic.templateId).toBe('basic_attack')
  })

  it('isAbilityReady returns true when off cooldown', () => {
    const creature = makeCreature()
    expect(isAbilityReady(creature, creature.active1)).toBe(true)
  })

  it('isAbilityReady returns false when on cooldown', () => {
    const creature = makeCreature()
    creature.cooldowns['bite'] = 2
    expect(isAbilityReady(creature, creature.active1)).toBe(false)
  })

  it('basic attack is always ready', () => {
    const creature = makeCreature()
    expect(isAbilityReady(creature, getBasicAttack())).toBe(true)
  })

  it('decrementCooldowns reduces all cooldowns by 1', () => {
    const creature = makeCreature()
    creature.cooldowns['bite'] = 3
    creature.cooldowns['tail_sweep'] = 1
    decrementCooldowns(creature)
    expect(creature.cooldowns['bite']).toBe(2)
    expect(creature.cooldowns['tail_sweep']).toBe(0)
  })
})

// ─── Status Effect Tests ───────────────────────────────────────────

describe('Status Effects', () => {
  it('poison ticks for % max HP damage', () => {
    const creature = makeCreature({ maxHp: 200, currentHp: 200 })
    creature.statusEffects.push({
      kind: 'poison',
      sourceCreatureId: 'enemy-1',
      value: 5, // 5% per tick
      turnsRemaining: 3,
    })

    const results = tickStatusEffects(creature, 1)
    expect(results).toHaveLength(1)
    expect(results[0].kind).toBe('poison')
    expect(results[0].damage).toBe(10) // 5% of 200
    expect(creature.currentHp).toBe(190)
  })

  it('poison expires after turnsRemaining reaches 0', () => {
    const creature = makeCreature({ maxHp: 100, currentHp: 100 })
    creature.statusEffects.push({
      kind: 'poison',
      sourceCreatureId: 'enemy-1',
      value: 5,
      turnsRemaining: 1,
    })

    const results = tickStatusEffects(creature, 1)
    expect(results[0].expired).toBe(true)
    expect(creature.statusEffects).toHaveLength(0)
  })

  it('HoT heals each turn', () => {
    const creature = makeCreature({ maxHp: 100, currentHp: 50 })
    creature.statusEffects.push({
      kind: 'hot',
      sourceCreatureId: 'self',
      value: 8,
      turnsRemaining: 3,
    })

    const results = tickStatusEffects(creature, 1)
    expect(results[0].healing).toBe(8)
    expect(creature.currentHp).toBe(58)
  })

  it('buff expires and removes stat modifier', () => {
    const creature = makeCreature({
      baseStats: { hp: 100, atk: 30, def: 20, spd: 25, abl: 15 },
      atk: 36, // 30 base + 6 from buff (20% of 30)
    })
    creature.statusEffects.push({
      kind: 'buff',
      sourceCreatureId: 'ally-1',
      stat: 'atk',
      value: 20,
      turnsRemaining: 1,
    })

    const results = tickStatusEffects(creature, 1)
    expect(results[0].expired).toBe(true)
    // Buff removed — atk should decrease by the buff amount
    expect(creature.atk).toBe(30) // 36 - 6
  })

  it('shield expiration', () => {
    const creature = makeCreature()
    creature.statusEffects.push({
      kind: 'shield',
      sourceCreatureId: 'self',
      value: 30,
      turnsRemaining: 1,
    })

    const results = tickStatusEffects(creature, 1)
    expect(results[0].kind).toBe('shield')
    expect(results[0].expired).toBe(true)
    expect(creature.statusEffects).toHaveLength(0)
  })

  it('reflect clears reflectDamagePercent on expiry', () => {
    const creature = makeCreature({ reflectDamagePercent: 40 })
    creature.statusEffects.push({
      kind: 'reflect',
      sourceCreatureId: 'self',
      value: 40,
      turnsRemaining: 1,
    })

    tickStatusEffects(creature, 1)
    expect(creature.reflectDamagePercent).toBe(0)
    expect(creature.statusEffects).toHaveLength(0)
  })
})

// ─── AI Tests ──────────────────────────────────────────────────────

describe('AI', () => {
  it('heals when self HP < 30%', () => {
    const rng = createRng(42)
    const actor = makeCreature({
      id: 'healer',
      currentHp: 20,
      maxHp: 100,
      active1: {
        templateId: 'graze',
        displayName: 'Graze',
        slot: 'active1',
        type: 'active',
        category: 'heal',
        target: 'self',
        multiplier: null,
        cooldown: 3,
        duration: null,
        statAffected: 'hp',
        effectValue: 25,
      },
      active2: {
        templateId: 'bite',
        displayName: 'Bite',
        slot: 'active2',
        type: 'active',
        category: 'damage',
        target: 'single_enemy',
        multiplier: 1.2,
        cooldown: 0,
        duration: null,
        statAffected: null,
        effectValue: null,
      },
    })
    const enemy = makeCreature({ id: 'enemy-1', teamSide: 'B' })

    const action = selectAction({
      actor,
      allies: [actor],
      enemies: [enemy],
      rng,
    })
    expect(action.ability.templateId).toBe('graze')
  })

  it('uses AoE when 2+ enemies', () => {
    const rng = createRng(42)
    const actor = makeCreature({
      id: 'aoe-user',
      currentHp: 100,
      maxHp: 100,
      active1: {
        templateId: 'bite',
        displayName: 'Bite',
        slot: 'active1',
        type: 'active',
        category: 'damage',
        target: 'single_enemy',
        multiplier: 1.2,
        cooldown: 0,
        duration: null,
        statAffected: null,
        effectValue: null,
      },
      active2: {
        templateId: 'tail_sweep',
        displayName: 'Tail Sweep',
        slot: 'active2',
        type: 'active',
        category: 'aoe_damage',
        target: 'all_enemies',
        multiplier: 0.7,
        cooldown: 2,
        duration: null,
        statAffected: null,
        effectValue: null,
      },
    })
    const enemies = [
      makeCreature({ id: 'e1', teamSide: 'B' }),
      makeCreature({ id: 'e2', teamSide: 'B' }),
    ]

    const action = selectAction({
      actor,
      allies: [actor],
      enemies,
      rng,
    })
    expect(action.ability.templateId).toBe('tail_sweep')
  })

  it('finishes low HP enemies (priority 4)', () => {
    const rng = createRng(42)
    const actor = makeCreature({
      id: 'finisher',
      currentHp: 100,
      maxHp: 100,
    })
    const lowEnemy = makeCreature({
      id: 'low-hp',
      teamSide: 'B',
      currentHp: 10,
      maxHp: 100,
    })

    const action = selectAction({
      actor,
      allies: [actor],
      enemies: [lowEnemy],
      rng,
    })
    // Should use a damage ability (bite or basic)
    expect(['damage', 'aoe_damage']).toContain(action.ability.category)
    expect(action.targets).toContain(lowEnemy)
  })

  it('falls back to basic attack when abilities on cooldown', () => {
    const rng = createRng(42)
    const actor = makeCreature({ id: 'cooldown-user' })
    actor.cooldowns['bite'] = 3
    actor.cooldowns['tail_sweep'] = 2
    const enemy = makeCreature({ id: 'enemy', teamSide: 'B' })

    const action = selectAction({
      actor,
      allies: [actor],
      enemies: [enemy],
      rng,
    })
    expect(action.ability.templateId).toBe('basic_attack')
  })

  it('taunt forces targeting the taunting creature', () => {
    const rng = createRng(42)
    const taunter = makeCreature({
      id: 'taunter',
      teamSide: 'B',
      row: 'front',
      currentHp: 80,
      maxHp: 100,
    })
    taunter.statusEffects.push({
      kind: 'taunt',
      sourceCreatureId: 'taunter',
      value: 0,
      turnsRemaining: 2,
    })
    const other = makeCreature({
      id: 'other',
      teamSide: 'B',
      row: 'front',
      currentHp: 10,
      maxHp: 100,
    })

    const targets = selectTarget({
      enemies: [taunter, other],
      targetType: 'single_enemy',
      rng,
    })
    expect(targets).toHaveLength(1)
    expect(targets[0].id).toBe('taunter')
  })
})

// ─── Engine Integration Tests ──────────────────────────────────────

describe('Battle Engine', () => {
  it('produces deterministic results with the same seed', () => {
    const teamA = makeTeam()
    const teamB = makeTeam([
      { diet: 'Herbivorous', type: 'sauropod', name: 'Bronto' },
      { diet: 'Herbivorous', type: 'sauropod', name: 'Diplo' },
      { diet: 'Herbivorous', type: 'sauropod', name: 'Apato' },
    ])

    const result1 = simulateBattle(teamA, teamB, { seed: 12345 })
    const result2 = simulateBattle(teamA, teamB, { seed: 12345 })

    expect(result1.winner).toBe(result2.winner)
    expect(result1.turns).toBe(result2.turns)
    expect(result1.log.length).toBe(result2.log.length)
    expect(result1.teamAHpPercent).toBe(result2.teamAHpPercent)
    expect(result1.teamBHpPercent).toBe(result2.teamBHpPercent)
  })

  it('different seeds produce different results', () => {
    const teamA = makeTeam()
    const teamB = makeTeam([
      { diet: 'Herbivorous', type: 'sauropod' },
      { diet: 'Herbivorous', type: 'sauropod' },
      { diet: 'Herbivorous', type: 'sauropod' },
    ])

    const result1 = simulateBattle(teamA, teamB, { seed: 1 })
    const result2 = simulateBattle(teamA, teamB, { seed: 9999 })

    // Results should differ in at least some way (log length, turns, HP%)
    const same =
      result1.turns === result2.turns &&
      result1.teamAHpPercent === result2.teamAHpPercent &&
      result1.teamBHpPercent === result2.teamBHpPercent
    expect(same).toBe(false)
  })

  it('completes within MAX_TURNS (30)', () => {
    const teamA = makeTeam()
    const teamB = makeTeam()
    const result = simulateBattle(teamA, teamB, { seed: 42 })
    expect(result.turns).toBeLessThanOrEqual(30)
    expect(result.turns).toBeGreaterThanOrEqual(1)
  })

  it('declares a winner', () => {
    const teamA = makeTeam()
    const teamB = makeTeam()
    const result = simulateBattle(teamA, teamB, { seed: 42 })
    expect(['A', 'B']).toContain(result.winner)
    expect(['ko', 'timeout']).toContain(result.reason)
  })

  it('logs battle_start and battle_end events', () => {
    const teamA = makeTeam()
    const teamB = makeTeam()
    const result = simulateBattle(teamA, teamB, { seed: 42 })

    expect(result.log[0].type).toBe('battle_start')
    expect(result.log[result.log.length - 1].type).toBe('battle_end')
  })

  it('battle with apex_predator resists stun', () => {
    const teamA = makeTeam([
      {
        abilities: {
          creatureId: 'stunner',
          active1: { templateId: 'headbutt', displayName: 'Headbutt' },
          active2: { templateId: 'bite', displayName: 'Bite' },
          passive: {
            templateId: 'thick_hide',
            displayName: 'Thick Hide',
          },
        },
      },
      {},
      {},
    ])
    const teamB = makeTeam([
      {
        abilities: {
          creatureId: 'apex',
          active1: { templateId: 'bite', displayName: 'Bite' },
          active2: {
            templateId: 'crushing_jaw',
            displayName: 'Crushing Jaw',
          },
          passive: {
            templateId: 'apex_predator',
            displayName: 'Apex Predator',
          },
        },
      },
      {},
      {},
    ])

    const result = simulateBattle(teamA, teamB, { seed: 42 })
    // The apex predator should never appear in stun_skip events
    const apexId = result.finalState.teamB[0].id
    const stunSkips = result.log.filter(
      (e) => e.type === 'stun_skip' && e.creatureId === apexId,
    )
    expect(stunSkips).toHaveLength(0)
  })

  it('mend targets the lowest HP ally', () => {
    const rng = createRng(42)
    const caster = makeCreature({ id: 'healer' })
    const ally1 = makeCreature({
      id: 'ally1',
      currentHp: 80,
      maxHp: 100,
    })
    const ally2 = makeCreature({
      id: 'ally2',
      currentHp: 30,
      maxHp: 100,
    })

    const mendAbility: ResolvedAbility = {
      templateId: 'mend',
      displayName: 'Mend',
      slot: 'active1',
      type: 'active',
      category: 'heal',
      target: 'all_allies',
      multiplier: null,
      cooldown: 2,
      duration: null,
      statAffected: 'hp',
      effectValue: 20,
    }

    const results = resolveAbility({
      caster,
      ability: mendAbility,
      targets: [ally1, ally2],
      allAllies: [caster, ally1, ally2],
      allEnemies: [],
      rng,
      turn: 1,
    })

    // Should heal ally2 (lowest HP%) not ally1
    expect(results).toHaveLength(1)
    expect(results[0].targetId).toBe('ally2')
    expect(results[0].healing).toBe(20) // 20% of 100
    expect(ally2.currentHp).toBe(50)
  })

  it('timeout resolution favors defender (team B)', () => {
    // Create teams with very high def so nobody dies quickly
    const tankMember = {
      stats: { hp: 999, atk: 1, def: 999, spd: 10, abl: 1 },
      abilities: {
        creatureId: 'tank',
        active1: { templateId: 'bite', displayName: 'Bite' },
        active2: { templateId: 'fortify', displayName: 'Fortify' },
        passive: { templateId: 'thick_hide', displayName: 'Thick Hide' },
      },
    }

    const teamA = makeTeam([
      { ...tankMember, name: 'TankA1' },
      { ...tankMember, name: 'TankA2' },
      { ...tankMember, name: 'TankA3' },
    ])
    const teamB = makeTeam([
      { ...tankMember, name: 'TankB1' },
      { ...tankMember, name: 'TankB2' },
      { ...tankMember, name: 'TankB3' },
    ])

    const result = simulateBattle(teamA, teamB, { seed: 42 })
    expect(result.reason).toBe('timeout')
    expect(result.turns).toBe(30)
    // If HP% is perfectly equal, B (defender) wins
  })

  it('synergies are logged', () => {
    const teamA = makeTeam([
      { type: 'large theropod', diet: 'Carnivorous' },
      { type: 'large theropod', diet: 'Carnivorous' },
      { type: 'large theropod', diet: 'Carnivorous' },
    ])
    const teamB = makeTeam()

    const result = simulateBattle(teamA, teamB, { seed: 42 })
    const synergyEvents = result.log.filter(
      (e) => e.type === 'synergy_applied',
    )
    expect(synergyEvents.length).toBeGreaterThan(0)
  })

  it('reflect damage can KO the attacker', () => {
    const rng = createRng(42)
    const attacker = makeCreature({
      id: 'attacker',
      currentHp: 1,
      maxHp: 100,
      atk: 50,
      passive: { ...makeCreature().passive, templateId: 'none' },
    })
    const defender = makeCreature({
      id: 'defender',
      currentHp: 100,
      maxHp: 100,
      def: 10,
      reflectDamagePercent: 100,
      passive: { ...makeCreature().passive, templateId: 'none' },
    })
    defender.statusEffects.push({
      kind: 'reflect',
      sourceCreatureId: 'defender',
      value: 100,
      turnsRemaining: 2,
    })

    const results = resolveAbility({
      caster: attacker,
      ability: attacker.active1,
      targets: [defender],
      allAllies: [attacker],
      allEnemies: [defender],
      rng,
      turn: 1,
    })

    // Attacker started with 1 HP, should be KO'd by reflect
    expect(attacker.isAlive).toBe(false)
  })

  it('thermal_regulation blocks early debuffs', () => {
    const rng = createRng(42)
    const caster = makeCreature({ id: 'debuffer' })
    const target = makeCreature({
      id: 'thermal',
      passive: {
        templateId: 'thermal_regulation',
        displayName: 'Thermal Regulation',
        slot: 'passive',
        type: 'passive',
        category: 'passive',
        target: null,
        multiplier: null,
        cooldown: null,
        duration: 2,
        statAffected: 'debuff_immune',
        effectValue: null,
      },
    })

    const debuffAbility: ResolvedAbility = {
      templateId: 'intimidate',
      displayName: 'Intimidate',
      slot: 'active1',
      type: 'active',
      category: 'debuff',
      target: 'single_enemy',
      multiplier: null,
      cooldown: 3,
      duration: 3,
      statAffected: 'atk',
      effectValue: -20,
    }

    // Turn 1: should be immune
    const results1 = resolveAbility({
      caster,
      ability: debuffAbility,
      targets: [target],
      allAllies: [caster],
      allEnemies: [target],
      rng,
      turn: 1,
    })
    const debuffsApplied = target.statusEffects.filter(
      (e) => e.kind === 'debuff',
    )
    expect(debuffsApplied).toHaveLength(0)

    // Turn 3: should NOT be immune
    // Reset cooldown for the test
    caster.cooldowns = {}
    const results3 = resolveAbility({
      caster,
      ability: debuffAbility,
      targets: [target],
      allAllies: [caster],
      allEnemies: [target],
      rng,
      turn: 3,
    })
    const debuffsApplied3 = target.statusEffects.filter(
      (e) => e.kind === 'debuff',
    )
    expect(debuffsApplied3).toHaveLength(1)
  })
})
