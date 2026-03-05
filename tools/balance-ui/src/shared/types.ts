import type { DBSchema } from 'idb'
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

export type StatKey = 'hp' | 'atk' | 'def' | 'spd'

/** Per-stat percentage modifier (0 = no change, 0.1 = +10%, -0.15 = -15%) */
export type StatModifiers = Partial<Record<StatKey, number>>

export interface ConstantsOverride {
  /** Per-role stat multipliers, e.g. { striker: { atk: 0.1 } } = +10% ATK for all strikers */
  roleModifiers?: Record<string, StatModifiers>
  /** Per-rarity uniform scaling, e.g. { common: -0.05 } = -5% all stats for commons */
  rarityModifiers?: Record<string, number>
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

// ─── Run History (IndexedDB) ────────────────────────────────

export interface SavedRun {
  id: string
  label: string
  starred: boolean
  createdAt: number
  config: {
    options: SimRequest['options']
    constants: ConstantsOverride
    creaturePatches: Array<CreatureOverridePatch>
  }
  result: MetaRunResult
}

export interface RunSummary {
  id: string
  label: string
  starred: boolean
  createdAt: number
  population: number
  generations: number
  topFitness: number
  avgTurns: number
  roleMetaShare: Record<string, number>
  patchCount: number
  normalizeStats: boolean
  noActives: boolean
  noPassives: boolean
}

export interface RunHistoryDB extends DBSchema {
  runs: {
    key: string
    value: SavedRun
    indexes: { 'by-created': number }
  }
}
