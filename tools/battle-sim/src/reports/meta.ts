import { simulateBattle } from '@paleo-waifu/shared/battle/engine'
import { assignRow, buildTeamWithRows, sampleTeam } from '../runner.ts'
import { createProgressBar } from '../report.ts'
import { ABILITY_NAME_MAP, ABILITY_TYPE_MAP } from './meta-types.ts'
import {
  canonicalGenome,
  ensureMixedRows,
  genomeKey,
  getRows,
  resolveMembers,
} from './meta-utils.ts'
import { detectSynergies } from './synergy.ts'
import { collectBattleTelemetry, finalizeTelemetry } from './telemetry.ts'
import { selectAndReproduce } from './genetics.ts'
import { renderCsv, renderTerminal } from './output.ts'
import {
  analyzeBattleActions,
  renderActionAnalysis,
} from './action-analysis.ts'
import type { TelemetryResult } from './telemetry.ts'
import type {
  CreatureSlot,
  GenerationSnapshot,
  Individual,
  MetaOptions,
  MetaResult,
  MetaRunResult,
} from './meta-types.ts'
import type { CreatureRecord } from '../db.ts'
import type { AbilityTemplate } from '@paleo-waifu/shared/battle/types'

// Re-export public types
export type {
  GenerationSnapshot,
  MetaOptions,
  MetaResult,
  MetaRunResult,
} from './meta-types.ts'

// ─── Population Initialization ────────────────────────────────────

function initializePopulation(
  creatures: Array<CreatureRecord>,
  size: number,
  creatureIndex: Map<string, CreatureRecord>,
): Array<Individual> {
  const population: Array<Individual> = []
  const seen = new Set<string>()

  for (
    let attempt = 0;
    attempt < size * 3 && population.length < size;
    attempt++
  ) {
    const members = sampleTeam(creatures)
    const slots: Array<CreatureSlot> = members.map((m) => ({
      id: m.id,
      row: assignRow(m.role),
    }))

    // 20% chance to try a non-default row to seed formation exploration
    if (Math.random() < 0.2) {
      const flipIdx = Math.floor(Math.random() * 3)
      slots[flipIdx].row = slots[flipIdx].row === 'front' ? 'back' : 'front'
    }

    ensureMixedRows(slots)
    const genome = canonicalGenome(slots)
    const key = genomeKey(genome)

    if (seen.has(key)) continue
    seen.add(key)

    population.push({
      genome,
      members: resolveMembers(genome, creatureIndex),
      fitness: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      generationBorn: 0,
    })
  }

  return population
}

// ─── Evaluation (Swiss Pairing + Both-Sides Play) ────────────────

