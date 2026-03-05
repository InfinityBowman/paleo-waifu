import { simulateBattle } from '@paleo-waifu/shared/battle/engine'
import { ALL_ABILITY_TEMPLATES } from '@paleo-waifu/shared/battle/constants'
import { assignRow, buildTeamWithRows, sampleTeam } from '../runner.ts'
import {
  createProgressBar,
  printHeader,
  printRankedList,
  printStatBlock,
  printSubheader,
  rarityColor,
  roleColor,
  winRateColor,
  writeCsvHeader,
  writeCsvRow,
} from '../report.ts'
import type { Row } from '@paleo-waifu/shared/battle/types'
import type { CreatureRecord } from '../db.ts'

// ─── Ability Name Lookup ──────────────────────────────────────────

const ABILITY_NAME_MAP = new Map<string, string>()
const ABILITY_TYPE_MAP = new Map<string, string>()
for (const t of ALL_ABILITY_TEMPLATES) {
  ABILITY_NAME_MAP.set(t.id, t.name)
  ABILITY_TYPE_MAP.set(
    t.id,
    t.trigger.type === 'onUse' ? 'active' : 'passive',
  )
}

// ─── Types ────────────────────────────────────────────────────────

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

export interface MetaOptions {
  population: number
  generations: number
  matchesPerTeam: number
  eliteRate: number
  mutationRate: number
  csv: boolean
  onGeneration?: (gen: number, snapshot: GenerationSnapshot) => void
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

// ─── Genome Utilities ─────────────────────────────────────────────

function canonicalGenome(slots: Array<CreatureSlot>): TeamGenome {
  return [...slots].sort((a, b) => a.id.localeCompare(b.id)) as TeamGenome
}

function genomeKey(g: TeamGenome): string {
  return g.map((s) => `${s.id}:${s.row}`).join('|')
}

function getRows(g: TeamGenome): [Row, Row, Row] {
  return [g[0].row, g[1].row, g[2].row]
}

function ensureFrontRow(slots: Array<CreatureSlot>): void {
  if (!slots.some((s) => s.row === 'front')) {
    slots[0].row = 'front'
  }
}

function resolveMembers(
  genome: TeamGenome,
  index: Map<string, CreatureRecord>,
): [CreatureRecord, CreatureRecord, CreatureRecord] {
  return genome.map((slot) => index.get(slot.id)!) as [
    CreatureRecord,
    CreatureRecord,
    CreatureRecord,
  ]
}

// ─── Synergy Detection (from creature metadata) ──────────────────

function detectSynergySummary(
  members: [CreatureRecord, CreatureRecord, CreatureRecord],
): Array<string> {
  const labels: Array<string> = []

  const types = members.map((m) => m.type)
  const eras = members.map((m) => m.era)
  const diets = members.map((m) => {
    const d = m.diet
    return d === 'Herbivorous/omnivorous' ? 'Herbivorous' : d
  })

  // Type synergy
  const typeCounts = new Map<string, number>()
  for (const t of types) typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1)
  const maxType = Math.max(...typeCounts.values())
  if (maxType >= 3) labels.push('Type 3x')
  else if (maxType >= 2) labels.push('Type 2x')

  // Era synergy
  const eraCounts = new Map<string, number>()
  for (const e of eras) eraCounts.set(e, (eraCounts.get(e) ?? 0) + 1)
  const maxEra = Math.max(...eraCounts.values())
  if (maxEra >= 3) labels.push('Era 3x')
  else if (maxEra >= 2) labels.push('Era 2x')

  // Diet synergy
  const uniqueDiets = new Set(diets)
  if (uniqueDiets.size === 1 && uniqueDiets.has('Carnivorous'))
    labels.push('All Carnivore')
  else if (uniqueDiets.size === 1 && uniqueDiets.has('Herbivorous'))
    labels.push('All Herbivore')
  else if (uniqueDiets.has('Carnivorous') && uniqueDiets.has('Herbivorous'))
    labels.push('Mixed Diet')

  return labels
}

// ─── Population Initialization ────────────────────────────────────

