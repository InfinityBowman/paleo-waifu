import type { Ability, AbilityTemplate, Role } from './types'

// ─── Combat Tuning ─────────────────────────────────────────────────
// Global damage multiplier — scales ALL damage output to control battle length.
export const COMBAT_DAMAGE_SCALE = 0.48
// DEF formula constant: damage *= DEF_SCALING / (DEF_SCALING + def)
// Lower values make DEF stronger. At 75, DEF 60 = 55.6% through. At 100 (default), DEF 60 = 62.5%.
export const DEF_SCALING_CONSTANT = 75

// ─── Rarity Base Stat Totals ────────────────────────────────────────

export const RARITY_BASE_TOTALS: Record<string, number> = {
  common: 105,
  uncommon: 130,
  rare: 170,
  epic: 215,
  legendary: 280,
}

// ─── Role Stat Distributions ─────────────────────

export const ROLE_DISTRIBUTIONS: Record<
  Role,
  { hp: number; atk: number; def: number; spd: number }
> = {
  striker: { hp: 0.28, atk: 0.35, def: 0.15, spd: 0.22 },
  tank: { hp: 0.38, atk: 0.12, def: 0.35, spd: 0.15 },
  support: { hp: 0.38, atk: 0.1, def: 0.27, spd: 0.25 },
  bruiser: { hp: 0.3, atk: 0.25, def: 0.25, spd: 0.2 },
}

// ─── Active Ability Templates (15) ──────────────────────────────────

export const ACTIVE_ABILITY_TEMPLATES: Array<AbilityTemplate> = [
  // ── Damage ──
  {
    id: 'bite',
    name: 'Bite',
    trigger: { type: 'onUse', cooldown: 1 },
    effects: [{ type: 'damage', multiplier: 0.8, scaling: 'atk' }],
    target: 'single_enemy',
    description: 'A powerful bite attack.',
    roleAffinity: ['striker', 'bruiser'],
  },
  {
    id: 'crushing_jaw',
    name: 'Crushing Jaw',
    trigger: { type: 'onUse', cooldown: 3 },
    effects: [{ type: 'damage', multiplier: 1.2, scaling: 'atk' }],
    target: 'single_enemy',
    description: 'The strongest single-target bite, crushing bones.',
    roleAffinity: ['striker'],
  },
  {
    id: 'venom_strike',
    name: 'Venom Strike',
    trigger: { type: 'onUse', cooldown: 2 },
    effects: [
      { type: 'damage', multiplier: 0.7, scaling: 'atk' },
      { type: 'dot', dotKind: 'poison', percent: 5, duration: 3 },
    ],
    target: 'single_enemy',
    description:
      'A venomous attack that poisons the target for 5% max HP/turn.',
    roleAffinity: ['striker'],
  },
  {
    id: 'feeding_frenzy',
    name: 'Feeding Frenzy',
    trigger: { type: 'onUse', cooldown: 3 },
    effects: [
      { type: 'damage', multiplier: 1.0, scaling: 'atk' },
      { type: 'lifesteal', percent: 25 },
    ],
    target: 'single_enemy',
    description: 'A frenzied attack that heals 25% of damage dealt.',
    roleAffinity: ['bruiser'],
  },
  {
    id: 'headbutt',
    name: 'Headbutt',
    trigger: { type: 'onUse', cooldown: 3 },
    effects: [
      { type: 'damage', multiplier: 0.8, scaling: 'atk' },
      { type: 'stun', duration: 1 },
    ],
    target: 'single_enemy',
    description: 'A forceful headbutt that stuns the target for 1 turn.',
    roleAffinity: ['bruiser'],
  },
  {
    id: 'tail_sweep',
    name: 'Tail Sweep',
    trigger: { type: 'onUse', cooldown: 2 },
    effects: [{ type: 'damage', multiplier: 0.6, scaling: 'atk' }],
    target: 'all_enemies',
    description: 'A sweeping tail strike hitting all enemies.',
    roleAffinity: ['bruiser', 'tank'],
  },
  {
    id: 'bleed',
    name: 'Bleed',
    trigger: { type: 'onUse', cooldown: 2 },
    effects: [
      { type: 'damage', multiplier: 0.5, scaling: 'atk' },
      { type: 'dot', dotKind: 'bleed', percent: 5, duration: 3 },
    ],
    target: 'single_enemy',
    description: 'A slashing wound that bleeds for 5% max HP per turn.',
    roleAffinity: ['bruiser'],
  },
  // ── Buff ──
  {
    id: 'rally_cry',
    name: 'Rally Cry',
    trigger: { type: 'onUse', cooldown: 2 },
    effects: [
      { type: 'buff', stat: 'atk', percent: 20, duration: 3 },
      { type: 'buff', stat: 'spd', percent: 15, duration: 3 },
      { type: 'heal', percent: 10 },
    ],
    target: 'all_allies',
    description:
      "A rallying roar that boosts all allies' ATK by 20% and SPD by 15% for 3 turns, and heals 10% max HP.",
    roleAffinity: ['support'],
  },
  {
    id: 'herd_formation',
    name: 'Herd Formation',
    trigger: { type: 'onUse', cooldown: 2 },
    effects: [
      { type: 'buff', stat: 'def', percent: 25, duration: 3 },
      { type: 'buff', stat: 'atk', percent: 10, duration: 3 },
    ],
    target: 'all_allies',
    description:
      "Tightens formation, boosting all allies' defense by 25% and attack by 10%.",
    roleAffinity: ['support', 'tank'],
  },
  // ── Debuff ──
  {
    id: 'intimidate',
    name: 'Intimidate',
    trigger: { type: 'onUse', cooldown: 2 },
    effects: [{ type: 'debuff', stat: 'atk', percent: 25, duration: 3 }],
    target: 'single_enemy',
    description:
      "An intimidating display that reduces an enemy's attack by 25%.",
    roleAffinity: ['support'],
  },
  {
    id: 'armor_break',
    name: 'Armor Break',
    trigger: { type: 'onUse', cooldown: 2 },
    effects: [{ type: 'debuff', stat: 'def', percent: 25, duration: 4 }],
    target: 'single_enemy',
    description: "Shatters an enemy's armor, reducing defense by 25% for 4 turns.",
    roleAffinity: ['support', 'bruiser'],
  },
  // ── Heal ──
  {
    id: 'symbiosis',
    name: 'Symbiosis',
    trigger: { type: 'onUse', cooldown: 2 },
    effects: [{ type: 'heal', percent: 25 }],
    target: 'all_allies',
    description: 'A symbiotic bond heals all allies for 25% of max HP.',
    roleAffinity: ['support'],
  },
  {
    id: 'mend',
    name: 'Mend',
    trigger: { type: 'onUse', cooldown: 1 },
    effects: [{ type: 'heal', percent: 35 }],
    target: 'lowest_hp_ally',
    description: 'Mends the wounds of the lowest-HP ally, healing 35% max HP.',
    roleAffinity: ['support'],
  },
  // ── Utility ──
  {
    id: 'shield_wall',
    name: 'Shield Wall',
    trigger: { type: 'onUse', cooldown: 2 },
    effects: [{ type: 'shield', percent: 55, duration: 2 }],
    target: 'lowest_hp_ally',
    description: "Grants a shield absorbing 55% of caster's max HP.",
    roleAffinity: ['tank'],
  },
  {
    id: 'taunt',
    name: 'Taunt',
    trigger: { type: 'onUse', cooldown: 1 },
    effects: [
      { type: 'taunt', duration: 2 },
      { type: 'buff', stat: 'def', percent: 40, duration: 2 },
      { type: 'shield', percent: 30, duration: 2 },
    ],
    target: 'self',
    description: 'Draws all single-target attacks to self for 2 turns, boosts DEF by 40%, and grants a shield absorbing 30% max HP.',
    roleAffinity: ['tank'],
  },
]