function evaluateGeneration(
  population: Array<Individual>,
  matchesPerTeam: number,
  seedOffset: number,
  templateMap?: Map<string, AbilityTemplate>,
  damageScale?: number,
  defScaling?: number,
  collectTelemetry?: boolean,
  basicAttackMultiplier?: number,
): {
  avgTurns: number
  turnP10: number
  turnP90: number
  telemetry?: TelemetryResult
} {
  const n = population.length

  // Reset fitness for this generation
  for (const ind of population) {
    ind.fitness = 0
    ind.wins = 0
    ind.losses = 0
    ind.draws = 0
  }

  // Telemetry accumulators (only when collectTelemetry is true)
  const hpCurveAcc = collectTelemetry
    ? new Map<string, { turnSums: Array<number>; turnCounts: Array<number> }>()
    : null
  const contribAcc = collectTelemetry
    ? new Map<
        string,
        {
          damageDealt: number
          damageTaken: number
          healingDone: number
          shieldsApplied: number
          debuffsLanded: number
        }
      >()
    : null
  const roleWinAcc = collectTelemetry
    ? new Map<string, { wins: number; losses: number }>()
    : null
  const abilityAcc = collectTelemetry
    ? new Map<string, { name: string; uses: number; totalDamage: number }>()
    : null

  let battleIdx = 0
  let totalTurns = 0
  let battleCount = 0
  const allTurns: Array<number> = []

  for (let round = 0; round < matchesPerTeam; round++) {
    // Build pairing order
    const order = Array.from({ length: n }, (_, i) => i)

    if (round === 0) {
      // First round: Fisher-Yates shuffle for random pairing
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[order[i], order[j]] = [order[j], order[i]]
      }
    } else {
      // Swiss: sort by current win rate, randomize ties
      order.sort((a, b) => {
        const aInd = population[a]
        const bInd = population[b]
        const aTotal = aInd.wins + aInd.losses + aInd.draws
        const bTotal = bInd.wins + bInd.losses + bInd.draws
        const aRate = aTotal > 0 ? (aInd.wins + aInd.draws * 0.5) / aTotal : 0.5
        const bRate = bTotal > 0 ? (bInd.wins + bInd.draws * 0.5) / bTotal : 0.5
        if (Math.abs(aRate - bRate) < 0.001) return Math.random() - 0.5
        return bRate - aRate
      })
    }

    // Pair adjacent teams, play both sides
    const pairCount = Math.floor(order.length / 2)
    for (let p = 0; p < pairCount; p++) {
      const indA = population[order[p * 2]]
      const indB = population[order[p * 2 + 1]]

      const seed = seedOffset + battleIdx
      battleIdx += 2

      // Game 1: indA as team A, indB as team B
      try {
        const teamA = buildTeamWithRows(
          indA.members,
          getRows(indA.genome),
          templateMap,
        )
        const teamB = buildTeamWithRows(
          indB.members,
          getRows(indB.genome),
          templateMap,
        )
        const result = simulateBattle(teamA, teamB, {
          seed,
          damageScale,
          defScaling,
          basicAttackMultiplier,
        })
        totalTurns += result.turns
        allTurns.push(result.turns)
        battleCount++
        if (result.winner === 'A') {
          indA.wins++
          indB.losses++
        } else if (result.winner === 'B') {
          indA.losses++
          indB.wins++
        } else {
          indA.draws++
          indB.draws++
        }
        if (hpCurveAcc && contribAcc && roleWinAcc && abilityAcc) {
          collectBattleTelemetry(
            result,
            hpCurveAcc,
            contribAcc,
            roleWinAcc,
            abilityAcc,
          )
        }
      } catch {
        // Skip failed battles
      }

      // Game 2: swap sides (indB as team A, indA as team B)
      try {
        const teamA = buildTeamWithRows(
          indB.members,
          getRows(indB.genome),
          templateMap,
        )
        const teamB = buildTeamWithRows(
          indA.members,
          getRows(indA.genome),
          templateMap,
        )
        const result = simulateBattle(teamA, teamB, {
          seed: seed + 1,
          damageScale,
          defScaling,
          basicAttackMultiplier,
        })
        totalTurns += result.turns
        allTurns.push(result.turns)
        battleCount++
        if (result.winner === 'A') {
          indB.wins++
          indA.losses++
        } else if (result.winner === 'B') {
          indB.losses++
          indA.wins++
        } else {
          indB.draws++
          indA.draws++
        }
        if (hpCurveAcc && contribAcc && roleWinAcc && abilityAcc) {
          collectBattleTelemetry(
            result,
            hpCurveAcc,
            contribAcc,
            roleWinAcc,
            abilityAcc,
          )
        }
      } catch {
        // Skip failed battles
      }
    }
  }

  // Calculate fitness: wins / total, draws count as 0.5
  for (const ind of population) {
    const total = ind.wins + ind.losses + ind.draws
    if (total === 0) {
      ind.fitness = 0
    } else {
      ind.fitness = (ind.wins + ind.draws * 0.5) / total
    }
  }

  // Compute percentiles for turn spread
  allTurns.sort((a, b) => a - b)
  const p10 =
    allTurns.length > 0 ? allTurns[Math.floor(allTurns.length * 0.1)] : 0
  const p90 =
    allTurns.length > 0 ? allTurns[Math.floor(allTurns.length * 0.9)] : 0

  const telemetry =
    hpCurveAcc && contribAcc && roleWinAcc && abilityAcc
      ? finalizeTelemetry(
          hpCurveAcc,
          contribAcc,
          roleWinAcc,
          abilityAcc,
          battleCount,
        )
      : undefined

  return {
    avgTurns: battleCount > 0 ? totalTurns / battleCount : 0,
    turnP10: p10,
    turnP90: p90,
    telemetry,
  }
}

// ─── Snapshot ─────────────────────────────────────────────────────