function initializePopulation(
  creatures: Array<CreatureRecord>,
  size: number,
  creatureIndex: Map<string, CreatureRecord>,
): Array<Individual> {
  const population: Array<Individual> = []
  const seen = new Set<string>()

  for (let attempt = 0; attempt < size * 3 && population.length < size; attempt++) {
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

    ensureFrontRow(slots)
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
): { avgTurns: number } {
  const n = population.length

  // Reset fitness for this generation
  for (const ind of population) {
    ind.fitness = 0
    ind.wins = 0
    ind.losses = 0
    ind.draws = 0
  }

  let battleIdx = 0
  let totalTurns = 0
  let battleCount = 0

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
        const aRate =
          aTotal > 0 ? (aInd.wins + aInd.draws * 0.5) / aTotal : 0.5
        const bRate =
          bTotal > 0 ? (bInd.wins + bInd.draws * 0.5) / bTotal : 0.5
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
        const teamA = buildTeamWithRows(indA.members, getRows(indA.genome))
        const teamB = buildTeamWithRows(indB.members, getRows(indB.genome))
        const result = simulateBattle(teamA, teamB, { seed })
        totalTurns += result.turns
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
      } catch {
        // Skip failed battles
      }

      // Game 2: swap sides (indB as team A, indA as team B)
      try {
        const teamA = buildTeamWithRows(indB.members, getRows(indB.genome))
        const teamB = buildTeamWithRows(indA.members, getRows(indA.genome))
        const result = simulateBattle(teamA, teamB, { seed: seed + 1 })
        totalTurns += result.turns
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

  return { avgTurns: battleCount > 0 ? totalTurns / battleCount : 0 }
}

// ─── Genetic Operators ────────────────────────────────────────────

function mutate(
  parent: Individual,
  creatures: Array<CreatureRecord>,
  creatureIndex: Map<string, CreatureRecord>,
  generation: number,
): Individual {
  const newSlots = parent.genome.map((s) => ({ ...s })) as [
    CreatureSlot,
    CreatureSlot,
    CreatureSlot,
  ]

  if (Math.random() < 0.3) {
    // Row mutation: flip a random member's row
    const slotIdx = Math.floor(Math.random() * 3)
    newSlots[slotIdx].row =
      newSlots[slotIdx].row === 'front' ? 'back' : 'front'
  } else {
    // Creature mutation: replace a random member
    const slotIdx = Math.floor(Math.random() * 3)
    const existing = new Set(newSlots.map((s) => s.id))

    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate =
        creatures[Math.floor(Math.random() * creatures.length)]
      if (!existing.has(candidate.id)) {
        newSlots[slotIdx] = {
          id: candidate.id,
          row: assignRow(candidate.role),
        }
        break
      }
    }
  }

  ensureFrontRow(newSlots)
  const genome = canonicalGenome(newSlots)
  return {
    genome,
    members: resolveMembers(genome, creatureIndex),
    fitness: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    generationBorn: generation,
  }
}

function crossover(
  parentA: Individual,
  parentB: Individual,
  creatures: Array<CreatureRecord>,
  creatureIndex: Map<string, CreatureRecord>,
  generation: number,
): Individual {
  // Take 1 or 2 slots from parentA, fill rest from parentB
  const crossPoint = Math.random() < 0.5 ? 1 : 2
  const childSlots: Array<CreatureSlot> = parentA.genome
    .slice(0, crossPoint)
    .map((s) => ({ ...s }))
  const childSet = new Set(childSlots.map((s) => s.id))

  // Fill from parentB, skipping duplicates
  for (const slot of parentB.genome) {
    if (childSlots.length >= 3) break
    if (!childSet.has(slot.id)) {
      childSlots.push({ ...slot })
      childSet.add(slot.id)
    }
  }

  // If still not full (parents share creatures), fill from random pool
  for (let attempt = 0; attempt < 50 && childSlots.length < 3; attempt++) {
    const candidate =
      creatures[Math.floor(Math.random() * creatures.length)]
    if (!childSet.has(candidate.id)) {
      childSlots.push({
        id: candidate.id,
        row: assignRow(candidate.role),
      })
      childSet.add(candidate.id)
    }
  }

  // Fallback to parentA if crossover couldn't produce a full team
  if (childSlots.length < 3) {
    return mutate(parentA, creatures, creatureIndex, generation)
  }

  ensureFrontRow(childSlots)
  const genome = canonicalGenome(
    childSlots as [CreatureSlot, CreatureSlot, CreatureSlot],
  )
  return {
    genome,
    members: resolveMembers(genome, creatureIndex),
    fitness: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    generationBorn: generation,
  }
}

// ─── Selection & Reproduction (with Diversity Pressure) ──────────

