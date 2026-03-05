import type { AbilityTemplate, Row } from '@paleo-waifu/shared/battle/types'

// ─── Creature Record (mirrors battle-sim/src/db.ts) ──────────────

export interface CreatureRecord {
  id: string
  name: string
  era: string
  diet: string
  rarity: string
  type: string
  role: string
  hp: number
  atk: number
  def: number
  spd: number
  active: { templateId: string; displayName: string }
  passive: { templateId: string; displayName: string }
}

// ─── Meta Report Result Types (mirrors battle-sim/src/reports/meta.ts) ──

interface CreatureSlot {
  id: string
  row: Row
}

type TeamGenome = [CreatureSlot, CreatureSlot, CreatureSlot]

interface Individual {
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
  topTeamNames: [string, string, string]
  topTeamRows: [Row, Row, Row]
  roleDistribution: Record<string, number>
  rarityDistribution: Record<string, number>
  abilityPresence: Record<string, number>
  creatureFrequency: Record<string, number>
  synergyPresence: Record<string, number>
  formationDistribution: Record<string, number>
  uniqueGenomes: number
}

export interface MetaResult {
  hallOfFame: Array<Individual>
  creatureLeaderboard: Array<{
    creature: CreatureRecord
    appearances: number
    avgFitness: number
  }>
  abilityLeaderboard: Array<{
    templateId: string
    name: string
    abilityType: string
    appearances: number
    avgFitness: number
  }>
  roleMetaShare: Record<string, number>
  synergyMetaShare: Record<string, number>
  formationMetaShare: Record<string, number>
}

export interface MetaRunResult {
  result: MetaResult
  snapshots: Array<GenerationSnapshot>
}

// ─── Override / Patch Types ──────────────────────────────────────

export interface CreatureOverridePatch {
  id: string
  disabled?: boolean
  hp?: number
  atk?: number
  def?: number
  spd?: number
  activeTemplateId?: string
  passiveTemplateId?: string
}

export interface ConstantsOverride {
  rarityBaseTotals?: Record<string, number>
  roleDistributions?: Record<
    string,
    { hp: number; atk: number; def: number; spd: number }
  >
  combatDamageScale?: number
}

export interface SimRequest {
  creaturePatches: Array<CreatureOverridePatch>
  constants: ConstantsOverride
  options: {
    population: number
    generations: number
    matchesPerTeam: number
    eliteRate: number
    mutationRate: number
    normalizeStats: boolean
    noActives: boolean
    noPassives: boolean
  }
}

export type SimProgressEvent =
  | {
      type: 'generation'
      generation: number
      total: number
      topFitness: number
      avgFitness: number
    }
  | { type: 'done'; result: MetaRunResult }
  | { type: 'error'; message: string }

export interface ConstantsSnapshot {
  rarityBaseTotals: Partial<Record<string, number>>
  roleDistributions: Partial<
    Record<string, { hp: number; atk: number; def: number; spd: number }>
  >
  combatDamageScale: number
  activeTemplates: Array<AbilityTemplate>
  passiveTemplates: Array<AbilityTemplate>
}

export interface CreaturesResponse {
  creatures: Array<CreatureRecord>
  constants: ConstantsSnapshot
}