function snapshotGeneration(
  population: Array<Individual>,
  generation: number,
  avgTurns: number,
  turnP10: number,
  turnP90: number,
): GenerationSnapshot {
  const sorted = [...population].sort((a, b) => b.fitness - a.fitness)
  const topQuartile = sorted.slice(
    0,
    Math.max(1, Math.ceil(population.length / 4)),
  )

  const roleDistribution: Record<string, number> = {}
  const rarityDistribution: Record<string, number> = {}
  const abilityPresence: Record<string, number> = {}
  const abilityFitnessSum: Record<string, number> = {}
  const creatureFrequency: Record<string, number> = {}
  const creatureFitnessSum: Record<string, number> = {}
  const synergyPresence: Record<string, number> = {}
  const formationDistribution: Record<string, number> = {}

  // Track comp distribution and win rates across ALL teams
  const compDistribution: Record<string, number> = {}
  const compWinAcc: Record<string, { wins: number; total: number }> = {}

  // Track per-creature and per-ability win rates across ALL teams
  const creaturePresenceAll: Record<string, number> = {}
  const creatureWinAcc: Record<string, { wins: number; total: number }> = {}
  const abilityPresenceAll: Record<string, number> = {}
  const abilityWinAcc: Record<string, { wins: number; total: number }> = {}

  for (const ind of population) {
    const roleCounts: Record<string, number> = {}
    for (const m of ind.members) {
      roleCounts[m.role] = (roleCounts[m.role] ?? 0) + 1
    }
    const compKey = Object.entries(roleCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([role, count]) => `${role}×${count}`)
      .join(' / ')
    compDistribution[compKey] = (compDistribution[compKey] ?? 0) + 1
    const total = ind.wins + ind.losses + ind.draws
    const wins = ind.wins + ind.draws * 0.5
    const acc = compWinAcc[compKey] ?? { wins: 0, total: 0 }
    acc.wins += wins
    acc.total += total
    compWinAcc[compKey] = acc

    // Per-creature tracking (all teams)
    for (const m of ind.members) {
      creaturePresenceAll[m.id] = (creaturePresenceAll[m.id] ?? 0) + 1
      const cAcc = creatureWinAcc[m.id] ?? { wins: 0, total: 0 }
      cAcc.wins += wins
      cAcc.total += total
      creatureWinAcc[m.id] = cAcc

      // Per-ability tracking (all teams)
      const abilityIds = [
        'basic_attack',
        m.active.templateId,
        m.passive.templateId,
      ]
      for (const aid of abilityIds) {
        abilityPresenceAll[aid] = (abilityPresenceAll[aid] ?? 0) + 1
        const aAcc = abilityWinAcc[aid] ?? { wins: 0, total: 0 }
        aAcc.wins += wins
        aAcc.total += total
        abilityWinAcc[aid] = aAcc
      }
    }
  }
  const compWinRates: Record<string, number> = {}
  for (const [comp, acc] of Object.entries(compWinAcc)) {
    compWinRates[comp] = acc.total > 0 ? acc.wins / acc.total : 0.5
  }
  // Compute global totals for differential calculation
  let globalWins = 0
  let globalTotal = 0
  for (const ind of population) {
    const total = ind.wins + ind.losses + ind.draws
    globalWins += ind.wins + ind.draws * 0.5
    globalTotal += total
  }

  // Win rate differential: WR(with) - WR(without) for each ability/creature
  const abilityWinRateAll: Record<string, number> = {}
  for (const [id, acc] of Object.entries(abilityWinAcc)) {
    const wrWith = acc.total > 0 ? acc.wins / acc.total : 0.5
    const withoutWins = globalWins - acc.wins
    const withoutTotal = globalTotal - acc.total
    const wrWithout = withoutTotal > 0 ? withoutWins / withoutTotal : 0.5
    abilityWinRateAll[id] = wrWith - wrWithout
  }
  const creatureWinRateAll: Record<string, number> = {}
  const creatureAbsWinRate: Record<string, number> = {}
  for (const [id, acc] of Object.entries(creatureWinAcc)) {
    const wrWith = acc.total > 0 ? acc.wins / acc.total : 0.5
    const withoutWins = globalWins - acc.wins
    const withoutTotal = globalTotal - acc.total
    const wrWithout = withoutTotal > 0 ? withoutWins / withoutTotal : 0.5
    creatureWinRateAll[id] = wrWith - wrWithout
    creatureAbsWinRate[id] = wrWith
  }

  for (const ind of topQuartile) {
    // Track formation (e.g., "2F/1B", "1F/2B")
    const frontCount = ind.genome.filter((s) => s.row === 'front').length
    const formKey = `${frontCount}F/${3 - frontCount}B`
    formationDistribution[formKey] = (formationDistribution[formKey] ?? 0) + 1

    for (const m of ind.members) {
      roleDistribution[m.role] = (roleDistribution[m.role] ?? 0) + 1
      rarityDistribution[m.rarity] = (rarityDistribution[m.rarity] ?? 0) + 1
      creatureFrequency[m.id] = (creatureFrequency[m.id] ?? 0) + 1
      creatureFitnessSum[m.id] = (creatureFitnessSum[m.id] ?? 0) + ind.fitness

      // Track abilities (including basic attack)
      const abilityIds = [
        'basic_attack',
        m.active.templateId,
        m.passive.templateId,
      ]
      for (const aid of abilityIds) {
        abilityPresence[aid] = (abilityPresence[aid] ?? 0) + 1
        abilityFitnessSum[aid] = (abilityFitnessSum[aid] ?? 0) + ind.fitness
      }
    }

    // Synergies
    for (const label of detectSynergies(ind.members)) {
      synergyPresence[label] = (synergyPresence[label] ?? 0) + 1
    }
  }

  const topInd = sorted[0]
  let totalFitness = 0
  for (const ind of population) totalFitness += ind.fitness

  // Track diversity: unique genomes in entire population
  const uniqueGenomes = new Set(population.map((ind) => genomeKey(ind.genome)))
    .size

  return {
    generation,
    topFitness: topInd.fitness,
    avgFitness: totalFitness / population.length,
    avgTurns,
    turnP10,
    turnP90,
    topTeamNames: topInd.members.map((m) => m.name) as [string, string, string],
    topTeamRows: getRows(topInd.genome),
    roleDistribution,
    rarityDistribution,
    abilityPresence,
    abilityFitnessSum,
    creatureFrequency,
    creatureFitnessSum,
    synergyPresence,
    formationDistribution,
    compDistribution,
    compWinRates,
    creaturePresenceAll,
    creatureWinRateAll,
    creatureAbsWinRate,
    abilityPresenceAll,
    abilityWinRateAll,
    uniqueGenomes,
  }
}

