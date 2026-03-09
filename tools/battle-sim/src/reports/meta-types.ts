import { ALL_ABILITY_TEMPLATES } from '@paleo-waifu/shared/battle/constants'
import type { AbilityTemplate, Row } from '@paleo-waifu/shared/battle/types'
import type { CreatureRecord } from '../db.ts'

// ─── Ability Name Lookup ──────────────────────────────────────────

export const ABILITY_NAME_MAP = new Map<string, string>()
export const ABILITY_TYPE_MAP = new Map<string, string>()
for (const t of ALL_ABILITY_TEMPLATES) {
  ABILITY_NAME_MAP.set(t.id, t.name)
  ABILITY_TYPE_MAP.set(t.id, t.trigger.type === 'onUse' ? 'active' : 'passive')
}
ABILITY_NAME_MAP.set('basic_attack', 'Basic Attack')
ABILITY_TYPE_MAP.set('basic_attack', 'active')

// ─── Types ────────────────────────────────────────────────────────

export interface CreatureSlot {
  id: string
  row: Row
}

export type TeamGenome = [CreatureSlot, CreatureSlot, CreatureSlot]

export interface Individual {
  genome: TeamGenome
  members: [CreatureRecord, CreatureRecord, CreatureRecord]
  fitness: number
  wins: number
  losses: number
  draws: number
  generationBorn: number
}

export interface GenerationSnapshot {
  generation: number
  topFitness: number
  avgFitness: number
  avgTurns: number
  turnP10: number
  turnP90: number
  topTeamNames: [string, string, string]
  topTeamRows: [Row, Row, Row]
  roleDistribution: Record<string, number>
  rarityDistribution: Record<string, number>
  abilityPresence: Record<string, number>
  abilityFitnessSum: Record<string, number>
  creatureFrequency: Record<string, number>
  creatureFitnessSum: Record<string, number>
  synergyPresence: Record<string, number>
  formationDistribution: Record<string, number>
  compDistribution: Record<string, number>
  compWinRates: Record<string, number>
  creaturePresenceAll: Record<string, number>
  creatureWinRateAll: Record<string, number>
  creatureAbsWinRate: Record<string, number>
  abilityPresenceAll: Record<string, number>
  abilityWinRateAll: Record<string, number>
  uniqueGenomes: number
}

export interface MetaOptions {
  population: number
  generations: number
  matchesPerTeam: number
  eliteRate: number
  mutationRate: number
  csv: boolean
  onGeneration?: (gen: number, snapshot: GenerationSnapshot) => void
  /** Optional custom template map for ability overrides (falls back to global templates) */
  templateMap?: Map<string, AbilityTemplate>
  /** Override for COMBAT_DAMAGE_SCALE (balance-ui tuning) */
  damageScale?: number
  /** Override for DEF_SCALING_CONSTANT (balance-ui tuning) */
  defScaling?: number
  /** Override for BASIC_ATTACK multiplier (default 0.9) */
  basicAttackMultiplier?: number
}

export interface MetaResult {
  hallOfFame: Array<Individual>
  creatureLeaderboard: Array<{
    creature: CreatureRecord
    appearances: number
    avgFitness: number
    allTeamWinRate: number
    winRate: number
  }>
  abilityLeaderboard: Array<{
    templateId: string
    name: string
    abilityType: string
    appearances: number
    avgFitness: number
    allTeamWinRate: number
  }>
  creatureWinRates?: Record<string, number>
  abilityWinRates?: Record<string, number>
  roleMetaShare: Record<string, number>
  synergyMetaShare: Record<string, number>
  formationMetaShare: Record<string, number>
  roleHpCurves?: Record<string, { wins: Array<number>; losses: Array<number> }>
  roleContributions?: Record<
    string,
    {
      avgDamageDealt: number
      avgDamageTaken: number
      avgHealingDone: number
      avgShieldsApplied: number
      avgDebuffsLanded: number
    }
  >
  roleWinRates?: Record<string, number>
  compMetaShare?: Record<string, number>
  compWinRates?: Record<string, number>
  abilityUsage?: Array<{
    abilityId: string
    name: string
    uses: number
    totalDamage: number
    avgDamagePerUse: number
  }>
}

export interface MetaRunResult {
  result: MetaResult
  snapshots: Array<GenerationSnapshot>
}
