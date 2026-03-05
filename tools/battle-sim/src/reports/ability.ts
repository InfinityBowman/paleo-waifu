import { simulateBattle } from '@paleo-waifu/shared/battle/engine'
import { ALL_ABILITY_TEMPLATES } from '@paleo-waifu/shared/battle/constants'
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

// Build a lookup for ability names
const ABILITY_NAME_MAP = new Map<string, string>()
const ABILITY_TYPE_MAP = new Map<string, string>()
for (const t of ALL_ABILITY_TEMPLATES) {
  ABILITY_NAME_MAP.set(t.id, t.name)
  ABILITY_TYPE_MAP.set(
    t.id,
    t.trigger.type === 'onUse' ? 'active' : 'passive',
  )
}

function getAbilityIds(
  members: [CreatureRecord, CreatureRecord, CreatureRecord],
): Set<string> {
  const ids = new Set<string>()
  for (const m of members) {
    ids.add(m.active.templateId)
    ids.add(m.passive.templateId)
  }
  return ids
}

export function runAbilityReport(
  creatures: Array<CreatureRecord>,
  options: { trials: number; csv: boolean },
): void {
  if (!options.csv) {
    printHeader('ABILITY IMPACT ANALYSIS')
    console.log(`  ${options.trials} random team matchups`)
    console.log()
  }

  const bar = options.csv ? null : createProgressBar(options.trials, 'Matchups')

  // Track per-ability stats
  const abilityStats = new Map<
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

      const abilitiesA = getAbilityIds(membersA)
      const abilitiesB = getAbilityIds(membersB)

      const aWon = result.winner === 'A'
      const bWon = result.winner === 'B'

      const recordAbilities = (abilities: Set<string>, won: boolean) => {
        for (const id of abilities) {
          if (!abilityStats.has(id)) {
            abilityStats.set(id, { wins: 0, appearances: 0 })
          }
          const s = abilityStats.get(id)!
          s.appearances++
          if (won) s.wins++
        }
      }

      recordAbilities(abilitiesA, aWon)
      recordAbilities(abilitiesB, bWon)
    } catch {
      // Skip failed battles
    }

    bar?.increment()
  }

  bar?.stop()

  // Split into active and passive
  const activeAbilities = [...abilityStats.entries()]
    .filter(
      ([id, s]) =>
        s.appearances >= 50 && ABILITY_TYPE_MAP.get(id) === 'active',
    )
    .sort(
      (a, b) =>
        b[1].wins / b[1].appearances - a[1].wins / a[1].appearances,
    )

  const passiveAbilities = [...abilityStats.entries()]
    .filter(
      ([id, s]) =>
        s.appearances >= 50 && ABILITY_TYPE_MAP.get(id) === 'passive',
    )
    .sort(
      (a, b) =>
        b[1].wins / b[1].appearances - a[1].wins / a[1].appearances,
    )

  if (options.csv) {
    writeCsvHeader(['type', 'id', 'name', 'win_rate', 'appearances'])
    for (const [id, s] of activeAbilities) {
      writeCsvRow([
        'active',
        id,
        ABILITY_NAME_MAP.get(id) ?? id,
        ((s.wins / s.appearances) * 100).toFixed(2),
        s.appearances,
      ])
    }
    for (const [id, s] of passiveAbilities) {
      writeCsvRow([
        'passive',
        id,
        ABILITY_NAME_MAP.get(id) ?? id,
        ((s.wins / s.appearances) * 100).toFixed(2),
        s.appearances,
      ])
    }
    return
  }

  // Print active ability rankings
  printSubheader('ACTIVE ABILITIES (ranked by win rate)')
  printRankedList(
    [
      { header: 'Ability' },
      { header: 'Win Rate' },
      { header: 'Appearances' },
    ],
    activeAbilities.map(([id, s]) => {
      const rate = s.wins / s.appearances
      return [
        ABILITY_NAME_MAP.get(id) ?? id,
        winRateColor(rate),
        String(s.appearances),
      ]
    }),
  )

  // Print passive ability rankings
  printSubheader('PASSIVE ABILITIES (ranked by win rate)')
  printRankedList(
    [
      { header: 'Passive' },
      { header: 'Win Rate' },
      { header: 'Appearances' },
    ],
    passiveAbilities.map(([id, s]) => {
      const rate = s.wins / s.appearances
      return [
        ABILITY_NAME_MAP.get(id) ?? id,
        winRateColor(rate),
        String(s.appearances),
      ]
    }),
  )
}