// ─── Final Aggregation ────────────────────────────────────────────

function buildFinalResult(
  snapshots: Array<GenerationSnapshot>,
  allTimeBest: Map<string, Individual>,
  creatureIndex: Map<string, CreatureRecord>,
): MetaResult {
  // Hall of fame: all unique teams by peak fitness (UI handles display limit)
  const hallOfFame = [...allTimeBest.values()].sort(
    (a, b) => b.fitness - a.fitness,
  )

  // Creature leaderboard: aggregate appearances and avg fitness from top-quartile snapshots
  const creatureAgg = new Map<
    string,
    { appearances: number; fitnessSum: number }
  >()
  for (const snap of snapshots) {
    for (const [id, count] of Object.entries(snap.creatureFrequency)) {
      const existing = creatureAgg.get(id) ?? {
        appearances: 0,
        fitnessSum: 0,
      }
      existing.appearances += count
      existing.fitnessSum += snap.creatureFitnessSum[id] ?? 0
      creatureAgg.set(id, existing)
    }
  }

  // Aggregate per-creature all-team win rates (weighted avg across snapshots)
  const creatureWrAcc: Record<string, { weightedWr: number; weight: number }> =
    {}
  for (const snap of snapshots) {
    for (const [id, wr] of Object.entries(snap.creatureWinRateAll)) {
      const count = snap.creaturePresenceAll[id] ?? 0
      const acc = creatureWrAcc[id] ?? { weightedWr: 0, weight: 0 }
      acc.weightedWr += wr * count
      acc.weight += count
      creatureWrAcc[id] = acc
    }
  }
  const creatureWinRates: Record<string, number> = {}
  for (const [id, acc] of Object.entries(creatureWrAcc)) {
    creatureWinRates[id] = acc.weight > 0 ? acc.weightedWr / acc.weight : 0
  }

  // Aggregate absolute creature win rates (weighted avg across snapshots)
  const creatureAbsWrAcc: Record<
    string,
    { weightedWr: number; weight: number }
  > = {}
  for (const snap of snapshots) {
    for (const [id, wr] of Object.entries(snap.creatureAbsWinRate)) {
      const count = snap.creaturePresenceAll[id] ?? 0
      const acc = creatureAbsWrAcc[id] ?? { weightedWr: 0, weight: 0 }
      acc.weightedWr += wr * count
      acc.weight += count
      creatureAbsWrAcc[id] = acc
    }
  }
  const creatureAbsWinRates: Record<string, number> = {}
  for (const [id, acc] of Object.entries(creatureAbsWrAcc)) {
    creatureAbsWinRates[id] = acc.weight > 0 ? acc.weightedWr / acc.weight : 0
  }

  const creatureLeaderboard = [...creatureAgg.entries()]
    .map(([id, agg]) => ({
      creature: creatureIndex.get(id),
      appearances: agg.appearances,
      avgFitness: agg.fitnessSum / agg.appearances,
      allTeamWinRate: creatureWinRates[id] ?? 0,
      winRate: creatureAbsWinRates[id] ?? 0.5,
    }))
    .filter(
      (c): c is typeof c & { creature: NonNullable<typeof c.creature> } =>
        !!c.creature,
    )
    .sort((a, b) => b.appearances - a.appearances)

  // Ability leaderboard
  const abilityAgg = new Map<
    string,
    { appearances: number; fitnessSum: number }
  >()
  for (const snap of snapshots) {
    for (const [id, count] of Object.entries(snap.abilityPresence)) {
      const existing = abilityAgg.get(id) ?? {
        appearances: 0,
        fitnessSum: 0,
      }
      existing.appearances += count
      existing.fitnessSum += snap.abilityFitnessSum[id] ?? 0
      abilityAgg.set(id, existing)
    }
  }

  // Aggregate per-ability all-team win rates (weighted avg across snapshots)
  const abilityWrAcc: Record<string, { weightedWr: number; weight: number }> =
    {}
  for (const snap of snapshots) {
    for (const [id, wr] of Object.entries(snap.abilityWinRateAll)) {
      const count = snap.abilityPresenceAll[id] ?? 0
      const acc = abilityWrAcc[id] ?? { weightedWr: 0, weight: 0 }
      acc.weightedWr += wr * count
      acc.weight += count
      abilityWrAcc[id] = acc
    }
  }
  const abilityWinRates: Record<string, number> = {}
  for (const [id, acc] of Object.entries(abilityWrAcc)) {
    abilityWinRates[id] = acc.weight > 0 ? acc.weightedWr / acc.weight : 0
  }

  const abilityLeaderboard = [...abilityAgg.entries()]
    .map(([id, agg]) => ({
      templateId: id,
      name: ABILITY_NAME_MAP.get(id) ?? id,
      abilityType: ABILITY_TYPE_MAP.get(id) ?? 'unknown',
      appearances: agg.appearances,
      avgFitness: agg.fitnessSum / agg.appearances,
      allTeamWinRate: abilityWinRates[id] ?? 0,
    }))
    .sort((a, b) => b.appearances - a.appearances)

  // Role meta share: normalize across all snapshots
  const roleTotals: Record<string, number> = {}
  let roleSum = 0
  for (const snap of snapshots) {
    for (const [role, count] of Object.entries(snap.roleDistribution)) {
      roleTotals[role] = (roleTotals[role] ?? 0) + count
      roleSum += count
    }
  }
  const roleMetaShare: Record<string, number> = {}
  for (const [role, count] of Object.entries(roleTotals)) {
    roleMetaShare[role] = roleSum > 0 ? count / roleSum : 0
  }

  // Synergy meta share
  const synergyTotals: Record<string, number> = {}
  const totalTeamsInTopQuartile = snapshots.reduce((sum, snap) => {
    const teamCount = Object.values(snap.roleDistribution).reduce(
      (a, b) => a + b,
      0,
    )
    return sum + teamCount / 3
  }, 0)
  for (const snap of snapshots) {
    for (const [syn, count] of Object.entries(snap.synergyPresence)) {
      synergyTotals[syn] = (synergyTotals[syn] ?? 0) + count
    }
  }
  const synergyMetaShare: Record<string, number> = {}
  for (const [syn, count] of Object.entries(synergyTotals)) {
    synergyMetaShare[syn] =
      totalTeamsInTopQuartile > 0 ? count / totalTeamsInTopQuartile : 0
  }

  // Formation meta share
  const formationTotals: Record<string, number> = {}
  let formationSum = 0
  for (const snap of snapshots) {
    for (const [form, count] of Object.entries(snap.formationDistribution)) {
      formationTotals[form] = (formationTotals[form] ?? 0) + count
      formationSum += count
    }
  }
  const formationMetaShare: Record<string, number> = {}
  for (const [form, count] of Object.entries(formationTotals)) {
    formationMetaShare[form] = formationSum > 0 ? count / formationSum : 0
  }

  // Comp meta share (from all teams, not just top quartile)
  const compTotals: Record<string, number> = {}
  let compSum = 0
  for (const snap of snapshots) {
    for (const [comp, count] of Object.entries(snap.compDistribution)) {
      compTotals[comp] = (compTotals[comp] ?? 0) + count
      compSum += count
    }
  }
  const compMetaShare: Record<string, number> = {}
  for (const [comp, count] of Object.entries(compTotals)) {
    compMetaShare[comp] = compSum > 0 ? count / compSum : 0
  }

  // Comp win rates (weighted average across snapshots)
  const compWinAcc: Record<string, { weightedWr: number; weight: number }> = {}
  for (const snap of snapshots) {
    for (const [comp, wr] of Object.entries(snap.compWinRates)) {
      const count = snap.compDistribution[comp] ?? 0
      const acc = compWinAcc[comp] ?? { weightedWr: 0, weight: 0 }
      acc.weightedWr += wr * count
      acc.weight += count
      compWinAcc[comp] = acc
    }
  }
  const compWinRates: Record<string, number> = {}
  for (const [comp, acc] of Object.entries(compWinAcc)) {
    compWinRates[comp] = acc.weight > 0 ? acc.weightedWr / acc.weight : 0.5
  }

  return {
    hallOfFame,
    creatureLeaderboard,
    abilityLeaderboard,
    roleMetaShare,
    synergyMetaShare,
    formationMetaShare,
    compMetaShare,
    compWinRates,
    creatureWinRates,
    abilityWinRates,
  }
}

