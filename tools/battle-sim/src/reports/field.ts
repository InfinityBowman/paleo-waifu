import { simulateBattle } from '@paleo-waifu/shared/battle/engine'
import {
  assignRow,
  buildTeam,
  buildTeamWithRows,
  sampleTeam,
} from '../runner.ts'
import { createProgressBar } from '../report.ts'
import { ABILITY_NAME_MAP } from './meta-types.ts'
import { detectSynergies } from './synergy.ts'
import type { Row } from '@paleo-waifu/shared/battle/types'
import type { CreatureRecord } from '../db.ts'
import type {
  AbilityImpact,
  BalanceScorecard,
  CreatureFieldStats,
  CreatureTeamStats,
  FieldOptions,
  FieldResult,
  FieldRunResult,
  RoleMatchup,
  SynergyImpact,
  TeamAbilityImpact,
  TeamRoleMatchup,
} from './field-types.ts'

// Re-export public types
export type {
  AbilityImpact,
  BalanceScorecard,
  CreatureFieldStats,
  CreatureTeamStats,
  FieldOptions,
  FieldResult,
  FieldRunResult,
  RoleMatchup,
  SynergyImpact,
  TeamAbilityImpact,
  TeamRoleMatchup,
} from './field-types.ts'

// ─── Utility ─────────────────────────────────────────────────────

function compString(
  members: [CreatureRecord, CreatureRecord, CreatureRecord],
): string {
  const roleCounts: Record<string, number> = {}
  for (const m of members) {
    roleCounts[m.role] = (roleCounts[m.role] ?? 0) + 1
  }
  return Object.entries(roleCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([role, count]) => `${role}×${count}`)
    .join(' / ')
}

function assignTeamRows(
  members: [CreatureRecord, CreatureRecord, CreatureRecord],
): [Row, Row, Row] {
  const rows = members.map((m) => assignRow(m.role)) as [Row, Row, Row]
  // Ensure at least one front and one back
  const hasFront = rows.some((r) => r === 'front')
  const hasBack = rows.some((r) => r === 'back')
  if (!hasFront) {
    rows[Math.floor(Math.random() * 3)] = 'front'
  } else if (!hasBack) {
    rows[Math.floor(Math.random() * 3)] = 'back'
  }
  return rows
}

function formationFromRows(rows: [Row, Row, Row]): string {
  const frontCount = rows.filter((r) => r === 'front').length
  return `${frontCount}F/${3 - frontCount}B`
}

function giniCoefficient(values: Array<number>): number {
  const n = values.length
  if (n === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += (2 * (i + 1) - n - 1) * sorted[i]
  }
  const mean = sorted.reduce((a, b) => a + b, 0) / n
  return mean > 0 ? sum / (n * n * mean) : 0
}

// ─── Creature Round-Robin ────────────────────────────────────────

