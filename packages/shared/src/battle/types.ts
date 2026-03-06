// ─── Primitives ────────────────────────────────────────────────────

export type Role = 'striker' | 'tank' | 'support' | 'bruiser'

export type Stat = 'atk' | 'def' | 'spd'

export type Row = 'front' | 'back'

export type TeamSide = 'A' | 'B'

export type DotKind = 'poison' | 'bleed'

// ─── Effects ───────────────────────────────────────────────────────
//
// Each Effect does exactly ONE thing. Abilities are arrays of Effects.
// The engine calls resolveEffect() for each element in order.

export type Effect =
  | { type: 'damage'; multiplier: number; scaling: 'atk' | 'def' }
  | { type: 'heal'; percent: number }
  | { type: 'dot'; dotKind: DotKind; percent: number; duration: number }
  | { type: 'buff'; stat: Stat; percent: number; duration: number }
  | { type: 'debuff'; stat: Stat; percent: number; duration: number }
  | { type: 'shield'; percent: number; duration: number }
  | { type: 'stun'; duration: number }
  | { type: 'taunt'; duration: number }
  | { type: 'lifesteal'; percent: number }
  | { type: 'reflect'; percent: number; duration: number }
  | { type: 'damage_reduction'; percent: number }
  | { type: 'crit_reduction'; percent: number }
  | {
      type: 'flat_reduction'
      scalingStat: 'def'
      scalingPercent: number
    }
  | { type: 'dodge'; basePercent: number }

// ─── Triggers ──────────────────────────────────────────────────────
//
// Trigger defines WHEN effects fire.
// onUse → active ability (creature chooses it on their turn)
// All other triggers → passive (engine fires automatically)

export type Trigger =
  | { type: 'onUse'; cooldown: number }
  | { type: 'onBeforeAttack' }
  | { type: 'onBasicAttack' }
  | { type: 'onHit' }
  | { type: 'onKill' }
  | { type: 'onEnemyKO' }
  | { type: 'onAllyKO' }
  | { type: 'onTurnStart' }
  | { type: 'onTurnEnd' }
  | { type: 'onBattleStart'; condition?: Condition }
  | { type: 'always' }

// ─── Targets ───────────────────────────────────────────────────────

export type Target =
  | 'self'
  | 'single_enemy'
  | 'all_enemies'
  | 'lowest_hp_ally'
  | 'all_allies'
  | 'random_enemy'
  | 'attack_target'
  | 'attacker'

// ─── Conditions ────────────────────────────────────────────────────

export type Condition =
  | { type: 'in_row'; row: Row }
  | { type: 'target_hp_below'; percent: number }
  | { type: 'per_ally_alive' }
  | { type: 'per_dead_ally' }

// ─── Ability ───────────────────────────────────────────────────────
//
// Unified type for both active and passive abilities.
// trigger.type === 'onUse' → active (AI selects it, has cooldown)
// Any other trigger.type   → passive (engine fires automatically)

export interface Ability {
  id: string
  name: string
  displayName: string
  trigger: Trigger
  effects: Array<Effect>
  target: Target
  condition?: Condition
  description: string
}

// ─── Ability Template ──────────────────────────────────────────────
//
// Source-of-truth library definition. displayName is set per-creature
// during ability assignment — not stored here.

export interface AbilityTemplate {
  id: string
  name: string
  trigger: Trigger
  effects: Array<Effect>
  target: Target
  condition?: Condition
  description: string
  roleAffinity: Array<Role>
}

// ─── Status Effects (runtime) ──────────────────────────────────────

export type StatusEffectKind =
  | 'poison'
  | 'bleed'
  | 'buff'
  | 'debuff'
  | 'stun'
  | 'shield'
  | 'hot'
  | 'taunt'
  | 'reflect'

export interface StatusEffect {
  kind: StatusEffectKind
  sourceCreatureId: string
  value: number
  turnsRemaining: number
  stat?: Stat
}

// ─── BattleCreature (runtime) ──────────────────────────────────────

export interface BattleCreature {
  id: string
  creatureId: string
  name: string
  teamSide: TeamSide
  row: Row

  // Stats (4 — no ABL)
  baseStats: { hp: number; atk: number; def: number; spd: number }
  maxHp: number
  currentHp: number
  atk: number
  def: number
  spd: number

  // Metadata
  role: Role
  diet: string
  type: string
  era: string
  rarity: string

  // Abilities
  active: Ability
  passive: Ability

  // Combat state
  cooldown: number
  statusEffects: Array<StatusEffect>
  isAlive: boolean
  isStunned: boolean

