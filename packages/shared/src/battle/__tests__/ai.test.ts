import { describe, expect, it } from 'vitest'
import { createRng } from '../rng'
import { selectAction } from '../ai'
import { makeCreature, NONE_PASSIVE, TAIL_SWEEP } from './test-helpers'
import type { Ability } from '../types'

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
    expect(action.ability.effects.some((e) => e.type === 'damage')).toBe(true)
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
      effects: [{ type: 'buff', stat: 'atk', percent: 20, duration: 3 }],
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
    expect(action.ability.effects.some((e) => e.type === 'damage')).toBe(true)
  })
})
