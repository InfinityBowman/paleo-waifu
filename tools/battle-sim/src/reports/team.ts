import { simulateBattle } from '@paleo-waifu/shared/battle/engine'
import { buildTeam, sampleTeam } from '../runner.ts'
import {
  createProgressBar,
  printHeader,
  printRankedList,
  printSubheader,
  winRateColor,
  writeCsvHeader,
  writeCsvRow,
} from '../report.ts'
import type { CreatureRecord } from '../db.ts'

// ─── Synergy Detection (from creature metadata, not engine) ──────

interface SynergyInfo {
  hasTypeSynergy2: boolean
  hasTypeSynergy3: boolean
  hasEraSynergy2: boolean
  hasEraSynergy3: boolean
  dietCategory: 'all_carnivore' | 'all_herbivore' | 'mixed' | 'none'
  roleCombo: string // sorted role triple, e.g. "bruiser/striker/tank"
}

function detectSynergies(
  members: [CreatureRecord, CreatureRecord, CreatureRecord],
): SynergyInfo {
  const types = members.map((m) => m.type)
  const eras = members.map((m) => m.era)
  const diets = members.map((m) => {
    const d = m.diet
    return d === 'Herbivorous/omnivorous' ? 'Herbivorous' : d
  })
  const roles = members.map((m) => m.role).sort()

  // Type synergy
  const typeCounts = new Map<string, number>()
  for (const t of types) {
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1)
  }
  const maxTypeCount = Math.max(...typeCounts.values())

  // Era synergy
  const eraCounts = new Map<string, number>()
  for (const e of eras) {
    eraCounts.set(e, (eraCounts.get(e) ?? 0) + 1)
  }
  const maxEraCount = Math.max(...eraCounts.values())

  // Diet synergy
  const uniqueDiets = new Set(diets)
  let dietCategory: SynergyInfo['dietCategory'] = 'none'
  if (uniqueDiets.size === 1 && uniqueDiets.has('Carnivorous'))
    dietCategory = 'all_carnivore'
  else if (uniqueDiets.size === 1 && uniqueDiets.has('Herbivorous'))
    dietCategory = 'all_herbivore'
  else if (uniqueDiets.has('Carnivorous') && uniqueDiets.has('Herbivorous'))
    dietCategory = 'mixed'

  return {
    hasTypeSynergy2: maxTypeCount >= 2,
    hasTypeSynergy3: maxTypeCount >= 3,
    hasEraSynergy2: maxEraCount >= 2,
    hasEraSynergy3: maxEraCount >= 3,
    dietCategory,
    roleCombo: roles.join('/'),
  }
}

// ─── Report ───────────────────────────────────────────────────────

