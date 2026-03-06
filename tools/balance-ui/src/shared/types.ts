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
  abilityPresenceAll: Record<string, number>
  abilityWinRateAll: Record<string, number>
  uniqueGenomes: number
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
  roleHpCurves?: Record<
    string,
    { wins: Array<number>; losses: Array<number> }
  >
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

/** Override for a single ability template's parameters */
export interface AbilityOverride {
  /** Cooldown override (only meaningful for active abilities with onUse trigger) */
  cooldown?: number
  /** Per-effect parameter overrides, keyed by effect index → { paramName: value } */
  effectOverrides?: Record<number, Record<string, number>>
}

export interface ConstantsOverride {
  /** Per-role stat multipliers, e.g. { striker: { atk: 0.1 } } = +10% ATK for all strikers */
  roleModifiers?: Record<string, StatModifiers>
  /** Per-rarity uniform scaling, e.g. { common: -0.05 } = -5% all stats for commons */
  rarityModifiers?: Record<string, number>
  combatDamageScale?: number
  /** DEF formula constant: damage *= K / (K + DEF). Lower = DEF stronger. Default 100. */
  defScalingConstant?: number
  /** Per-ability template overrides, e.g. { shield_wall: { effectOverrides: { 0: { percent: 20 } } } } */
  abilityOverrides?: Record<string, AbilityOverride>
  /** Basic attack multiplier override (default 0.9). Controls damage = ATK * multiplier. */
  basicAttackMultiplier?: number
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
    syntheticMode: boolean
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
  defScalingConstant: number
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
  syntheticMode: boolean
  /** Lightweight config for rendering baseline diff summaries */
  config: {
    options: SimRequest['options']
    constants: ConstantsOverride
    creaturePatches: Array<CreatureOverridePatch>
  }
}

export interface RunHistoryDB extends DBSchema {
  runs: {
    key: string
    value: SavedRun
    indexes: { 'by-created': number }
  }
}