function runCreatureRoundRobin(
  creatures: Array<CreatureRecord>,
  options: FieldOptions,
): {
  creatureStats: Array<CreatureFieldStats>
  roleMatchupMatrix: Array<RoleMatchup>
  abilityImpact: Array<AbilityImpact>
} {
  const n = creatures.length
  const totalPairs = (n * (n - 1)) / 2

  // Per-creature aggregates
  const stats = new Map<string, { wins: number; total: number }>()
  for (const c of creatures) {
    stats.set(c.id, { wins: 0, total: 0 })
  }

  // Per-pair matchup results (for best/worst matchup per creature)
  const pairResults = new Map<
    string,
    Map<string, { wins: number; total: number }>
  >()
  for (const c of creatures) {
    pairResults.set(c.id, new Map())
  }

  // Role-vs-role aggregation
  const roleAgg = new Map<
    string,
    Map<string, { wins: number; total: number }>
  >()

  const bar = options.csv
    ? null
    : createProgressBar(totalPairs, 'Creature round-robin')
  let pairsDone = 0

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = creatures[i]
      const b = creatures[j]

      const halfTrials = Math.ceil(options.trialsPerPair / 2)
      const otherHalf = options.trialsPerPair - halfTrials
      let winsA = 0
      let winsB = 0
      let played = 0

      // Side 1: a as team A, b as team B
      for (let t = 0; t < halfTrials; t++) {
        try {
          const teamA = buildTeam([a, a, a], options.templateMap)
          const teamB = buildTeam([b, b, b], options.templateMap)
          const result = simulateBattle(teamA, teamB, {
            seed: pairsDone * options.trialsPerPair * 2 + t,
            damageScale: options.damageScale,
            defScaling: options.defScaling,
            basicAttackMultiplier: options.basicAttackMultiplier,
          })
          if (result.winner === 'A') winsA++
          else if (result.winner === 'B') winsB++
          played++
        } catch {
          // Skip failed battles
        }
      }

      // Side 2: b as team A, a as team B (swap sides for symmetry)
      for (let t = 0; t < otherHalf; t++) {
        try {
          const teamA = buildTeam([b, b, b], options.templateMap)
          const teamB = buildTeam([a, a, a], options.templateMap)
          const result = simulateBattle(teamA, teamB, {
            seed: pairsDone * options.trialsPerPair * 2 + halfTrials + t,
            damageScale: options.damageScale,
            defScaling: options.defScaling,
            basicAttackMultiplier: options.basicAttackMultiplier,
          })
          // Inverted: B winning means creature a wins, A winning means creature b wins
          if (result.winner === 'B') winsA++
          else if (result.winner === 'A') winsB++
          played++
        } catch {
          // Skip failed battles
        }
      }

      if (played > 0) {
        // Per-creature stats
        const sA = stats.get(a.id)!
        const sB = stats.get(b.id)!
        sA.wins += winsA
        sA.total += played
        sB.wins += winsB
        sB.total += played

        // Per-pair matchups
        pairResults.get(a.id)!.set(b.id, { wins: winsA, total: played })
        pairResults.get(b.id)!.set(a.id, { wins: winsB, total: played })

        // Role-vs-role aggregation
        const roleA = a.role
        const roleB = b.role
        if (!roleAgg.has(roleA)) roleAgg.set(roleA, new Map())
        if (!roleAgg.has(roleB)) roleAgg.set(roleB, new Map())

        if (roleA === roleB) {
          // Same-role mirror: both perspectives go into one cell
          const agg = roleAgg.get(roleA)!.get(roleB) ?? {
            wins: 0,
            total: 0,
          }
          agg.wins += winsA + winsB
          agg.total += played * 2
          roleAgg.get(roleA)!.set(roleB, agg)
        } else {
          // Different roles: each side gets its own cell
          const abAgg = roleAgg.get(roleA)!.get(roleB) ?? {
            wins: 0,
            total: 0,
          }
          abAgg.wins += winsA
          abAgg.total += played
          roleAgg.get(roleA)!.set(roleB, abAgg)

          const baAgg = roleAgg.get(roleB)!.get(roleA) ?? {
            wins: 0,
            total: 0,
          }
          baAgg.wins += winsB
          baAgg.total += played
          roleAgg.get(roleB)!.set(roleA, baAgg)
        }
      }

      pairsDone++
      bar?.increment()
      options.onProgress?.('creature-roundrobin', pairsDone, totalPairs)
    }
  }

  bar?.stop()

  // Creature index for name lookups
  const creatureIndex = new Map(creatures.map((c) => [c.id, c]))

  // Build per-creature stats with best/worst matchups
  const creatureStats: Array<CreatureFieldStats> = creatures
    .map((c) => {
      const s = stats.get(c.id)!
      const matchups = pairResults.get(c.id)!
      const winRate = s.total > 0 ? s.wins / s.total : 0.5

      let bestMatchup = { opponentId: '', opponentName: '', winRate: -Infinity }
      let worstMatchup = {
        opponentId: '',
        opponentName: '',
        winRate: Infinity,
      }

      for (const [oppId, result] of matchups) {
        const oppWr = result.total > 0 ? result.wins / result.total : 0.5
        const opp = creatureIndex.get(oppId)!
        if (oppWr > bestMatchup.winRate) {
          bestMatchup = {
            opponentId: oppId,
            opponentName: opp.name,
            winRate: oppWr,
          }
        }
        if (oppWr < worstMatchup.winRate) {
          worstMatchup = {
            opponentId: oppId,
            opponentName: opp.name,
            winRate: oppWr,
          }
        }
      }

      return {
        id: c.id,
        name: c.name,
        role: c.role,
        rarity: c.rarity,
        winRate,
        wins: s.wins,
        total: s.total,
        bestMatchup,
        worstMatchup,
      }
    })
    .sort((a, b) => b.winRate - a.winRate)

  // Role matchup matrix
  const roleMatchupMatrix: Array<RoleMatchup> = []
  for (const [attacker, defenders] of roleAgg) {
    for (const [defender, agg] of defenders) {
      roleMatchupMatrix.push({
        attacker,
        defender,
        winRate: agg.total > 0 ? agg.wins / agg.total : 0.5,
        sampleSize: agg.total,
      })
    }
  }

  // Ability impact: group creatures by ability, compute avg WR
  const activeGroups = new Map<string, Array<number>>()
  const passiveGroups = new Map<string, Array<number>>()

  for (const cs of creatureStats) {
    const c = creatureIndex.get(cs.id)!
    if (!activeGroups.has(c.active.templateId))
      activeGroups.set(c.active.templateId, [])
    activeGroups.get(c.active.templateId)!.push(cs.winRate)

    if (!passiveGroups.has(c.passive.templateId))
      passiveGroups.set(c.passive.templateId, [])
    passiveGroups.get(c.passive.templateId)!.push(cs.winRate)
  }

  const abilityImpact: Array<AbilityImpact> = []
  for (const [id, rates] of activeGroups) {
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length
    abilityImpact.push({
      templateId: id,
      name: ABILITY_NAME_MAP.get(id) ?? id,
      abilityType: 'active',
      avgWinRate: avg,
      creaturesWithAbility: rates.length,
    })
  }
  for (const [id, rates] of passiveGroups) {
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length
    abilityImpact.push({
      templateId: id,
      name: ABILITY_NAME_MAP.get(id) ?? id,
      abilityType: 'passive',
      avgWinRate: avg,
      creaturesWithAbility: rates.length,
    })
  }
  abilityImpact.sort((a, b) => b.avgWinRate - a.avgWinRate)

  return { creatureStats, roleMatchupMatrix, abilityImpact }
}