function selectAndReproduce(
  population: Array<Individual>,
  targetSize: number,
  creatures: Array<CreatureRecord>,
  creatureIndex: Map<string, CreatureRecord>,
  eliteRate: number,
  mutationRate: number,
  generation: number,
): Array<Individual> {
  // Sort by fitness descending
  const sorted = [...population].sort((a, b) => b.fitness - a.fitness)

  const eliteCount = Math.ceil(targetSize * eliteRate)
  const survivorCount = Math.ceil(population.length / 2)
  const survivors = sorted.slice(0, survivorCount)

  const nextGen: Array<Individual> = []
  const seen = new Set<string>()

  // Elite pass-through (reset fitness but keep genome)
  for (let i = 0; i < eliteCount && i < survivors.length; i++) {
    const elite = survivors[i]
    const key = genomeKey(elite.genome)
    seen.add(key)
    nextGen.push({
      ...elite,
      fitness: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    })
  }

  // Fill remaining with offspring, rejecting duplicate genomes
  let attempts = 0
  const maxAttempts = (targetSize - nextGen.length) * 5

  while (nextGen.length < targetSize && attempts < maxAttempts) {
    attempts++
    const parentIdx = Math.floor(Math.random() * survivors.length)
    const parent = survivors[parentIdx]

    let child: Individual
    if (Math.random() < mutationRate) {
      child = mutate(parent, creatures, creatureIndex, generation)
    } else {
      const otherIdx = Math.floor(Math.random() * survivors.length)
      const other = survivors[otherIdx]
      child = crossover(parent, other, creatures, creatureIndex, generation)
    }

    const key = genomeKey(child.genome)
    if (!seen.has(key)) {
      seen.add(key)
      nextGen.push(child)
    }
  }

  // If couldn't fill due to convergence, allow duplicates with forced mutation
  while (nextGen.length < targetSize) {
    const parentIdx = Math.floor(Math.random() * survivors.length)
    const parent = survivors[parentIdx]
    nextGen.push(mutate(parent, creatures, creatureIndex, generation))
  }

  return nextGen
}

// ─── Snapshot ─────────────────────────────────────────────────────

function snapshotGeneration(
  population: Array<Individual>,
  generation: number,
  avgTurns: number,
): GenerationSnapshot {
  const sorted = [...population].sort((a, b) => b.fitness - a.fitness)
  const topQuartile = sorted.slice(
    0,
    Math.max(1, Math.ceil(population.length / 4)),
  )

  const roleDistribution: Record<string, number> = {}
  const rarityDistribution: Record<string, number> = {}
  const abilityPresence: Record<string, number> = {}
  const creatureFrequency: Record<string, number> = {}
  const synergyPresence: Record<string, number> = {}
  const formationDistribution: Record<string, number> = {}

  for (const ind of topQuartile) {
    // Track formation (e.g., "2F/1B", "1F/2B")
    const frontCount = ind.genome.filter((s) => s.row === 'front').length
    const formKey = `${frontCount}F/${3 - frontCount}B`
    formationDistribution[formKey] =
      (formationDistribution[formKey] ?? 0) + 1

    for (const m of ind.members) {
      roleDistribution[m.role] = (roleDistribution[m.role] ?? 0) + 1
      rarityDistribution[m.rarity] =
        (rarityDistribution[m.rarity] ?? 0) + 1
      creatureFrequency[m.id] = (creatureFrequency[m.id] ?? 0) + 1

      // Track abilities
      const abilityIds = [
        m.active.templateId,
        m.passive.templateId,
      ]
      for (const aid of abilityIds) {
        abilityPresence[aid] = (abilityPresence[aid] ?? 0) + 1
      }
    }

    // Synergies
    for (const label of detectSynergySummary(ind.members)) {
      synergyPresence[label] = (synergyPresence[label] ?? 0) + 1
    }
  }

  const topInd = sorted[0]
  let totalFitness = 0
  for (const ind of population) totalFitness += ind.fitness

  // Track diversity: unique genomes in entire population
  const uniqueGenomes = new Set(
    population.map((ind) => genomeKey(ind.genome)),
  ).size

  return {
    generation,
    topFitness: topInd.fitness,
    avgFitness: totalFitness / population.length,
    avgTurns,
    topTeamNames: topInd.members.map((m) => m.name) as [
      string,
      string,
      string,
    ],
    topTeamRows: getRows(topInd.genome),
    roleDistribution,
    rarityDistribution,
    abilityPresence,
    creatureFrequency,
    synergyPresence,
    formationDistribution,
    uniqueGenomes,
  }
}

