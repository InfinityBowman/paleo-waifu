import type { AbilityTemplate } from '@paleo-waifu/shared/battle/types'

// ─── Options ────────────────────────────────────────────────────

export interface FieldOptions {
  /** Trials per creature pair (split evenly across both sides for symmetry) */
  trialsPerPair: number
  /** Number of random 3v3 teams to sample for team round-robin */
  teamSampleSize: number
  /** Matches per team in team round-robin */
  teamMatchCount: number
  /** Optional custom template map for ability overrides */
  templateMap?: Map<string, AbilityTemplate>
  /** Override for COMBAT_DAMAGE_SCALE */
  damageScale?: number
  /** Override for DEF_SCALING_CONSTANT */
  defScaling?: number
  /** Override for BASIC_ATTACK multiplier */
  basicAttackMultiplier?: number
  /** Progress callback for streaming to UI */
  onProgress?: (
    phase: 'creature-roundrobin' | 'team-roundrobin',
    completed: number,
    total: number,
  ) => void
  /** CSV output (CLI only) */
  csv: boolean
}

// ─── Creature Round-Robin Results ────────────────────────────────

export interface CreatureFieldStats {
  id: string
  name: string
  role: string
  rarity: string
  winRate: number
  wins: number
  total: number
  bestMatchup: { opponentId: string; opponentName: string; winRate: number }
  worstMatchup: { opponentId: string; opponentName: string; winRate: number }
}

export interface RoleMatchup {
  attacker: string
  defender: string
  winRate: number
  sampleSize: number
}

export interface AbilityImpact {
  templateId: string
  name: string
  abilityType: 'active' | 'passive'
  avgWinRate: number
  creaturesWithAbility: number
}

// ─── Team Round-Robin Results ────────────────────────────────────

export interface CreatureTeamStats {
  id: string
  name: string
  role: string
  rarity: string
  /** Win rate when this creature is on a team */
  teamWinRate: number
  teamWins: number
  teamTotal: number
  /** 1v1 win rate for comparison (from creature round-robin) */
  soloWinRate: number
  /** teamWinRate - soloWinRate: positive = better in teams, negative = worse */
  teamDelta: number
  /** Best teammate (highest win rate when on the same team) */
  bestTeammate: { id: string; name: string; winRate: number }
  /** Worst teammate (lowest win rate when on the same team) */
  worstTeammate: { id: string; name: string; winRate: number }
}

/** Ability impact measured from 3v3 team battles */
export interface TeamAbilityImpact {
  templateId: string
  name: string
  abilityType: 'active' | 'passive'
  /** Win rate of teams containing creatures with this ability */
  teamWinRate: number
  /** Number of unique creatures that have this ability */
  creaturesWithAbility: number
  /** Total team appearances */
  sampleSize: number
}

/** Role matchup measured from 3v3 team battles */
export interface TeamRoleMatchup {
  role: string
  /** Win rate of teams containing this role */
  winRate: number
  /** Total team battles involving this role */
  sampleSize: number
}

export interface SynergyImpact {
  synergy: string
  avgWinRate: number
  avgWinRateWithout: number
  delta: number
  sampleSize: number
}

// ─── Balance Scorecard ───────────────────────────────────────────

export interface BalanceScorecard {
  giniCoefficient: number
  maxWinRate: number
  minWinRate: number
  winRateSpread: number
  roleWinRateVariance: number
  percentWithin45to55: number
  percentWithin40to60: number
}

// ─── Aggregate Result ────────────────────────────────────────────

export interface FieldResult {
  creatureStats: Array<CreatureFieldStats>
  roleMatchupMatrix: Array<RoleMatchup>
  abilityImpact: Array<AbilityImpact>
  synergyImpact: Array<SynergyImpact>
  creatureTeamStats: Array<CreatureTeamStats>
  compWinRates: Record<string, { winRate: number; count: number }>
  formationWinRates: Record<string, { winRate: number; count: number }>
  scorecard: BalanceScorecard
  /** Ability impact from 3v3 team battles */
  teamAbilityImpact: Array<TeamAbilityImpact>
  /** Role contribution from 3v3 team battles */
  teamRoleMatchup: Array<TeamRoleMatchup>
}

export interface FieldRunResult {
  result: FieldResult
}