// ─── Main Export ──────────────────────────────────────────────────

export function runMetaReport(
  creatures: Array<CreatureRecord>,
  options: MetaOptions,
): MetaRunResult {
  const log = options.csv
    ? (...a: Array<unknown>) => console.error(...a)
    : console.log.bind(console)

  if (creatures.length < 3) {
    throw new Error('Meta report requires at least 3 creatures')
  }

  // Build creature index for O(1) lookup
  const creatureIndex = new Map<string, CreatureRecord>(
    creatures.map((c) => [c.id, c]),
  )

  const snapshots: Array<GenerationSnapshot> = []
  const allTimeBest = new Map<string, Individual>()
  let finalTelemetry: TelemetryResult | undefined

  // Initialize population
  let population = initializePopulation(
    creatures,
    options.population,
    creatureIndex,
  )
  log(`  Initialized ${population.length} unique teams`)

  const bar = options.csv
    ? null
    : createProgressBar(options.generations, 'Generations')

  for (let gen = 1; gen <= options.generations; gen++) {
    const seedOffset = gen * options.population * options.matchesPerTeam * 2

    // Evaluate (collect telemetry on final generation only)
    const isFinalGen = gen === options.generations
    const { avgTurns, turnP10, turnP90, telemetry } = evaluateGeneration(
      population,
      options.matchesPerTeam,
      seedOffset,
      options.templateMap,
      options.damageScale,
      options.defScaling,
      isFinalGen,
      options.basicAttackMultiplier,
    )

    if (telemetry) finalTelemetry = telemetry

    // Update all-time best
    for (const ind of population) {
      const key = genomeKey(ind.genome)
      const prev = allTimeBest.get(key)
      if (!prev || ind.fitness > prev.fitness) {
        allTimeBest.set(key, {
          ...ind,
          generationBorn: ind.generationBorn || gen,
        })
      }
    }

    // Snapshot
    snapshots.push(
      snapshotGeneration(population, gen, avgTurns, turnP10, turnP90),
    )
    options.onGeneration?.(gen, snapshots[snapshots.length - 1])

    // Reproduce (skip on last generation)
    if (gen < options.generations) {
      population = selectAndReproduce(
        population,
        options.population,
        creatures,
        creatureIndex,
        options.eliteRate,
        options.mutationRate,
        gen + 1,
      )
    }

    bar?.increment()
  }

  bar?.stop()

  const result = buildFinalResult(snapshots, allTimeBest, creatureIndex)

  // Merge final-generation telemetry into result
  if (finalTelemetry) {
    result.roleHpCurves = finalTelemetry.roleHpCurves
    result.roleContributions = finalTelemetry.roleContributions
    result.roleWinRates = finalTelemetry.roleWinRates
    result.abilityUsage = finalTelemetry.abilityUsage
  }

  if (options.csv) {
    renderCsv(result, snapshots)
  } else {
    renderTerminal(result, snapshots, options)

    // Action analysis on final generation
    log('\n  Analyzing battle actions from top teams...')
    const actionProfiles = analyzeBattleActions(
      population,
      options.templateMap,
      options.damageScale,
      options.defScaling,
      options.basicAttackMultiplier,
    )
    renderActionAnalysis(actionProfiles)
  }

  return { result, snapshots }
}