// ─── Final Aggregation ────────────────────────────────────────────

function buildFinalResult(
  snapshots: Array<GenerationSnapshot>,
  allTimeBest: Map<string, Individual>,
  creatureIndex: Map<string, CreatureRecord>,
): MetaResult {
  // Hall of fame: top 10 unique teams by peak fitness
  const hallOfFame = [...allTimeBest.values()]
    .sort((a, b) => b.fitness - a.fitness)
    .slice(0, 10)

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
      existing.fitnessSum += snap.topFitness * count
      creatureAgg.set(id, existing)
    }
  }

  const creatureLeaderboard = [...creatureAgg.entries()]
    .map(([id, agg]) => ({
      creature: creatureIndex.get(id),
      appearances: agg.appearances,
      avgFitness: agg.fitnessSum / agg.appearances,
    }))
    .filter((c): c is typeof c & { creature: NonNullable<typeof c.creature> } => !!c.creature)
    .sort((a, b) => b.appearances - a.appearances)
    .slice(0, 30)

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
      existing.fitnessSum += snap.topFitness * count
      abilityAgg.set(id, existing)
    }
  }

  const abilityLeaderboard = [...abilityAgg.entries()]
    .map(([id, agg]) => ({
      templateId: id,
      name: ABILITY_NAME_MAP.get(id) ?? id,
      abilityType: ABILITY_TYPE_MAP.get(id) ?? 'unknown',
      appearances: agg.appearances,
      avgFitness: agg.fitnessSum / agg.appearances,
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

  return {
    hallOfFame,
    creatureLeaderboard,
    abilityLeaderboard,
    roleMetaShare,
    synergyMetaShare,
    formationMetaShare,
  }
}

// ─── Terminal Output ──────────────────────────────────────────────

function renderTerminal(
  result: MetaResult,
  snapshots: Array<GenerationSnapshot>,
  options: MetaOptions,
): void {
  printHeader('GENERATIONAL META EVOLUTION')

  const totalBattles =
    options.population * options.matchesPerTeam * options.generations
  const overallAvgTurns =
    snapshots.length > 0
      ? snapshots.reduce((sum, s) => sum + s.avgTurns, 0) / snapshots.length
      : 0
  printStatBlock({
    Population: options.population,
    Generations: options.generations,
    'Rounds / team': options.matchesPerTeam,
    'Games / team': `${options.matchesPerTeam * 2} (both sides)`,
    'Elite rate': `${(options.eliteRate * 100).toFixed(0)}%`,
    'Mutation rate': `${(options.mutationRate * 100).toFixed(0)}%`,
    'Total battles': totalBattles.toLocaleString(),
    'Avg turns / match': overallAvgTurns.toFixed(1),
    Pairing: 'Swiss (strength-matched)',
    'Row evolution': 'Enabled',
  })

  // Generation progression
  printSubheader('FITNESS PROGRESSION')

  // Show every generation if <=15, otherwise sample evenly
  const displaySnaps =
    snapshots.length <= 15
      ? snapshots
      : (() => {
          const picks: Array<GenerationSnapshot> = [snapshots[0]]
          const step = (snapshots.length - 1) / 9
          for (let i = 1; i < 10; i++) {
            picks.push(snapshots[Math.round(i * step)])
          }
          if (picks[picks.length - 1] !== snapshots[snapshots.length - 1]) {
            picks.push(snapshots[snapshots.length - 1])
          }
          return picks
        })()

  printRankedList(
    [
      { header: 'Gen' },
      { header: 'Top Fit' },
      { header: 'Avg Fit' },
      { header: 'Avg Turns' },
      { header: 'Diversity' },
      { header: 'Top Team' },
    ],
    displaySnaps.map((s) => [
      String(s.generation),
      winRateColor(s.topFitness),
      winRateColor(s.avgFitness),
      s.avgTurns.toFixed(1),
      `${((s.uniqueGenomes / options.population) * 100).toFixed(0)}%`,
      s.topTeamNames.join(', '),
    ]),
  )

  // Hall of Fame
  printSubheader('HALL OF FAME (top 10 teams)')
  printRankedList(
    [
      { header: 'Members' },
      { header: 'Rarities' },
      { header: 'Roles' },
      { header: 'Rows' },
      { header: 'Peak Fitness' },
    ],
    result.hallOfFame.map((ind) => [
      ind.members.map((m) => m.name).join(', '),
      ind.members.map((m) => rarityColor(m.rarity)).join(', '),
      ind.members.map((m) => roleColor(m.role)).join(', '),
      ind.genome.map((s) => (s.row === 'front' ? 'F' : 'B')).join('/'),
      winRateColor(ind.fitness),
    ]),
  )

  // Role distribution
  printSubheader('META ROLE DISTRIBUTION (top-quartile teams)')
  const roleRows = Object.entries(result.roleMetaShare)
    .sort((a, b) => b[1] - a[1])
    .map(([role, share]) => [
      roleColor(role),
      `${(share * 100).toFixed(1)}%`,
    ])

  printRankedList([{ header: 'Role' }, { header: 'Share' }], roleRows)

  // Formation distribution
  printSubheader('META FORMATION DISTRIBUTION (top-quartile teams)')
  const formRows = Object.entries(result.formationMetaShare)
    .sort((a, b) => b[1] - a[1])
    .map(([form, share]) => [form, `${(share * 100).toFixed(1)}%`])

  printRankedList(
    [{ header: 'Formation' }, { header: 'Share' }],
    formRows,
  )

  // Top creatures
  printSubheader('TOP CREATURES (by meta presence)')
  printRankedList(
    [
      { header: 'Creature' },
      { header: 'Rarity' },
      { header: 'Role' },
      { header: 'Appearances' },
    ],
    result.creatureLeaderboard.slice(0, 20).map((c) => [
      c.creature.name,
      rarityColor(c.creature.rarity),
      roleColor(c.creature.role),
      String(c.appearances),
    ]),
  )

  // Ability leaderboard
  printSubheader('META ABILITY PRESENCE (active)')
  const activeAbilities = result.abilityLeaderboard
    .filter((a) => a.abilityType === 'active')
    .slice(0, 15)

  printRankedList(
    [{ header: 'Ability' }, { header: 'Appearances' }],
    activeAbilities.map((a) => [a.name, String(a.appearances)]),
  )

  printSubheader('META ABILITY PRESENCE (passive)')
  const passiveAbilities = result.abilityLeaderboard
    .filter((a) => a.abilityType === 'passive')
    .slice(0, 10)

  printRankedList(
    [{ header: 'Passive' }, { header: 'Appearances' }],
    passiveAbilities.map((a) => [a.name, String(a.appearances)]),
  )

  // Synergy presence
  printSubheader('META SYNERGY PRESENCE')
  const synergyRows = Object.entries(result.synergyMetaShare)
    .sort((a, b) => b[1] - a[1])
    .map(([syn, share]) => [syn, `${(share * 100).toFixed(1)}%`])

  printRankedList(
    [{ header: 'Synergy' }, { header: 'Presence' }],
    synergyRows,
  )
}

// ─── CSV Output ───────────────────────────────────────────────────

function renderCsv(
  result: MetaResult,
  snapshots: Array<GenerationSnapshot>,
): void {
  // Generation progression
  writeCsvHeader([
    'section',
    'generation',
    'top_fitness',
    'avg_fitness',
    'avg_turns',
    'unique_genomes',
    'member1',
    'member2',
    'member3',
    'row1',
    'row2',
    'row3',
  ])
  for (const s of snapshots) {
    writeCsvRow([
      'generation',
      s.generation,
      (s.topFitness * 100).toFixed(2),
      (s.avgFitness * 100).toFixed(2),
      s.avgTurns.toFixed(1),
      s.uniqueGenomes,
      s.topTeamNames[0],
      s.topTeamNames[1],
      s.topTeamNames[2],
      s.topTeamRows[0],
      s.topTeamRows[1],
      s.topTeamRows[2],
    ])
  }

  // Hall of fame
  writeCsvHeader([
    'section',
    'rank',
    'member1',
    'member2',
    'member3',
    'rarity1',
    'rarity2',
    'rarity3',
    'row1',
    'row2',
    'row3',
    'peak_fitness',
  ])
  for (const [i, ind] of result.hallOfFame.entries()) {
    writeCsvRow([
      'hall_of_fame',
      i + 1,
      ind.members[0].name,
      ind.members[1].name,
      ind.members[2].name,
      ind.members[0].rarity,
      ind.members[1].rarity,
      ind.members[2].rarity,
      ind.genome[0].row,
      ind.genome[1].row,
      ind.genome[2].row,
      (ind.fitness * 100).toFixed(2),
    ])
  }

  // Role share
  writeCsvHeader(['section', 'role', 'meta_share_pct'])
  for (const [role, share] of Object.entries(result.roleMetaShare)) {
    writeCsvRow(['role_share', role, (share * 100).toFixed(2)])
  }

  // Formation share
  writeCsvHeader(['section', 'formation', 'meta_share_pct'])
  for (const [form, share] of Object.entries(result.formationMetaShare)) {
    writeCsvRow(['formation_share', form, (share * 100).toFixed(2)])
  }

  // Ability leaderboard
  writeCsvHeader(['section', 'template_id', 'name', 'type', 'appearances'])
  for (const a of result.abilityLeaderboard) {
    writeCsvRow([
      'ability',
      a.templateId,
      a.name,
      a.abilityType,
      a.appearances,
    ])
  }

  // Creature leaderboard
  writeCsvHeader([
    'section',
    'name',
    'rarity',
    'role',
    'type',
    'diet',
    'era',
    'appearances',
    'avg_fitness',
  ])
  for (const c of result.creatureLeaderboard) {
    writeCsvRow([
      'creature',
      c.creature.name,
      c.creature.rarity,
      c.creature.role,
      c.creature.type,
      c.creature.diet,
      c.creature.era,
      c.appearances,
      (c.avgFitness * 100).toFixed(2),
    ])
  }

  // Synergy share
  writeCsvHeader(['section', 'synergy', 'meta_share_pct'])
  for (const [syn, share] of Object.entries(result.synergyMetaShare)) {
    writeCsvRow(['synergy', syn, (share * 100).toFixed(2)])
  }
}

// ─── Battle Action Analysis ──────────────────────────────────

interface ActionStats {
  abilityId: string
  abilityName: string
  useCount: number
  totalDamage: number
  avgDamage: number
}

interface RoleActionProfile {
  role: string
  totalActions: number
  basicAttackPct: number
  topAbilities: Array<ActionStats>
  totalDamageDealt: number
  avgDamagePerAction: number
}

function analyzeBattleActions(
  population: Array<Individual>,
): Array<RoleActionProfile> {
  const sorted = [...population].sort((a, b) => b.fitness - a.fitness)
  const topTeams = sorted.slice(0, Math.ceil(population.length / 4))

  const roleActions = new Map<
    string,
    Map<string, { uses: number; totalDmg: number }>
  >()
  const roleTotalDmg = new Map<string, number>()
  const roleTotalActions = new Map<string, number>()

  // Run each top team against random opponents, analyze both sides
  for (const team of topTeams) {
    for (let m = 0; m < 10; m++) {
      const opp = sorted[Math.floor(Math.random() * sorted.length)]
      const baseSeed = Math.floor(Math.random() * 1_000_000)

      // Play both sides so action analysis isn't side-biased
      for (const asSide of ['A', 'B'] as const) {
        try {
          let teamA, teamB
          if (asSide === 'A') {
            teamA = buildTeamWithRows(team.members, getRows(team.genome))
            teamB = buildTeamWithRows(opp.members, getRows(opp.genome))
          } else {
            teamA = buildTeamWithRows(opp.members, getRows(opp.genome))
            teamB = buildTeamWithRows(team.members, getRows(team.genome))
          }

          const result = simulateBattle(teamA, teamB, {
            seed: baseSeed + (asSide === 'B' ? 1 : 0),
          })

          // Only analyze when the top team wins
          if (result.winner !== asSide) continue

          // Build creature->role map for the top team
          const prefix = `${asSide}-`
          const creatureRoleMap = new Map<string, string>()
          for (let i = 0; i < team.members.length; i++) {
            const member = team.members[i]
            const battleId = `${asSide}-${i}-${member.id}-${i}`
            creatureRoleMap.set(battleId, member.role)
          }

          const lastAbilityByCreature = new Map<string, string>()

          for (const event of result.log) {
            if (event.type === 'creature_action') {
              const creatureId = (event as any).creatureId as string
              if (!creatureId.startsWith(prefix)) continue

              const role = creatureRoleMap.get(creatureId)
              if (!role) continue

              const abilityId = (event as any).abilityId as string
              lastAbilityByCreature.set(creatureId, abilityId)

              if (!roleActions.has(role)) roleActions.set(role, new Map())
              const roleMap = roleActions.get(role)!
              const existing = roleMap.get(abilityId) ?? {
                uses: 0,
                totalDmg: 0,
              }
              existing.uses++
              roleMap.set(abilityId, existing)

              roleTotalActions.set(
                role,
                (roleTotalActions.get(role) ?? 0) + 1,
              )
            }

            if (event.type === 'damage') {
              const sourceId = (event as any).sourceId as string
              if (!sourceId.startsWith(prefix)) continue

              const role = creatureRoleMap.get(sourceId)
              if (!role) continue

              const dmg = (event as any).amount as number
              if (dmg <= 0) continue

              const abilityId =
                lastAbilityByCreature.get(sourceId) ?? 'basic_attack'
              const roleMap = roleActions.get(role)
              if (roleMap) {
                const existing = roleMap.get(abilityId) ?? {
                  uses: 0,
                  totalDmg: 0,
                }
                existing.totalDmg += dmg
                roleMap.set(abilityId, existing)
              }

              roleTotalDmg.set(
                role,
                (roleTotalDmg.get(role) ?? 0) + dmg,
              )
            }
          }
        } catch {
          // skip
        }
      }
    }
  }

  // Build profiles
  const profiles: Array<RoleActionProfile> = []

  for (const [role, actionMap] of roleActions) {
    const totalActions = roleTotalActions.get(role) ?? 0
    const totalDmg = roleTotalDmg.get(role) ?? 0
    const basicAttack = actionMap.get('basic_attack')
    const basicPct = basicAttack
      ? (basicAttack.uses / totalActions) * 100
      : 0

    const topAbilities = [...actionMap.entries()]
      .map(([id, stats]) => ({
        abilityId: id,
        abilityName: ABILITY_NAME_MAP.get(id) ?? id,
        useCount: stats.uses,
        totalDamage: stats.totalDmg,
        avgDamage: stats.uses > 0 ? stats.totalDmg / stats.uses : 0,
      }))
      .sort((a, b) => b.useCount - a.useCount)
      .slice(0, 8)

    profiles.push({
      role,
      totalActions,
      basicAttackPct: basicPct,
      topAbilities,
      totalDamageDealt: totalDmg,
      avgDamagePerAction: totalActions > 0 ? totalDmg / totalActions : 0,
    })
  }

  return profiles.sort((a, b) => b.totalDamageDealt - a.totalDamageDealt)
}

function renderActionAnalysis(profiles: Array<RoleActionProfile>): void {
  printSubheader('WINNING TEAM ACTION ANALYSIS (by role)')

  for (const profile of profiles) {
    console.log(
      `\n  ${roleColor(profile.role).toUpperCase()} — ${profile.totalActions} actions, ${Math.round(profile.totalDamageDealt)} total dmg, ${profile.avgDamagePerAction.toFixed(1)} avg dmg/action, ${profile.basicAttackPct.toFixed(1)}% basic attacks`,
    )

    printRankedList(
      [
        { header: 'Ability' },
        { header: 'Uses' },
        { header: 'Total Dmg' },
        { header: 'Avg Dmg' },
        { header: '% of Actions' },
      ],
      profile.topAbilities.map((a) => [
        a.abilityName,
        String(a.useCount),
        String(Math.round(a.totalDamage)),
        a.avgDamage.toFixed(1),
        `${((a.useCount / profile.totalActions) * 100).toFixed(1)}%`,
      ]),
    )
  }
}

// ─── Main Export ──────────────────────────────────────────────────

export interface MetaRunResult {
  result: MetaResult
  snapshots: Array<GenerationSnapshot>
}

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
    const seedOffset =
      gen * options.population * options.matchesPerTeam * 2

    // Evaluate
    const { avgTurns } = evaluateGeneration(
      population,
      options.matchesPerTeam,
      seedOffset,
    )

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
    snapshots.push(snapshotGeneration(population, gen, avgTurns))
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

  if (options.csv) {
    renderCsv(result, snapshots)
  } else {
    renderTerminal(result, snapshots, options)

    // Action analysis on final generation
    log('\n  Analyzing battle actions from top teams...')
    const actionProfiles = analyzeBattleActions(population)
    renderActionAnalysis(actionProfiles)
  }

  return { result, snapshots }
}