// ─── Team Round-Robin ────────────────────────────────────────────

function runTeamRoundRobin(
  creatures: Array<CreatureRecord>,
  options: FieldOptions,
): {
  synergyImpact: Array<SynergyImpact>
  creatureTeamStats: Map<string, { wins: number; total: number }>
  compWinRates: Record<string, { winRate: number; count: number }>
  formationWinRates: Record<string, { winRate: number; count: number }>
  teamAbilityImpact: Array<TeamAbilityImpact>
  teamRoleMatchup: Array<TeamRoleMatchup>
  /** Per-creature pair co-occurrence: Map<"id1:id2", {wins, total}> */
  teammatePairs: Map<string, { wins: number; total: number }>
} {
  if (creatures.length < 3) {
    return {
      synergyImpact: [],
      creatureTeamStats: new Map(),
      compWinRates: {},
      formationWinRates: {},
      teamAbilityImpact: [],
      teamRoleMatchup: [],
      teammatePairs: new Map(),
    }
  }

  // Sample random teams
  const teams: Array<{
    members: [CreatureRecord, CreatureRecord, CreatureRecord]
    rows: [Row, Row, Row]
    comp: string
    formation: string
    synergies: Array<string>
    wins: number
    total: number
  }> = []

  for (let i = 0; i < options.teamSampleSize; i++) {
    const members = sampleTeam(creatures)
    const rows = assignTeamRows(members)
    teams.push({
      members,
      rows,
      comp: compString(members),
      formation: formationFromRows(rows),
      synergies: detectSynergies(members),
      wins: 0,
      total: 0,
    })
  }

  // Per-creature stats in team context
  const creatureTeamAgg = new Map<string, { wins: number; total: number }>()

  // Per-ability stats in team context
  const abilityTeamAgg = new Map<
    string,
    { wins: number; total: number; creatures: Set<string> }
  >()

  // Per-role stats in team context
  const roleTeamAgg = new Map<string, { wins: number; total: number }>()

  // Per-creature-pair co-occurrence stats (teammate synergy)
  const teammatePairs = new Map<string, { wins: number; total: number }>()

  function pairKey(a: string, b: string): string {
    return a < b ? `${a}:${b}` : `${b}:${a}`
  }

  const bar = options.csv
    ? null
    : createProgressBar(options.teamSampleSize, 'Team round-robin')

  // Each team plays teamMatchCount random opponents
  for (let i = 0; i < teams.length; i++) {
    const team = teams[i]

    for (let m = 0; m < options.teamMatchCount; m++) {
      // Pick random opponent (not self)
      let oppIdx = Math.floor(Math.random() * (teams.length - 1))
      if (oppIdx >= i) oppIdx++
      const opp = teams[oppIdx]

      try {
        const teamA = buildTeamWithRows(
          team.members,
          team.rows,
          options.templateMap,
        )
        const teamB = buildTeamWithRows(
          opp.members,
          opp.rows,
          options.templateMap,
        )
        const result = simulateBattle(teamA, teamB, {
          seed: i * options.teamMatchCount + m,
          damageScale: options.damageScale,
          defScaling: options.defScaling,
          basicAttackMultiplier: options.basicAttackMultiplier,
        })

        team.total++
        opp.total++

        const winValue = (side: 'A' | 'B') => {
          if (result.winner === side) return 1
          if (result.winner === null) return 0.5
          return 0
        }

        // Track per-creature participation
        const sides: Array<{
          members: [CreatureRecord, CreatureRecord, CreatureRecord]
          side: 'A' | 'B'
        }> = [
          { members: team.members, side: 'A' },
          { members: opp.members, side: 'B' },
        ]

        for (const { members, side } of sides) {
          const wv = winValue(side)

          for (const c of members) {
            // Per-creature
            const agg = creatureTeamAgg.get(c.id) ?? { wins: 0, total: 0 }
            agg.total++
            agg.wins += wv
            creatureTeamAgg.set(c.id, agg)

            // Per-ability (active)
            const activeAgg = abilityTeamAgg.get(c.active.templateId) ?? {
              wins: 0,
              total: 0,
              creatures: new Set(),
            }
            activeAgg.total++
            activeAgg.wins += wv
            activeAgg.creatures.add(c.id)
            abilityTeamAgg.set(c.active.templateId, activeAgg)

            // Per-ability (passive)
            const passiveAgg = abilityTeamAgg.get(c.passive.templateId) ?? {
              wins: 0,
              total: 0,
              creatures: new Set(),
            }
            passiveAgg.total++
            passiveAgg.wins += wv
            passiveAgg.creatures.add(c.id)
            abilityTeamAgg.set(c.passive.templateId, passiveAgg)

            // Per-role
            const rAgg = roleTeamAgg.get(c.role) ?? { wins: 0, total: 0 }
            rAgg.total++
            rAgg.wins += wv
            roleTeamAgg.set(c.role, rAgg)
          }

          // Per-teammate-pair co-occurrence
          for (let a = 0; a < members.length; a++) {
            for (let b = a + 1; b < members.length; b++) {
              const key = pairKey(members[a].id, members[b].id)
              const pAgg = teammatePairs.get(key) ?? { wins: 0, total: 0 }
              pAgg.total++
              pAgg.wins += wv
              teammatePairs.set(key, pAgg)
            }
          }
        }

        if (result.winner === 'A') {
          team.wins++
        } else if (result.winner === 'B') {
          opp.wins++
        } else {
          team.wins += 0.5
          opp.wins += 0.5
        }
      } catch {
        // Skip failed battles
      }
    }

    bar?.increment()
    options.onProgress?.('team-roundrobin', i + 1, options.teamSampleSize)
  }

  bar?.stop()

  // Aggregate comp win rates
  const compAgg: Record<
    string,
    { wins: number; total: number; count: number }
  > = {}
  for (const t of teams) {
    const acc = compAgg[t.comp] ?? { wins: 0, total: 0, count: 0 }
    acc.wins += t.wins
    acc.total += t.total
    acc.count++
    compAgg[t.comp] = acc
  }
  const compWinRates: Record<string, { winRate: number; count: number }> = {}
  for (const [comp, acc] of Object.entries(compAgg)) {
    compWinRates[comp] = {
      winRate: acc.total > 0 ? acc.wins / acc.total : 0.5,
      count: acc.count,
    }
  }

  // Aggregate formation win rates
  const formAgg: Record<
    string,
    { wins: number; total: number; count: number }
  > = {}
  for (const t of teams) {
    const acc = formAgg[t.formation] ?? { wins: 0, total: 0, count: 0 }
    acc.wins += t.wins
    acc.total += t.total
    acc.count++
    formAgg[t.formation] = acc
  }
  const formationWinRates: Record<string, { winRate: number; count: number }> =
    {}
  for (const [form, acc] of Object.entries(formAgg)) {
    formationWinRates[form] = {
      winRate: acc.total > 0 ? acc.wins / acc.total : 0.5,
      count: acc.count,
    }
  }

  // Synergy impact: avg WR of teams WITH synergy vs teams WITHOUT
  const allSynergies = new Set<string>()
  for (const t of teams) {
    for (const s of t.synergies) allSynergies.add(s)
  }

  const synergyImpact: Array<SynergyImpact> = []
  for (const syn of allSynergies) {
    const withSyn = teams.filter((t) => t.synergies.includes(syn))
    const withoutSyn = teams.filter((t) => !t.synergies.includes(syn))

    const avgWith =
      withSyn.length > 0
        ? withSyn.reduce(
            (sum, t) => sum + (t.total > 0 ? t.wins / t.total : 0.5),
            0,
          ) / withSyn.length
        : 0.5
    const avgWithout =
      withoutSyn.length > 0
        ? withoutSyn.reduce(
            (sum, t) => sum + (t.total > 0 ? t.wins / t.total : 0.5),
            0,
          ) / withoutSyn.length
        : 0.5

    synergyImpact.push({
      synergy: syn,
      avgWinRate: avgWith,
      avgWinRateWithout: avgWithout,
      delta: avgWith - avgWithout,
      sampleSize: withSyn.length,
    })
  }
  synergyImpact.sort((a, b) => b.delta - a.delta)

  // Build team ability impact
  const teamAbilityImpact: Array<TeamAbilityImpact> = []
  for (const [id, agg] of abilityTeamAgg) {
    // Determine if active or passive by checking which creatures have it
    const creature = creatures.find((c) => c.active.templateId === id)
    const abilityType: 'active' | 'passive' = creature ? 'active' : 'passive'

    teamAbilityImpact.push({
      templateId: id,
      name: ABILITY_NAME_MAP.get(id) ?? id,
      abilityType,
      teamWinRate: agg.total > 0 ? agg.wins / agg.total : 0.5,
      creaturesWithAbility: agg.creatures.size,
      sampleSize: agg.total,
    })
  }
  teamAbilityImpact.sort((a, b) => b.teamWinRate - a.teamWinRate)

  // Build team role matchup
  const teamRoleMatchup: Array<TeamRoleMatchup> = []
  for (const [role, agg] of roleTeamAgg) {
    teamRoleMatchup.push({
      role,
      winRate: agg.total > 0 ? agg.wins / agg.total : 0.5,
      sampleSize: agg.total,
    })
  }
  teamRoleMatchup.sort((a, b) => b.winRate - a.winRate)

  return {
    synergyImpact,
    creatureTeamStats: creatureTeamAgg,
    compWinRates,
    formationWinRates,
    teamAbilityImpact,
    teamRoleMatchup,
    teammatePairs,
  }
}

