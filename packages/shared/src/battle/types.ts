export type Role =
  | 'striker'
  | 'tank'
  | 'scout'
  | 'support'
  | 'bruiser'
  | 'specialist'

export type AbilitySlot = 'active1' | 'active2' | 'passive'

export type AbilityType = 'active' | 'passive'

export type AbilityCategory =
  | 'damage'
  | 'aoe_damage'
  | 'buff'
  | 'debuff'
  | 'heal'
  | 'shield'
  | 'stun'
  | 'dot'
  | 'taunt'
  | 'passive'

export type AbilityTarget =
  | 'single_enemy'
  | 'all_enemies'
  | 'self'
  | 'all_allies'
  | 'random_enemy'

export interface AbilityTemplateData {
  id: string
  name: string
  type: AbilityType
  category: AbilityCategory
  target: AbilityTarget | null
  multiplier: number | null
  cooldown: number | null
  duration: number | null
  statAffected: string | null
  effectValue: number | null
  description: string
}

export interface CreatureBattleData {
  creatureId: string
  role: Role
  hp: number
  atk: number
  def: number
  spd: number
  abl: number
}

export interface CreatureAbilityAssignment {
  creatureId: string
  active1: { templateId: string; displayName: string }
  active2: { templateId: string; displayName: string }
  passive: { templateId: string; displayName: string }
}

// ─── Runtime Battle Types ──────────────────────────────────────────

export type Row = 'front' | 'back'
export type TeamSide = 'A' | 'B'

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
  stat?: string
  value: number
  turnsRemaining: number
}

export interface ResolvedAbility {
  templateId: string
  displayName: string
  slot: AbilitySlot
  type: AbilityType
  category: AbilityCategory
  target: AbilityTarget | null
  multiplier: number | null
  cooldown: number | null
  duration: number | null
  statAffected: string | null
  effectValue: number | null
}

export interface BattleCreature {
  id: string
  creatureId: string
  name: string
  teamSide: TeamSide
  row: Row
  baseStats: { hp: number; atk: number; def: number; spd: number; abl: number }
  maxHp: number
  currentHp: number
  atk: number
  def: number
  spd: number
  abl: number
  role: Role
  diet: string
  type: string
  era: string
  rarity: string
  active1: ResolvedAbility
  active2: ResolvedAbility
  passive: ResolvedAbility
  cooldowns: Record<string, number>
  statusEffects: StatusEffect[]
  isAlive: boolean
  isStunned: boolean
  reflectDamagePercent: number
}

export interface BattleTeamMember {
  creatureId: string
  name: string
  stats: { hp: number; atk: number; def: number; spd: number; abl: number }
  abilities: CreatureAbilityAssignment
  diet: string
  type: string
  era: string
  rarity: string
  row: Row
}

export type BattleTeam = {
  members: [BattleTeamMember, BattleTeamMember, BattleTeamMember]
}

// ─── Battle Log Events ─────────────────────────────────────────────

export type BattleLogEvent =
  | { type: 'battle_start'; teamA: string[]; teamB: string[]; seed: number }
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
      targetIds: string[]
    }
  | {
      type: 'damage'
      turn: number
      sourceId: string
      targetId: string
      amount: number
      isCrit: boolean
      isDodged: boolean
      isDietBonus: boolean
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
      stat?: string
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
  | { type: 'ko'; turn: number; creatureId: string; creatureName: string }
  | {
      type: 'passive_trigger'
      turn: number
      creatureId: string
      passiveId: string
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
  affectedCreatureIds: string[]
  statBonuses: Partial<
    Record<'hp' | 'atk' | 'def' | 'spd' | 'abl', number>
  >
}

export interface BattleResult {
  winner: TeamSide | null
  reason: 'ko' | 'timeout'
  turns: number
  teamAHpPercent: number
  teamBHpPercent: number
  log: BattleLogEvent[]
  finalState: { teamA: BattleCreature[]; teamB: BattleCreature[] }
  seed: number
}

export interface SeededRng {
  next(): number
  nextInt(min: number, max: number): number
  nextFloat(min: number, max: number): number
}

// ─── Internal Resolution Types ─────────────────────────────────────

export interface DamageCalcResult {
  damage: number
  isCrit: boolean
  isDodged: boolean
  isDietBonus: boolean
  rawDamage: number
}

export interface AbilityResolution {
  targetId: string
  damage?: number
  healing?: number
  statusApplied?: StatusEffect
  isCrit?: boolean
  isDodged?: boolean
  isDietBonus?: boolean
  shieldAmount?: number
  reflectDamage?: number
}

export interface StatusTickResult {
  kind: StatusEffectKind
  damage?: number
  healing?: number
  expired: boolean
  stat?: string
}

export interface SelectedAction {
  ability: ResolvedAbility
  targets: BattleCreature[]
}