export function runTeamReport(
  creatures: Array<CreatureRecord>,
  options: { trials: number; csv: boolean },
): void {
  if (!options.csv) {
    printHeader('TEAM COMPOSITION ANALYSIS')
    console.log(`  ${options.trials} random matchups`)
    console.log()
  }

  const bar = options.csv ? null : createProgressBar(options.trials, 'Matchups')

  // Track synergy win rates
  const synergyStats = new Map<string, { wins: number; appearances: number }>()

  const addSynergyResult = (key: string, won: boolean) => {
    if (!synergyStats.has(key)) {
      synergyStats.set(key, { wins: 0, appearances: 0 })
    }
    const s = synergyStats.get(key)!
    s.appearances++
    if (won) s.wins++
  }

  // Track role combo win rates
  const roleComboStats = new Map<
    string,
    { wins: number; appearances: number }
  >()

  for (let i = 0; i < options.trials; i++) {
    const membersA = sampleTeam(creatures)
    const membersB = sampleTeam(creatures)

    const teamA = buildTeam(membersA)
    const teamB = buildTeam(membersB)

    try {
      const result = simulateBattle(teamA, teamB, { seed: i + 1 })

      const synA = detectSynergies(membersA)
      const synB = detectSynergies(membersB)

      const aWon = result.winner === 'A'
      const bWon = result.winner === 'B'

      // Record synergy stats for both teams
      const recordSynergies = (syn: SynergyInfo, won: boolean) => {
        if (syn.hasTypeSynergy3)
          addSynergyResult('Type 3x (+7% HP, +3% ATK)', won)
        else if (syn.hasTypeSynergy2) addSynergyResult('Type 2x (+5% HP)', won)
        if (syn.hasEraSynergy3) addSynergyResult('Era 3x (+3% all)', won)
        else if (syn.hasEraSynergy2) addSynergyResult('Era 2x (+3% all)', won)
        if (syn.dietCategory === 'all_carnivore')
          addSynergyResult('All Carnivore (+10% ATK, +7% SPD)', won)
        if (syn.dietCategory === 'all_herbivore')
          addSynergyResult('All Herbivore (+10% DEF, +10% HP)', won)
        if (syn.dietCategory === 'mixed')
          addSynergyResult('Mixed Diet (+12% SPD, +7% ATK)', won)
      }

      recordSynergies(synA, aWon)
      recordSynergies(synB, bWon)

      // Role combo stats
      const recordRoleCombo = (combo: string, won: boolean) => {
        if (!roleComboStats.has(combo)) {
          roleComboStats.set(combo, { wins: 0, appearances: 0 })
        }
        const s = roleComboStats.get(combo)!
        s.appearances++
        if (won) s.wins++
      }

      recordRoleCombo(synA.roleCombo, aWon)
      recordRoleCombo(synB.roleCombo, bWon)
    } catch {
      // Skip failed battles
    }

    bar?.increment()
  }

  bar?.stop()

  if (options.csv) {
    // Output two sections: synergies then role combos
    writeCsvHeader(['category', 'name', 'win_rate', 'sample_size'])
    for (const [name, s] of synergyStats) {
      if (s.appearances < 20) continue
      writeCsvRow([
        'synergy',
        name,
        ((s.wins / s.appearances) * 100).toFixed(2),
        s.appearances,
      ])
    }
    for (const [combo, s] of roleComboStats) {
      if (s.appearances < 20) continue
      writeCsvRow([
        'role_combo',
        combo,
        ((s.wins / s.appearances) * 100).toFixed(2),
        s.appearances,
      ])
    }
    return
  }

  // Print synergy impact
  printSubheader('SYNERGY WIN RATE IMPACT')
  const synergyRows = [...synergyStats.entries()]
    .filter(([, s]) => s.appearances >= 20)
    .sort((a, b) => b[1].wins / b[1].appearances - a[1].wins / a[1].appearances)
    .map(([name, s]) => {
      const rate = s.wins / s.appearances
      return [name, winRateColor(rate), String(s.appearances)]
    })

  printRankedList(
    [{ header: 'Synergy' }, { header: 'Win Rate' }, { header: 'Sample Size' }],
    synergyRows,
  )

  // Print top role compositions
  printSubheader('TOP ROLE COMPOSITIONS')
  const roleRows = [...roleComboStats.entries()]
    .filter(([, s]) => s.appearances >= 20)
    .sort((a, b) => b[1].wins / b[1].appearances - a[1].wins / a[1].appearances)
    .slice(0, 15)
    .map(([combo, s]) => {
      const rate = s.wins / s.appearances
      return [combo, winRateColor(rate), String(s.appearances)]
    })

  printRankedList(
    [
      { header: 'Role Composition' },
      { header: 'Win Rate' },
      { header: 'Sample Size' },
    ],
    roleRows,
  )

  // Print worst role compositions
  printSubheader('WORST ROLE COMPOSITIONS')
  const worstRoles = [...roleComboStats.entries()]
    .filter(([, s]) => s.appearances >= 20)
    .sort((a, b) => a[1].wins / a[1].appearances - b[1].wins / b[1].appearances)
    .slice(0, 10)
    .map(([combo, s]) => {
      const rate = s.wins / s.appearances
      return [combo, winRateColor(rate), String(s.appearances)]
    })

  printRankedList(
    [
      { header: 'Role Composition' },
      { header: 'Win Rate' },
      { header: 'Sample Size' },
    ],
    worstRoles,
  )
}