// ─── Balance Scorecard (from team win rates) ─────────────────────

function computeScorecard(
  creatureTeamStats: Array<CreatureTeamStats>,
): BalanceScorecard {
  const winRates = creatureTeamStats.map((c) => c.teamWinRate)
  const n = winRates.length

  if (n === 0) {
    return {
      giniCoefficient: 0,
      maxWinRate: 0,
      minWinRate: 0,
      winRateSpread: 0,
      roleWinRateVariance: 0,
      percentWithin45to55: 0,
      percentWithin40to60: 0,
    }
  }

  const maxWinRate = Math.max(...winRates)
  const minWinRate = Math.min(...winRates)
  const within45to55 = winRates.filter((r) => r >= 0.45 && r <= 0.55).length
  const within40to60 = winRates.filter((r) => r >= 0.4 && r <= 0.6).length

  // Role win rate variance: how much do average team WRs differ across roles?
  const roleWrs = new Map<string, Array<number>>()
  for (const cs of creatureTeamStats) {
    if (!roleWrs.has(cs.role)) roleWrs.set(cs.role, [])
    roleWrs.get(cs.role)!.push(cs.teamWinRate)
  }
  const roleAvgs: Array<number> = []
  for (const rates of roleWrs.values()) {
    roleAvgs.push(rates.reduce((a, b) => a + b, 0) / rates.length)
  }
  const roleAvgMean =
    roleAvgs.length > 0
      ? roleAvgs.reduce((a, b) => a + b, 0) / roleAvgs.length
      : 0.5
  const roleVariance =
    roleAvgs.length > 0
      ? roleAvgs.reduce((sum, r) => sum + (r - roleAvgMean) ** 2, 0) /
        roleAvgs.length
      : 0

  return {
    giniCoefficient: giniCoefficient(winRates),
    maxWinRate,
    minWinRate,
    winRateSpread: maxWinRate - minWinRate,
    roleWinRateVariance: roleVariance,
    percentWithin45to55: (within45to55 / n) * 100,
    percentWithin40to60: (within40to60 / n) * 100,
  }
}

