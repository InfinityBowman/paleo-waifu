import type {
  Ability,
  BattleCreature,
  BattleTeam,
  BattleTeamMember,
} from '../types'

// ─── Shared Abilities ──────────────────────────────────────────────

export const BITE: Ability = {
  id: 'bite',
  name: 'Bite',
  displayName: 'Bite',
  trigger: { type: 'onUse', cooldown: 0 },
  effects: [{ type: 'damage', multiplier: 1.0, scaling: 'atk' }],
  target: 'single_enemy',
  description: 'A powerful bite attack.',
}

export const TAIL_SWEEP: Ability = {
  id: 'tail_sweep',
  name: 'Tail Sweep',
  displayName: 'Tail Sweep',
  trigger: { type: 'onUse', cooldown: 2 },
  effects: [{ type: 'damage', multiplier: 0.6, scaling: 'atk' }],
  target: 'all_enemies',
  description: 'A sweeping tail strike hitting all enemies.',
}

export const THICK_HIDE: Ability = {
  id: 'thick_hide',
  name: 'Thick Hide',
  displayName: 'Thick Hide',
  trigger: { type: 'always' },
  effects: [{ type: 'damage_reduction', percent: 15 }],
  target: 'self',
  description: 'Reduces all incoming damage by 15%.',
}

export const NONE_PASSIVE: Ability = {
  id: 'none',
  name: 'None',
  displayName: 'None',
  trigger: { type: 'always' },
  effects: [],
  target: 'self',
  description: 'No passive ability.',
}

// ─── Test Fixtures ─────────────────────────────────────────────────

export function makeMember(
  overrides: Partial<BattleTeamMember> = {},
): BattleTeamMember {
  return {
    creatureId: 'test-creature',
    name: 'TestDino',
    role: 'striker',
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

export function makeTeam(
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

export function makeCreature(
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
