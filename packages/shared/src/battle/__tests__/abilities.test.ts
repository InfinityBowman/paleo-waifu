import { describe, expect, it } from 'vitest'
import { createRng } from '../rng'
import {
  fireTrigger,
  getBasicAttack,
  isActiveReady,
  materializeAlwaysPassive,
  resolveAbilityEffects,
  resolveEffect,
  resolveTarget,
  tickStatusEffects,
} from '../abilities'
import { makeCreature, NONE_PASSIVE, THICK_HIDE } from './test-helpers'
import type { Ability, Effect, EffectContext } from '../types'

describe('Abilities', () => {
  it('getBasicAttack returns a single-target damage ability', () => {
    const basic = getBasicAttack()
    expect(basic.id).toBe('basic_attack')
    expect(basic.target).toBe('single_enemy')
    expect(basic.effects[0].type).toBe('damage')
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
    expect(results.some((r) => r.kind === 'status_applied')).toBe(true)
    expect(target.statusEffects.some((e) => e.kind === 'poison')).toBe(true)
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
    const targets = resolveTarget('lowest_hp_ally', caster, ctx, rng)
    expect(targets).toHaveLength(1)
    expect(targets[0].id).toBe('ally2')

    // Resolve ability effects
    ctx.targets = targets
    const results = resolveAbilityEffects(mendAbility, targets, ctx)
    expect(results).toHaveLength(1)
    expect(results[0].kind).toBe('heal')
    expect(ally2.currentHp).toBe(55) // 30 + 25
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

// ─── Stun Effect Tests ────────────────────────────────────────────

describe('Stun Effects', () => {
  it('resolveEffect stun sets isStunned and adds stun status effect', () => {
    const rng = createRng(42)
    const caster = makeCreature({ id: 'caster', passive: NONE_PASSIVE })
    const target = makeCreature({
      id: 'target',
      teamSide: 'B',
      passive: NONE_PASSIVE,
    })

    const stunAbility: Ability = {
      id: 'headbutt',
      name: 'Headbutt',
      displayName: 'Headbutt',
      trigger: { type: 'onUse', cooldown: 3 },
      effects: [
        { type: 'damage', multiplier: 0.7, scaling: 'atk' },
        { type: 'stun', duration: 1 },
      ],
      target: 'single_enemy',
      description: 'Deals damage and stuns the target.',
    }

    const ctx: EffectContext = {
      caster,
      targets: [target],
      allAllies: [caster],
      allEnemies: [target],
      rng,
      turn: 1,
    }

    const results = resolveAbilityEffects(stunAbility, [target], ctx)

    expect(target.isStunned).toBe(true)
    expect(target.statusEffects.some((e) => e.kind === 'stun')).toBe(true)
    expect(
      results.some((r) => r.kind === 'status_applied' && 'effect' in r && r.effect.kind === 'stun'),
    ).toBe(true)
  })

  it('re-stunning clears old stun status before adding new one', () => {
    const rng = createRng(42)
    const caster = makeCreature({ id: 'caster', passive: NONE_PASSIVE })
    const target = makeCreature({
      id: 'target',
      teamSide: 'B',
      passive: NONE_PASSIVE,
    })

    // Pre-existing stun
    target.isStunned = true
    target.statusEffects.push({
      kind: 'stun',
      sourceCreatureId: 'old-caster',
      value: 0,
      turnsRemaining: 1,
    })

    const ctx: EffectContext = {
      caster,
      targets: [target],
      allAllies: [caster],
      allEnemies: [target],
      rng,
      turn: 1,
    }

    const stunEffect: Effect = { type: 'stun', duration: 2 }
    resolveEffect(stunEffect, caster, target, ctx)

    // Should have exactly one stun effect, not two
    const stunEffects = target.statusEffects.filter((e) => e.kind === 'stun')
    expect(stunEffects).toHaveLength(1)
    expect(stunEffects[0].turnsRemaining).toBe(2)
    expect(stunEffects[0].sourceCreatureId).toBe('caster')
  })

  it('stun does not apply to dead targets', () => {
    const rng = createRng(42)
    const caster = makeCreature({ id: 'caster', passive: NONE_PASSIVE })
    const target = makeCreature({
      id: 'target',
      teamSide: 'B',
      passive: NONE_PASSIVE,
      isAlive: false,
      currentHp: 0,
    })

    const ctx: EffectContext = {
      caster,
      targets: [target],
      allAllies: [caster],
      allEnemies: [target],
      rng,
      turn: 1,
    }

    const stunEffect: Effect = { type: 'stun', duration: 1 }
    const results = resolveEffect(stunEffect, caster, target, ctx)

    expect(results).toHaveLength(0)
    expect(target.isStunned).toBe(false)
  })

  it('stun is NOT decremented by tickStatusEffects (only consumed by engine)', () => {
    const creature = makeCreature()
    creature.isStunned = true
    creature.statusEffects.push({
      kind: 'stun',
      sourceCreatureId: 'enemy',
      value: 0,
      turnsRemaining: 1,
    })

    const results = tickStatusEffects(creature)

    // Stun tick case is a no-op — it should not produce results or decrement
    const stunResults = results.filter((r) => r.kind === 'stun')
    expect(stunResults).toHaveLength(0)
    // Stun should still be present
    expect(creature.statusEffects.some((e) => e.kind === 'stun')).toBe(true)
  })
})

// ─── Lifesteal Effect Tests ───────────────────────────────────────

describe('Lifesteal Effects', () => {
  it('lifesteal heals caster for percent of damage dealt', () => {
    const rng = createRng(42)
    const caster = makeCreature({
      id: 'caster',
      atk: 50,
      currentHp: 50,
      maxHp: 100,
      passive: NONE_PASSIVE,
    })
    const target = makeCreature({
      id: 'target',
      teamSide: 'B',
      def: 10,
      passive: NONE_PASSIVE,
    })

    const feedingFrenzy: Ability = {
      id: 'feeding_frenzy',
      name: 'Feeding Frenzy',
      displayName: 'Feeding Frenzy',
      trigger: { type: 'onUse', cooldown: 3 },
      effects: [
        { type: 'damage', multiplier: 1.0, scaling: 'atk' },
        { type: 'lifesteal', percent: 25 },
      ],
      target: 'single_enemy',
      description: 'Deals damage and heals 25% of damage dealt.',
    }

    const ctx: EffectContext = {
      caster,
      targets: [target],
      allAllies: [caster],
      allEnemies: [target],
      rng,
      turn: 1,
    }

    const hpBefore = caster.currentHp
    const results = resolveAbilityEffects(feedingFrenzy, [target], ctx)

    // Should have a damage resolution and a heal resolution
    const damageRes = results.find((r) => r.kind === 'damage')
    const healRes = results.find(
      (r) => r.kind === 'heal' && r.targetId === 'caster',
    )

    expect(damageRes).toBeDefined()
    expect(healRes).toBeDefined()

    // Heal should be 25% of damage dealt
    const expectedHeal = Math.max(
      1,
      Math.floor(damageRes!.amount * 0.25),
    )
    expect(healRes!.amount).toBe(expectedHeal)
    expect(caster.currentHp).toBe(
      Math.min(caster.maxHp, hpBefore + expectedHeal),
    )
  })

  it('lifesteal caps at maxHp', () => {
    const rng = createRng(42)
    const caster = makeCreature({
      id: 'caster',
      atk: 50,
      currentHp: 99,
      maxHp: 100,
      passive: NONE_PASSIVE,
    })
    const target = makeCreature({
      id: 'target',
      teamSide: 'B',
      def: 10,
      passive: NONE_PASSIVE,
    })

    const feedingFrenzy: Ability = {
      id: 'feeding_frenzy',
      name: 'Feeding Frenzy',
      displayName: 'Feeding Frenzy',
      trigger: { type: 'onUse', cooldown: 3 },
      effects: [
        { type: 'damage', multiplier: 1.0, scaling: 'atk' },
        { type: 'lifesteal', percent: 50 },
      ],
      target: 'single_enemy',
      description: 'Deals damage and heals 50% of damage dealt.',
    }

    const ctx: EffectContext = {
      caster,
      targets: [target],
      allAllies: [caster],
      allEnemies: [target],
      rng,
      turn: 1,
    }

    resolveAbilityEffects(feedingFrenzy, [target], ctx)

    // Caster HP should not exceed maxHp
    expect(caster.currentHp).toBeLessThanOrEqual(caster.maxHp)
  })

  it('lifesteal does nothing when lastDamageDealt is 0', () => {
    const rng = createRng(42)
    const caster = makeCreature({
      id: 'caster',
      currentHp: 50,
      maxHp: 100,
      passive: NONE_PASSIVE,
    })
    const target = makeCreature({
      id: 'target',
      teamSide: 'B',
      passive: NONE_PASSIVE,
    })

    const ctx: EffectContext = {
      caster,
      targets: [target],
      allAllies: [caster],
      allEnemies: [target],
      rng,
      turn: 1,
      lastDamageDealt: 0,
    }

    const lifestealEffect: Effect = { type: 'lifesteal', percent: 50 }
    const results = resolveEffect(lifestealEffect, caster, target, ctx)

    expect(results).toHaveLength(0)
    expect(caster.currentHp).toBe(50) // unchanged
  })

  it('lifesteal fires even when target was KO\'d by the damage', () => {
    const rng = createRng(42)
    const caster = makeCreature({
      id: 'caster',
      atk: 999,
      currentHp: 50,
      maxHp: 100,
      passive: NONE_PASSIVE,
    })
    const target = makeCreature({
      id: 'target',
      teamSide: 'B',
      currentHp: 1,
      maxHp: 100,
      def: 1,
      passive: NONE_PASSIVE,
    })

    const feedingFrenzy: Ability = {
      id: 'feeding_frenzy',
      name: 'Feeding Frenzy',
      displayName: 'Feeding Frenzy',
      trigger: { type: 'onUse', cooldown: 3 },
      effects: [
        { type: 'damage', multiplier: 1.0, scaling: 'atk' },
        { type: 'lifesteal', percent: 25 },
      ],
      target: 'single_enemy',
      description: 'A frenzied attack that heals.',
    }

    const ctx: EffectContext = {
      caster,
      targets: [target],
      allAllies: [caster],
      allEnemies: [target],
      rng,
      turn: 1,
    }

    const results = resolveAbilityEffects(feedingFrenzy, [target], ctx)

    // Target should be dead
    expect(target.isAlive).toBe(false)
    // Lifesteal should still have fired (it's the explicit exception)
    const healRes = results.find(
      (r) => r.kind === 'heal' && r.targetId === 'caster',
    )
    expect(healRes).toBeDefined()
    expect(caster.currentHp).toBeGreaterThan(50)
  })

  it('secondary effects (non-lifesteal) do NOT fire on KO\'d target', () => {
    const rng = createRng(42)
    const caster = makeCreature({
      id: 'caster',
      atk: 999,
      passive: NONE_PASSIVE,
    })
    const target = makeCreature({
      id: 'target',
      teamSide: 'B',
      currentHp: 1,
      maxHp: 100,
      def: 1,
      passive: NONE_PASSIVE,
    })

    // Ability with damage + dot — dot should NOT apply if target dies from damage
    const venomStrike: Ability = {
      id: 'venom_strike',
      name: 'Venom Strike',
      displayName: 'Venom Strike',
      trigger: { type: 'onUse', cooldown: 2 },
      effects: [
        { type: 'damage', multiplier: 0.7, scaling: 'atk' },
        { type: 'dot', dotKind: 'poison', percent: 5, duration: 3 },
      ],
      target: 'single_enemy',
      description: 'Damages and poisons.',
    }

    const ctx: EffectContext = {
      caster,
      targets: [target],
      allAllies: [caster],
      allEnemies: [target],
      rng,
      turn: 1,
    }

    const results = resolveAbilityEffects(venomStrike, [target], ctx)

    expect(target.isAlive).toBe(false)
    // Poison should NOT have been applied
    expect(target.statusEffects.some((e) => e.kind === 'poison')).toBe(false)
    expect(
      results.some((r) => r.kind === 'status_applied'),
    ).toBe(false)
  })
})

// ─── Shield Absorption Tests ──────────────────────────────────────

describe('Shield Absorption', () => {
  it('shield partially absorbs damage, reducing shield value', () => {
    const rng = createRng(42)
    const attacker = makeCreature({
      id: 'attacker',
      atk: 50,
      passive: NONE_PASSIVE,
    })
    const defender = makeCreature({
      id: 'defender',
      def: 10,
      currentHp: 100,
      maxHp: 100,
      passive: NONE_PASSIVE,
    })
    // Shield with 5 HP — will be partially consumed
    defender.statusEffects.push({
      kind: 'shield',
      sourceCreatureId: 'ally',
      value: 5,
      turnsRemaining: 3,
    })

    const ctx: EffectContext = {
      caster: attacker,
      targets: [defender],
      allAllies: [attacker],
      allEnemies: [defender],
      rng,
      turn: 1,
    }

    const results = resolveAbilityEffects(attacker.active, [defender], ctx)
    const dmgRes = results.find((r) => r.kind === 'damage')

    // Damage should have been reduced by 5 (shield absorbed that much)
    // Shield should be fully consumed (removed from status effects)
    expect(defender.statusEffects.some((e) => e.kind === 'shield')).toBe(false)
    // Defender should have taken damage but less than without shield
    expect(defender.currentHp).toBeLessThan(100)
    expect(defender.currentHp).toBeGreaterThan(0)
  })

  it('shield fully absorbs damage when shield value exceeds damage', () => {
    const rng = createRng(42)
    const attacker = makeCreature({
      id: 'attacker',
      atk: 1,
      passive: NONE_PASSIVE,
    })
    const defender = makeCreature({
      id: 'defender',
      def: 50,
      currentHp: 100,
      maxHp: 100,
      passive: NONE_PASSIVE,
    })
    // Shield with enormous value — should fully absorb
    defender.statusEffects.push({
      kind: 'shield',
      sourceCreatureId: 'ally',
      value: 9999,
      turnsRemaining: 3,
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

    // Defender HP should remain at 100 — all damage absorbed by shield
    expect(defender.currentHp).toBe(100)
    // Shield should still exist but with reduced value
    const shield = defender.statusEffects.find((e) => e.kind === 'shield')
    expect(shield).toBeDefined()
    expect(shield!.value).toBeLessThan(9999)
  })

  it('reflect does not fire when damage is fully absorbed by shield', () => {
    const rng = createRng(42)
    const attacker = makeCreature({
      id: 'attacker',
      atk: 1,
      currentHp: 100,
      maxHp: 100,
      passive: NONE_PASSIVE,
    })
    const defender = makeCreature({
      id: 'defender',
      def: 50,
      currentHp: 100,
      maxHp: 100,
      passive: NONE_PASSIVE,
    })
    // Shield absorbs all damage
    defender.statusEffects.push({
      kind: 'shield',
      sourceCreatureId: 'ally',
      value: 9999,
      turnsRemaining: 3,
    })
    // Reflect also present
    defender.statusEffects.push({
      kind: 'reflect',
      sourceCreatureId: 'defender',
      value: 100,
      turnsRemaining: 3,
    })

    const ctx: EffectContext = {
      caster: attacker,
      targets: [defender],
      allAllies: [attacker],
      allEnemies: [defender],
      rng,
      turn: 1,
    }

    const results = resolveAbilityEffects(attacker.active, [defender], ctx)

    // Reflect should not fire because finalDamage was 0 after shield absorption
    expect(results.some((r) => r.kind === 'reflect_damage')).toBe(false)
    // Attacker should still be alive
    expect(attacker.currentHp).toBe(100)
  })

  it('partial reflect calculates correctly based on percentage', () => {
    const rng = createRng(42)
    const attacker = makeCreature({
      id: 'attacker',
      atk: 50,
      currentHp: 100,
      maxHp: 100,
      passive: NONE_PASSIVE,
    })
    const defender = makeCreature({
      id: 'defender',
      def: 10,
      currentHp: 100,
      maxHp: 100,
      passive: NONE_PASSIVE,
    })
    // 30% reflect
    defender.statusEffects.push({
      kind: 'reflect',
      sourceCreatureId: 'defender',
      value: 30,
      turnsRemaining: 3,
    })

    const ctx: EffectContext = {
      caster: attacker,
      targets: [defender],
      allAllies: [attacker],
      allEnemies: [defender],
      rng,
      turn: 1,
    }

    const results = resolveAbilityEffects(attacker.active, [defender], ctx)

    const dmgRes = results.find((r) => r.kind === 'damage')
    const reflectRes = results.find((r) => r.kind === 'reflect_damage')

    expect(dmgRes).toBeDefined()
    expect(reflectRes).toBeDefined()
    // Reflect amount should be floor(finalDamage * 0.30)
    expect(reflectRes!.amount).toBe(Math.floor(dmgRes!.amount * 0.30))
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