  // Materialized passive constants (set at battle start from 'always' effects)
  damageReductionPercent: number
  critReductionPercent: number
  flatReductionDefPercent: number
  dodgeBasePercent: number
}

// ─── BattleTeamMember (input) ──────────────────────────────────────

export interface BattleTeamMember {
  creatureId: string
  name: string
  role: Role
  stats: { hp: number; atk: number; def: number; spd: number }
  active: Ability
  passive: Ability
  diet: string
  type: string
  era: string
  rarity: string
  row: Row
}

export type BattleTeam = {
  members: [BattleTeamMember, BattleTeamMember, BattleTeamMember]
}

// ─── SeededRng ─────────────────────────────────────────────────────

export interface SeededRng {
  next: () => number
  nextInt: (min: number, max: number) => number
  nextFloat: (min: number, max: number) => number
}

// ─── Battle Log Events ─────────────────────────────────────────────

export type BattleLogEvent =
  | {
      type: 'battle_start'
      teamA: Array<string>
      teamB: Array<string>
      seed: number
    }
  | {
      type: 'synergy_applied'
      teamSide: TeamSide
      synergy: SynergyBonus
    }
  | { type: 'turn_start'; turn: number }
  | {
      type: 'creature_action'
      turn: number
      creatureId: string
      creatureName: string
      abilityId: string
      abilityName: string
      targetIds: Array<string>
    }
  | {
      type: 'damage'
      turn: number
      sourceId: string
      targetId: string
      amount: number
      isCrit: boolean
      isDodged: boolean
    }
  | {
      type: 'heal'
      turn: number
      sourceId: string
      targetId: string
      amount: number
      newHp: number
    }
  | {
      type: 'status_applied'
      turn: number
      targetId: string
      effect: StatusEffect
    }
  | {
      type: 'status_expired'
      turn: number
      targetId: string
      kind: StatusEffectKind
      stat?: Stat
    }
  | {
      type: 'status_tick'
      turn: number
      targetId: string
      kind: StatusEffectKind
      damage: number
      newHp: number
    }
  | {
      type: 'shield_absorbed'
      turn: number
      targetId: string
      absorbed: number
      remaining: number
    }
  | { type: 'stun_skip'; turn: number; creatureId: string }
  | {
      type: 'ko'
      turn: number
      creatureId: string
      creatureName: string
    }
  | {
      type: 'passive_trigger'
      turn: number
      creatureId: string
      passiveId: string
      triggerKind: Trigger['type']
      description: string
    }
  | {
      type: 'reflect_damage'
      turn: number
      sourceId: string
      targetId: string
      amount: number
    }
  | { type: 'turn_end'; turn: number }
  | {
      type: 'battle_end'
      winner: TeamSide | null
      reason: 'ko' | 'timeout'
      turns: number
    }

export interface SynergyBonus {
  kind: 'type' | 'era' | 'diet'
  description: string
  affectedCreatureIds: Array<string>
  statBonuses: Partial<Record<'hp' | 'atk' | 'def' | 'spd', number>>
}

export interface BattleResult {
  winner: TeamSide | null
  reason: 'ko' | 'timeout'
  turns: number
  teamAHpPercent: number
  teamBHpPercent: number
  log: Array<BattleLogEvent>
  finalState: { teamA: Array<BattleCreature>; teamB: Array<BattleCreature> }
  seed: number
}

// ─── Internal Resolution Types ─────────────────────────────────────

export interface DamageCalcResult {
  damage: number
  isCrit: boolean
  isDodged: boolean
}

export type EffectResolution =
  | {
      kind: 'damage'
      targetId: string
      amount: number
      isCrit: boolean
      isDodged: boolean
    }
  | { kind: 'heal'; targetId: string; amount: number; newHp: number }
  | {
      kind: 'status_applied'
      targetId: string
      effect: StatusEffect
    }
  | { kind: 'shield_set'; targetId: string; amount: number }
  | {
      kind: 'reflect_damage'
      targetId: string
      sourceId: string
      amount: number
    }
  | { kind: 'dodged'; targetId: string }

export interface EffectContext {
  caster: BattleCreature
  targets: Array<BattleCreature>
  allAllies: Array<BattleCreature>
  allEnemies: Array<BattleCreature>
  rng: SeededRng
  turn: number
  triggerAttacker?: BattleCreature
  triggerAttackTarget?: BattleCreature
  lastDamageDealt?: number
  /** Override for COMBAT_DAMAGE_SCALE (balance-ui tuning) */
  damageScale?: number
  /** Override for DEF_SCALING_CONSTANT (balance-ui tuning) */
  defScaling?: number
}

export interface SelectedAction {
  ability: Ability
  targets: Array<BattleCreature>
}
