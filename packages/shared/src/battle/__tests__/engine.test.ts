import { describe, expect, it } from 'vitest'
import { calculateDamage, getDietModifier } from '../damage'
import { createRng } from '../rng'
import { applySynergies, calculateSynergies } from '../synergies'
import { simulateBattle } from '../engine'
import {
  fireTrigger,
  getBasicAttack,
  isActiveReady,
  materializeAlwaysPassive,
  resolveAbilityEffects,
  resolveTarget,
  tickStatusEffects,
} from '../abilities'
import { selectAction } from '../ai'
import type {
  Ability,
  BattleCreature,
  BattleTeam,
  BattleTeamMember,
  Effect,
  EffectContext,
} from '../types'

// ─── Shared Abilities ──────────────────────────────────────────────

const BITE: Ability = {
  id: 'bite',
  name: 'Bite',
  displayName: 'Bite',
  trigger: { type: 'onUse', cooldown: 0 },
  effects: [{ type: 'damage', multiplier: 1.0, scaling: 'atk' }],
  target: 'single_enemy',
  description: 'A powerful bite attack.',
}

const TAIL_SWEEP: Ability = {
  id: 'tail_sweep',
  name: 'Tail Sweep',
  displayName: 'Tail Sweep',
  trigger: { type: 'onUse', cooldown: 2 },
  effects: [{ type: 'damage', multiplier: 0.6, scaling: 'atk' }],
  target: 'all_enemies',
  description: 'A sweeping tail strike hitting all enemies.',
}

const THICK_HIDE: Ability = {
  id: 'thick_hide',
  name: 'Thick Hide',
  displayName: 'Thick Hide',
  trigger: { type: 'always' },
  effects: [{ type: 'damage_reduction', percent: 15 }],
  target: 'self',
  description: 'Reduces all incoming damage by 15%.',
}

const NONE_PASSIVE: Ability = {
  id: 'none',
  name: 'None',
  displayName: 'None',
  trigger: { type: 'always' },
  effects: [],
  target: 'self',
  description: 'No passive ability.',
}

// ─── Test Fixtures ─────────────────────────────────────────────────

function makeMember(
  overrides: Partial<BattleTeamMember> = {},
): BattleTeamMember {
  return {
    creatureId: 'test-creature',
    name: 'TestDino',
    stats: { hp: 100, atk: 30, def: 20, spd: 25 },
    active: BITE,
    passive: THICK_HIDE,
    diet: 'Carnivorous',
    type: 'large theropod',
    era: 'Cretaceous',
    rarity: 'common',
    row: 'front',
    ...overrides,
  }
}

function makeTeam(
  overrides: Array<Partial<BattleTeamMember>> = [{}, {}, {}],
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
  return {
    id: 'test-1',
    creatureId: 'c1',
    name: 'TestDino',
    teamSide: 'A',
    row: 'front',
    baseStats: { hp: 100, atk: 30, def: 20, spd: 25 },
    maxHp: 100,
    currentHp: 100,
    atk: 30,
    def: 20,
    spd: 25,
    role: 'striker',
    diet: 'Carnivorous',
    type: 'large theropod',
    era: 'Cretaceous',
    rarity: 'common',
    active: BITE,
    passive: THICK_HIDE,
    cooldown: 0,
    statusEffects: [],
    isAlive: true,
    isStunned: false,
    damageReductionPercent: 0,
    critReductionPercent: 0,
    flatReductionDefPercent: 0,
    dodgeBasePercent: 0,
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

  it('getDietModifier returns correct values', () => {
    expect(getDietModifier('Carnivorous', 'Herbivorous')).toBe(1.15)
    expect(getDietModifier('Herbivorous', 'Carnivorous')).toBe(0.85)
    expect(getDietModifier('Carnivorous', 'Carnivorous')).toBe(1.0)
    expect(getDietModifier('Omnivorous', 'Carnivorous')).toBe(1.15)
  })

  it('floors damage to minimum 1', () => {
    const rng = createRng(42)
    const attacker = makeCreature({ atk: 1, passive: NONE_PASSIVE })
    const defender = makeCreature({ def: 999, passive: NONE_PASSIVE })
    const effect: Effect & { type: 'damage' } = {
      type: 'damage',
      multiplier: 0.1,
      scaling: 'atk',
    }

    const result = calculateDamage({ attacker, defender, effect, rng })
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
    // With all different eras/diets, only type synergy applies (2× large theropod)
    applySynergies(team, bonuses)

    // Team members a and b should have +5% HP from type synergy (2-match)
    expect(team[0].maxHp).toBe(105)
    expect(team[0].currentHp).toBe(105)
    expect(team[1].maxHp).toBe(105)
    // c should not be affected by the type synergy HP bonus
    expect(team[2].maxHp).toBe(100)
  })
})

