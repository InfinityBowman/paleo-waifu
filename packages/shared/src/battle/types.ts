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