// ─── Passive Ability Templates (10) ─────────────────────────────────

export const PASSIVE_ABILITY_TEMPLATES: Array<AbilityTemplate> = [
  // ── Defensive (always) ──
  {
    id: 'thick_hide',
    name: 'Thick Hide',
    trigger: { type: 'always' },
    effects: [{ type: 'damage_reduction', percent: 15 }],
    target: 'self',
    description: 'Reduces all incoming damage by 15%.',
    roleAffinity: ['tank'],
  },
  {
    id: 'armored_plates',
    name: 'Spiked Plates',
    trigger: { type: 'onBattleStart' },
    effects: [{ type: 'reflect', percent: 30, duration: 999 }],
    target: 'self',
    description: 'Reflects 30% of incoming damage back to attackers.',
    roleAffinity: ['tank'],
  },
  {
    id: 'ironclad',
    name: 'Ironclad',
    trigger: { type: 'always' },
    effects: [
      { type: 'flat_reduction', scalingStat: 'def', scalingPercent: 10 },
    ],
    target: 'self',
    description:
      'Reduces all incoming damage by a flat amount equal to 10% of DEF.',
    roleAffinity: ['tank', 'bruiser'],
  },
  {
    id: 'evasive',
    name: 'Evasive',
    trigger: { type: 'always' },
    effects: [{ type: 'dodge', basePercent: 10 }],
    target: 'self',
    description:
      'Chance to dodge attacks. Base 10%, scales with SPD advantage.',
    roleAffinity: ['striker'],
  },
  // ── Offensive ──
  {
    id: 'predator_instinct',
    name: 'Predator Instinct',
    trigger: { type: 'onBeforeAttack' },
    effects: [{ type: 'buff', stat: 'atk', percent: 20, duration: 2 }],
    target: 'self',
    condition: { type: 'target_hp_below', percent: 50 },
    description: '+20% ATK when attacking a target below 50% HP.',
    roleAffinity: ['striker'],
  },
  {
    id: 'venomous',
    name: 'Venomous',
    trigger: { type: 'onBasicAttack' },
    effects: [{ type: 'dot', dotKind: 'poison', percent: 3, duration: 2 }],
    target: 'attack_target',
    description: 'Basic attacks apply poison dealing 3% HP/turn for 2 turns.',
    roleAffinity: ['striker'],
  },
  {
    id: 'territorial',
    name: 'Territorial',
    trigger: {
      type: 'onBattleStart',
      condition: { type: 'in_row', row: 'front' },
    },
    effects: [
      { type: 'buff', stat: 'atk', percent: 10, duration: 999 },
      { type: 'buff', stat: 'def', percent: 10, duration: 999 },
    ],
    target: 'self',
    description: '+10% ATK and DEF when in the front row.',
    roleAffinity: ['bruiser'],
  },
  {
    id: 'pack_hunter',
    name: 'Pack Hunter',
    trigger: { type: 'always' },
    effects: [{ type: 'buff', stat: 'atk', percent: 10, duration: 999 }],
    target: 'self',
    condition: { type: 'per_ally_alive' },
    description: '+10% ATK per ally still alive.',
    roleAffinity: ['striker', 'bruiser'],
  },
  // ── Sustain ──
  {
    id: 'regenerative',
    name: 'Regenerative',
    trigger: { type: 'onTurnEnd' },
    effects: [{ type: 'heal', percent: 5 }],
    target: 'self',
    description: 'Heals 5% max HP at the end of each turn.',
    roleAffinity: ['tank', 'support'],
  },
  {
    id: 'scavenger',
    name: 'Scavenger',
    trigger: { type: 'onEnemyKO' },
    effects: [{ type: 'heal', percent: 15 }],
    target: 'self',
    description: "Heals 15% max HP when an enemy is KO'd.",
    roleAffinity: ['bruiser'],
  },
  {
    id: 'soothing_aura',
    name: 'Soothing Aura',
    trigger: { type: 'onTurnEnd' },
    effects: [{ type: 'heal', percent: 10 }],
    target: 'all_allies',
    description: 'Heals all allies for 10% max HP at the end of each turn.',
    roleAffinity: ['support'],
  },
  {
    id: 'fortifying_presence',
    name: 'Fortifying Presence',
    trigger: { type: 'onBattleStart' },
    effects: [
      { type: 'buff', stat: 'def', percent: 25, duration: 999 },
      { type: 'shield', percent: 15, duration: 3 },
    ],
    target: 'all_allies',
    description:
      'All allies gain +25% DEF and a shield absorbing 15% max HP for 3 turns at the start of battle.',
    roleAffinity: ['support'],
  },
  {
    id: 'weakening_strikes',
    name: 'Weakening Strikes',
    trigger: { type: 'onTurnStart' },
    effects: [{ type: 'debuff', stat: 'atk', percent: 35, duration: 2 }],
    target: 'random_enemy',
    description: 'At the start of each turn, weakens a random enemy\'s ATK by 35% for 2 turns.',
    roleAffinity: ['support'],
  },
  // ── No passive ──
  {
    id: 'none',
    name: 'None',
    trigger: { type: 'always' },
    effects: [],
    target: 'self',
    description: 'No passive ability.',
    roleAffinity: ['striker', 'tank', 'support', 'bruiser'],
  },
]

export const ALL_ABILITY_TEMPLATES: Array<AbilityTemplate> = [
  ...ACTIVE_ABILITY_TEMPLATES,
  ...PASSIVE_ABILITY_TEMPLATES,
]

// ─── Basic Attack ───────────────────────────────────────────────────

export const BASIC_ATTACK: Ability = {
  id: 'basic_attack',
  name: 'Basic Attack',
  displayName: 'Basic Attack',
  trigger: { type: 'onUse', cooldown: 0 },
  effects: [{ type: 'damage', multiplier: 0.9, scaling: 'atk' }],
  target: 'single_enemy',
  description: 'A basic attack.',
}

// ─── Helper ─────────────────────────────────────────────────────────

export function templateToAbility(
  template: AbilityTemplate,
  displayName?: string,
): Ability {
  return {
    id: template.id,
    name: template.name,
    displayName: displayName ?? template.name,
    trigger: template.trigger,
    effects: template.effects,
    target: template.target,
    condition: template.condition,
    description: template.description,
  }
}