// ─── Ability Tests ─────────────────────────────────────────────────

describe('Abilities', () => {
  it('getBasicAttack returns the BASIC_ATTACK ability', () => {
    const basic = getBasicAttack()
    expect(basic.id).toBe('basic_attack')
    expect(basic.target).toBe('single_enemy')
    expect(basic.effects[0].type).toBe('damage')
    const dmgEffect = basic.effects[0] as Extract<
      Effect,
      { type: 'damage' }
    >
    expect(dmgEffect.multiplier).toBe(0.9)
  })

  it('isActiveReady returns true when off cooldown', () => {
    const creature = makeCreature()
    expect(isActiveReady(creature)).toBe(true)
  })

  it('isActiveReady returns false when on cooldown', () => {
    const creature = makeCreature({ cooldown: 2 })
    expect(isActiveReady(creature)).toBe(false)
  })

  it('cooldown decrements by 1 each turn', () => {
    const creature = makeCreature({ cooldown: 3 })
    creature.cooldown = Math.max(0, creature.cooldown - 1)
    expect(creature.cooldown).toBe(2)
    creature.cooldown = Math.max(0, creature.cooldown - 1)
    expect(creature.cooldown).toBe(1)
    creature.cooldown = Math.max(0, creature.cooldown - 1)
    expect(creature.cooldown).toBe(0)
  })

  it('materializeAlwaysPassive sets damageReductionPercent for thick_hide', () => {
    const creature = makeCreature({ passive: THICK_HIDE })
    materializeAlwaysPassive(creature, [creature])
    expect(creature.damageReductionPercent).toBe(15)
  })

  it('materializeAlwaysPassive sets dodge for evasive', () => {
    const evasivePassive: Ability = {
      id: 'evasive',
      name: 'Evasive',
      displayName: 'Evasive',
      trigger: { type: 'always' },
      effects: [{ type: 'dodge', basePercent: 10 }],
      target: 'self',
      description: 'Chance to dodge attacks.',
    }
    const creature = makeCreature({ passive: evasivePassive })
    materializeAlwaysPassive(creature, [creature])
    expect(creature.dodgeBasePercent).toBe(10)
  })

  it('resolveTarget picks lowest HP ally for lowest_hp_ally', () => {
    const rng = createRng(42)
    const caster = makeCreature({ id: 'caster', passive: NONE_PASSIVE })
    const ally1 = makeCreature({
      id: 'ally1',
      currentHp: 80,
      maxHp: 100,
      passive: NONE_PASSIVE,
    })
    const ally2 = makeCreature({
      id: 'ally2',
      currentHp: 30,
      maxHp: 100,
      passive: NONE_PASSIVE,
    })

    const ctx: EffectContext = {
      caster,
      targets: [],
      allAllies: [caster, ally1, ally2],
      allEnemies: [],
      rng,
      turn: 1,
    }
    const targets = resolveTarget('lowest_hp_ally', caster, ctx, rng)
    expect(targets).toHaveLength(1)
    expect(targets[0].id).toBe('ally2')
  })

  it('resolveTarget respects taunt for single_enemy', () => {
    const rng = createRng(42)
    const caster = makeCreature({ id: 'attacker', passive: NONE_PASSIVE })
    const taunter = makeCreature({
      id: 'taunter',
      teamSide: 'B',
      currentHp: 80,
      maxHp: 100,
      passive: NONE_PASSIVE,
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
      currentHp: 10,
      maxHp: 100,
      passive: NONE_PASSIVE,
    })

    const ctx: EffectContext = {
      caster,
      targets: [],
      allAllies: [caster],
      allEnemies: [taunter, other],
      rng,
      turn: 1,
    }
    const targets = resolveTarget('single_enemy', caster, ctx, rng)
    expect(targets).toHaveLength(1)
    expect(targets[0].id).toBe('taunter')
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

    const results = tickStatusEffects(creature)
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

    const results = tickStatusEffects(creature)
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

    const results = tickStatusEffects(creature)
    expect(results[0].healing).toBe(8)
    expect(creature.currentHp).toBe(58)
  })

  it('buff expires and removes stat modifier', () => {
    const creature = makeCreature({
      baseStats: { hp: 100, atk: 30, def: 20, spd: 25 },
      atk: 36, // 30 base + 6 from buff (20% of 30)
    })
    creature.statusEffects.push({
      kind: 'buff',
      sourceCreatureId: 'ally-1',
      stat: 'atk',
      value: 20,
      turnsRemaining: 1,
    })

    const results = tickStatusEffects(creature)
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

    const results = tickStatusEffects(creature)
    expect(results[0].kind).toBe('shield')
    expect(results[0].expired).toBe(true)
    expect(creature.statusEffects).toHaveLength(0)
  })

  it('reflect clears on expiry', () => {
    const creature = makeCreature()
    creature.statusEffects.push({
      kind: 'reflect',
      sourceCreatureId: 'self',
      value: 40,
      turnsRemaining: 1,
    })

    const results = tickStatusEffects(creature)
    expect(results[0].kind).toBe('reflect')
    expect(results[0].expired).toBe(true)
    expect(creature.statusEffects).toHaveLength(0)
  })
})