// ─── Main Export ──────────────────────────────────────────────────

export function runFieldReport(
  creatures: Array<CreatureRecord>,
  options: FieldOptions,
): FieldRunResult {
  if (creatures.length < 2) {
    throw new Error('Field report requires at least 2 creatures')
  }

  const { creatureStats, roleMatchupMatrix, abilityImpact } =
    runCreatureRoundRobin(creatures, options)

  const {
    synergyImpact,
    creatureTeamStats: creatureTeamAgg,
    compWinRates,
    formationWinRates,
    teamAbilityImpact,
    teamRoleMatchup,
    teammatePairs,
  } = runTeamRoundRobin(creatures, options)

  // Build creature team stats with 1v1 comparison and best/worst teammates
  const creatureIndex = new Map(creatures.map((c) => [c.id, c]))
  const soloIndex = new Map(creatureStats.map((c) => [c.id, c]))
  const creatureTeamStats: Array<CreatureTeamStats> = creatures
    .map((c) => {
      const teamAgg = creatureTeamAgg.get(c.id)
      const teamWinRate =
        teamAgg && teamAgg.total > 0 ? teamAgg.wins / teamAgg.total : 0.5
      const soloWinRate = soloIndex.get(c.id)?.winRate ?? 0.5

      // Find best/worst teammates from co-occurrence data
      let bestTeammate = { id: '', name: '', winRate: -Infinity }
      let worstTeammate = { id: '', name: '', winRate: Infinity }

      for (const [key, agg] of teammatePairs) {
        const [idA, idB] = key.split(':')
        const partnerId = idA === c.id ? idB : idB === c.id ? idA : null
        if (!partnerId || agg.total < 3) continue

        const wr = agg.wins / agg.total
        const partner = creatureIndex.get(partnerId)
        if (!partner) continue

        if (wr > bestTeammate.winRate) {
          bestTeammate = { id: partnerId, name: partner.name, winRate: wr }
        }
        if (wr < worstTeammate.winRate) {
          worstTeammate = { id: partnerId, name: partner.name, winRate: wr }
        }
      }

      // Fallback if no teammates found
      if (bestTeammate.id === '')
        bestTeammate = { id: '', name: '—', winRate: 0.5 }
      if (worstTeammate.id === '')
        worstTeammate = { id: '', name: '—', winRate: 0.5 }

      return {
        id: c.id,
        name: c.name,
        role: c.role,
        rarity: c.rarity,
        teamWinRate,
        teamWins: teamAgg?.wins ?? 0,
        teamTotal: teamAgg?.total ?? 0,
        soloWinRate,
        teamDelta: teamWinRate - soloWinRate,
        bestTeammate,
        worstTeammate,
      }
    })
    .sort((a, b) => b.teamWinRate - a.teamWinRate)

  // Scorecard computed from team win rates
  const scorecard = computeScorecard(creatureTeamStats)

  return {
    result: {
      creatureStats,
      roleMatchupMatrix,
      abilityImpact,
      synergyImpact,
      creatureTeamStats,
      compWinRates,
      formationWinRates,
      scorecard,
      teamAbilityImpact,
      teamRoleMatchup,
    },
  }
}