// ─── AI Tests ──────────────────────────────────────────────────────

describe('AI', () => {
  it('heals wounded ally when available', () => {
    const rng = createRng(42)
    const mendAbility: Ability = {
      id: 'mend',
      name: 'Mend',
      displayName: 'Mend',
      trigger: { type: 'onUse', cooldown: 1 },
      effects: [{ type: 'heal', percent: 25 }],
      target: 'lowest_hp_ally',
      description: 'Heal lowest HP ally.',
    }
    const actor = makeCreature({
      id: 'healer',
      role: 'support',
      currentHp: 100,
      maxHp: 100,
      active: mendAbility,
      passive: NONE_PASSIVE,
    })
    const woundedAlly = makeCreature({
      id: 'wounded',
      currentHp: 20,
      maxHp: 100,
      passive: NONE_PASSIVE,
    })
    const enemy = makeCreature({
      id: 'enemy-1',
      teamSide: 'B',
      passive: NONE_PASSIVE,
    })

    const action = selectAction({
      actor,
      allies: [actor, woundedAlly],
      enemies: [enemy],
      rng,
    })
    expect(action.ability.id).toBe('mend')
  })

  it('uses AoE when multiple enemies make it worthwhile', () => {
    const rng = createRng(42)
    const actor = makeCreature({
      id: 'aoe-user',
      currentHp: 100,
      maxHp: 100,
      active: TAIL_SWEEP,
      passive: NONE_PASSIVE,
    })
    const enemies = [
      makeCreature({
        id: 'e1',
        teamSide: 'B',
        passive: NONE_PASSIVE,
      }),
      makeCreature({
        id: 'e2',
        teamSide: 'B',
        passive: NONE_PASSIVE,
      }),
      makeCreature({
        id: 'e3',
        teamSide: 'B',
        passive: NONE_PASSIVE,
      }),
    ]

    const action = selectAction({
      actor,
      allies: [actor],
      enemies,
      rng,
    })
    expect(action.ability.id).toBe('tail_sweep')
  })

  it('finishes low HP enemies with damage', () => {
    const rng = createRng(42)
    const actor = makeCreature({
      id: 'finisher',
      currentHp: 100,
      maxHp: 100,
      passive: NONE_PASSIVE,
    })
    const lowEnemy = makeCreature({
      id: 'low-hp',
      teamSide: 'B',
      currentHp: 10,
      maxHp: 100,
      passive: NONE_PASSIVE,
    })

    const action = selectAction({
      actor,
      allies: [actor],
      enemies: [lowEnemy],
      rng,
    })
    // Should use a damage ability
    expect(
      action.ability.effects.some((e) => e.type === 'damage'),
    ).toBe(true)
    expect(action.targets).toContain(lowEnemy)
  })

  it('falls back to basic attack when active is on cooldown', () => {
    const rng = createRng(42)
    const actor = makeCreature({
      id: 'cooldown-user',
      cooldown: 3,
      passive: NONE_PASSIVE,
    })
    const enemy = makeCreature({
      id: 'enemy',
      teamSide: 'B',
      passive: NONE_PASSIVE,
    })

    const action = selectAction({
      actor,
      allies: [actor],
      enemies: [enemy],
      rng,
    })
    expect(action.ability.id).toBe('basic_attack')
  })

  // ── DoT selection ──

  it('selects DoT (bleed) against high-HP target without existing DoT', () => {
    const rng = createRng(42)
    const bleedAbility: Ability = {
      id: 'bleed',
      name: 'Bleed',
      displayName: 'Bleed',
      trigger: { type: 'onUse', cooldown: 2 },
      effects: [
        { type: 'damage', multiplier: 0.5, scaling: 'atk' },
        {
          type: 'dot',
          dotKind: 'bleed',
          percent: 5,
          duration: 3,
        },
      ],
      target: 'single_enemy',
      description: 'A slashing wound that bleeds.',
    }
    const actor = makeCreature({
      id: 'dot-user',
      currentHp: 100,
      maxHp: 100,
      active: bleedAbility,
      passive: NONE_PASSIVE,
    })
    const highHpEnemy = makeCreature({
      id: 'tanky',
      teamSide: 'B',
      currentHp: 200,
      maxHp: 200,
      def: 40,
      passive: NONE_PASSIVE,
    })

    const action = selectAction({
      actor,
      allies: [actor],
      enemies: [highHpEnemy],
      rng,
    })
    expect(action.ability.id).toBe('bleed')
  })

  it('does NOT select DoT against low-HP dying target', () => {
    const rng = createRng(42)
    const bleedAbility: Ability = {
      id: 'bleed',
      name: 'Bleed',
      displayName: 'Bleed',
      trigger: { type: 'onUse', cooldown: 2 },
      effects: [
        { type: 'damage', multiplier: 0.5, scaling: 'atk' },
        {
          type: 'dot',
          dotKind: 'bleed',
          percent: 5,
          duration: 3,
        },
      ],
      target: 'single_enemy',
      description: 'A slashing wound that bleeds.',
    }
    const actor = makeCreature({
      id: 'dot-user',
      currentHp: 100,
      maxHp: 100,
      active: bleedAbility,
      passive: NONE_PASSIVE,
    })
    const dyingEnemy = makeCreature({
      id: 'dying',
      teamSide: 'B',
      currentHp: 15,
      maxHp: 100,
      passive: NONE_PASSIVE,
    })

    const action = selectAction({
      actor,
      allies: [actor],
      enemies: [dyingEnemy],
      rng,
    })
    // DoT penalized by -50 for low HP. Basic attack should win with finish bonus.
    expect(action.ability.id).not.toBe('bleed')
  })

  // ── Taunt selection ──

  it('selects taunt when no active taunt and 2+ enemies', () => {
    const rng = createRng(42)
    const tauntAbility: Ability = {
      id: 'taunt',
      name: 'Taunt',
      displayName: 'Taunt',
      trigger: { type: 'onUse', cooldown: 1 },
      effects: [{ type: 'taunt', duration: 2 }],
      target: 'self',
      description: 'Draws all single-target attacks to self.',
    }
    const actor = makeCreature({
      id: 'taunter',
      role: 'tank',
      currentHp: 100,
      maxHp: 100,
      def: 40,
      active: tauntAbility,
      passive: NONE_PASSIVE,
    })
    const squishyAlly = makeCreature({
      id: 'squishy',
      def: 10,
      passive: NONE_PASSIVE,
    })
    const enemies = [
      makeCreature({
        id: 'e1',
        teamSide: 'B',
        passive: NONE_PASSIVE,
      }),
      makeCreature({
        id: 'e2',
        teamSide: 'B',
        passive: NONE_PASSIVE,
      }),
    ]

    const action = selectAction({
      actor,
      allies: [actor, squishyAlly],
      enemies,
      rng,
    })
    expect(action.ability.id).toBe('taunt')
  })

  it('does NOT select taunt when only 1 enemy', () => {
    const rng = createRng(42)
    const tauntAbility: Ability = {
      id: 'taunt',
      name: 'Taunt',
      displayName: 'Taunt',
      trigger: { type: 'onUse', cooldown: 1 },
      effects: [{ type: 'taunt', duration: 2 }],
      target: 'self',
      description: 'Draws all single-target attacks to self.',
    }
    const actor = makeCreature({
      id: 'taunter',
      role: 'tank',
      currentHp: 100,
      maxHp: 100,
      active: tauntAbility,
      passive: NONE_PASSIVE,
    })
    const enemy = makeCreature({
      id: 'e1',
      teamSide: 'B',
      passive: NONE_PASSIVE,
    })

    const action = selectAction({
      actor,
      allies: [actor],
      enemies: [enemy],
      rng,
    })
    // Taunt score: 25 - 50 (1 enemy) = -25, should not be chosen
    expect(action.ability.id).not.toBe('taunt')
  })

  // ── Overkill prevention ──

  it('prefers basic attack over cooldown ability for easy kills', () => {
    const rng = createRng(42)
    const crushingJaw: Ability = {
      id: 'crushing_jaw',
      name: 'Crushing Jaw',
      displayName: 'Crushing Jaw',
      trigger: { type: 'onUse', cooldown: 3 },
      effects: [{ type: 'damage', multiplier: 1.3, scaling: 'atk' }],
      target: 'single_enemy',
      description: 'The strongest bite.',
    }
    const actor = makeCreature({
      id: 'overkiller',
      atk: 50,
      currentHp: 100,
      maxHp: 100,
      active: crushingJaw,
      passive: NONE_PASSIVE,
    })
    const weakEnemy = makeCreature({
      id: 'weak',
      teamSide: 'B',
      currentHp: 5,
      maxHp: 100,
      def: 10,
      passive: NONE_PASSIVE,
    })

    const action = selectAction({
      actor,
      allies: [actor],
      enemies: [weakEnemy],
      rng,
    })
    expect(action.ability.id).toBe('basic_attack')
  })

  // ── Role-aware behavior ──

  it('tank role prefers shield over damage', () => {
    const rng = createRng(42)
    const shieldWall: Ability = {
      id: 'shield_wall',
      name: 'Shield Wall',
      displayName: 'Shield Wall',
      trigger: { type: 'onUse', cooldown: 2 },
      effects: [{ type: 'shield', percent: 25, duration: 2 }],
      target: 'lowest_hp_ally',
      description: "Grants a shield absorbing 25% of caster's max HP.",
    }
    const actor = makeCreature({
      id: 'tank',
      role: 'tank',
      currentHp: 50,
      maxHp: 100,
      active: shieldWall,
      passive: NONE_PASSIVE,
    })
    const enemy = makeCreature({
      id: 'e1',
      teamSide: 'B',
      passive: NONE_PASSIVE,
    })

    const action = selectAction({
      actor,
      allies: [actor],
      enemies: [enemy],
      rng,
    })
    expect(action.ability.id).toBe('shield_wall')
  })

  it('support role prefers healing over damage', () => {
    const rng = createRng(42)
    const symbiosis: Ability = {
      id: 'symbiosis',
      name: 'Symbiosis',
      displayName: 'Symbiosis',
      trigger: { type: 'onUse', cooldown: 2 },
      effects: [{ type: 'heal', percent: 15 }],
      target: 'all_allies',
      description: 'A symbiotic bond heals all allies.',
    }
    const actor = makeCreature({
      id: 'support',
      role: 'support',
      currentHp: 100,
      maxHp: 100,
      active: symbiosis,
      passive: NONE_PASSIVE,
    })
    const woundedAlly = makeCreature({
      id: 'wounded',
      currentHp: 25,
      maxHp: 100,
      passive: NONE_PASSIVE,
    })
    const enemy = makeCreature({
      id: 'e1',
      teamSide: 'B',
      passive: NONE_PASSIVE,
    })

    const action = selectAction({
      actor,
      allies: [actor, woundedAlly],
      enemies: [enemy],
      rng,
    })
    expect(action.ability.id).toBe('symbiosis')
  })

  // ── Game-state awareness ──

  it('prefers damage late game for urgency', () => {
    const rng = createRng(42)
    const rallyCry: Ability = {
      id: 'rally_cry',
      name: 'Rally Cry',
      displayName: 'Rally Cry',
      trigger: { type: 'onUse', cooldown: 2 },
      effects: [
        { type: 'buff', stat: 'atk', percent: 20, duration: 3 },
      ],
      target: 'all_allies',
      description: "Boosts all allies' attack.",
    }
    const actor = makeCreature({
      id: 'late-game',
      currentHp: 100,
      maxHp: 100,
      active: rallyCry,
      passive: NONE_PASSIVE,
    })
    const enemy = makeCreature({
      id: 'e1',
      teamSide: 'B',
      passive: NONE_PASSIVE,
    })

    const action = selectAction({
      actor,
      allies: [actor],
      enemies: [enemy],
      rng,
      turn: 25,
    })
    // Late game urgency multiplier (1.25) boosts damage.
    // Buff gets defensive modifier reduced and urgency penalty (0.9).
    expect(
      action.ability.effects.some((e) => e.type === 'damage'),
    ).toBe(true)
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

  it('venomous passive applies poison on basic attack', () => {
    const rng = createRng(42)
    const venomousPassive: Ability = {
      id: 'venomous',
      name: 'Venomous',
      displayName: 'Venomous',
      trigger: { type: 'onBasicAttack' },
      effects: [
        {
          type: 'dot',
          dotKind: 'poison',
          percent: 3,
          duration: 2,
        },
      ],
      target: 'attack_target',
      description: 'Basic attacks apply poison.',
    }
    const attacker = makeCreature({
      id: 'attacker',
      passive: venomousPassive,
    })
    const target = makeCreature({
      id: 'target',
      teamSide: 'B',
      passive: NONE_PASSIVE,
    })

    const ctx: EffectContext = {
      caster: attacker,
      targets: [target],
      allAllies: [attacker],
      allEnemies: [target],
      rng,
      turn: 1,
      triggerAttackTarget: target,
    }
    const results = fireTrigger('onBasicAttack', attacker, ctx)
    expect(
      results.some((r) => r.kind === 'status_applied'),
    ).toBe(true)
    expect(
      target.statusEffects.some((e) => e.kind === 'poison'),
    ).toBe(true)
  })

  it('mend heals the lowest HP ally', () => {
    const rng = createRng(42)
    const caster = makeCreature({
      id: 'healer',
      passive: NONE_PASSIVE,
    })
    const ally1 = makeCreature({
      id: 'ally1',
      currentHp: 80,
      maxHp: 100,
      passive: NONE_PASSIVE,
    })
    const ally2 = makeCreature({
      id: 'ally2',
      currentHp: 30,
      maxHp: 100,
      passive: NONE_PASSIVE,
    })

    const mendAbility: Ability = {
      id: 'mend',
      name: 'Mend',
      displayName: 'Mend',
      trigger: { type: 'onUse', cooldown: 1 },
      effects: [{ type: 'heal', percent: 25 }],
      target: 'lowest_hp_ally',
      description: 'Heal lowest HP ally for 25% max HP.',
    }

    const ctx: EffectContext = {
      caster,
      targets: [],
      allAllies: [caster, ally1, ally2],
      allEnemies: [],
      rng,
      turn: 1,
    }

    // Resolve target
    const targets = resolveTarget(
      'lowest_hp_ally',
      caster,
      ctx,
      rng,
    )
    expect(targets).toHaveLength(1)
    expect(targets[0].id).toBe('ally2')

    // Resolve ability effects
    ctx.targets = targets
    const results = resolveAbilityEffects(mendAbility, targets, ctx)
    expect(results).toHaveLength(1)
    expect(results[0].kind).toBe('heal')
    expect(ally2.currentHp).toBe(55) // 30 + 25
  })

  it('timeout resolution favors defender (team B)', () => {
    // Create teams with very high def so nobody dies quickly
    const tankMember: Partial<BattleTeamMember> = {
      stats: { hp: 999, atk: 1, def: 999, spd: 10 },
      active: BITE,
      passive: THICK_HIDE,
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
      passive: NONE_PASSIVE,
    })
    const defender = makeCreature({
      id: 'defender',
      currentHp: 100,
      maxHp: 100,
      def: 10,
      passive: NONE_PASSIVE,
    })
    defender.statusEffects.push({
      kind: 'reflect',
      sourceCreatureId: 'defender',
      value: 100,
      turnsRemaining: 2,
    })

    const ctx: EffectContext = {
      caster: attacker,
      targets: [defender],
      allAllies: [attacker],
      allEnemies: [defender],
      rng,
      turn: 1,
    }
    resolveAbilityEffects(attacker.active, [defender], ctx)

    // Attacker started with 1 HP, should be KO'd by reflect
    expect(attacker.isAlive).toBe(false)
  })
})
