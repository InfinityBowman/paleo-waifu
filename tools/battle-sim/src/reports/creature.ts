import type { CreatureRecord } from '../db.ts'
import { runTrials, summarizeTrials } from '../runner.ts'
import {
  printHeader,
  printSubheader,
  printStatBlock,
  printRankedList,
  createProgressBar,
  winRateColor,
  rarityColor,
  roleColor,
  writeCsvHeader,
  writeCsvRow,
} from '../report.ts'

export function runCreatureReport(
  creatures: CreatureRecord[],
  options: { name: string; trials: number; csv: boolean },
): void {
  // Find creature by partial case-insensitive match
  const query = options.name.toLowerCase()
  const matches = creatures.filter((c) =>
    c.name.toLowerCase().includes(query),
  )

  if (matches.length === 0) {
    console.error(`No creature found matching "${options.name}"`)
    console.error('Available creatures (sample):')
    for (const c of creatures.slice(0, 10)) {
      console.error(`  - ${c.name}`)
    }
    process.exit(1)
  }

  if (matches.length > 1) {
    // Check for exact match first
    const exact = matches.find(
      (c) => c.name.toLowerCase() === query,
    )
    if (!exact) {
      console.error(`Ambiguous match for "${options.name}":`)
      for (const c of matches.slice(0, 10)) {
        console.error(`  - ${c.name} (${c.rarity} ${c.role})`)
      }
      process.exit(1)
    }
    matches.length = 0
    matches.push(exact)
  }

  const target = matches[0]!

  // Run vs all other creatures
  const opponents = creatures.filter((c) => c.id !== target.id)
  const bar = options.csv ? null : createProgressBar(opponents.length, 'Matchups')

  if (!options.csv) {
    printHeader(`${target.name.toUpperCase()} — Deep Dive`)
    printStatBlock({
      Role: target.role,
      Rarity: target.rarity,
      Type: target.type,
      Diet: target.diet,
      Era: target.era,
      HP: target.hp,
      ATK: target.atk,
      DEF: target.def,
      SPD: target.spd,
      ABL: target.abl,
      'Total Stats': target.hp + target.atk + target.def + target.spd + target.abl,
      Active1: `${target.active1.displayName} (${target.active1.templateId})`,
      Active2: `${target.active2.displayName} (${target.active2.templateId})`,
      Passive: `${target.passive.displayName} (${target.passive.templateId})`,
    })
  }

  const matchups: Array<{
    opponent: CreatureRecord
    winRate: number
    wins: number
    total: number
    avgTurns: number
  }> = []

  for (const opp of opponents) {
    const results = runTrials(
      [target, target, target],
      [opp, opp, opp],
      options.trials,
    )
    const summary = summarizeTrials(results)
    matchups.push({
      opponent: opp,
      winRate: summary.winRateA,
      wins: summary.winsA,
      total: results.length,
      avgTurns: summary.avgTurns,
    })
    bar?.increment()
  }

  bar?.stop()

  // Sort by win rate
  matchups.sort((a, b) => b.winRate - a.winRate)

  if (options.csv) {
    writeCsvHeader([
      'opponent',
      'rarity',
      'role',
      'type',
      'diet',
      'win_rate',
      'wins',
      'losses',
      'avg_turns',
    ])
    for (const m of matchups) {
      writeCsvRow([
        m.opponent.name,
        m.opponent.rarity,
        m.opponent.role,
        m.opponent.type,
        m.opponent.diet,
        (m.winRate * 100).toFixed(2),
        m.wins,
        m.total - m.wins,
        m.avgTurns.toFixed(1),
      ])
    }
    return
  }

  // Overall stats
  const totalWins = matchups.reduce((s, m) => s + m.wins, 0)
  const totalGames = matchups.reduce((s, m) => s + m.total, 0)
  const overallWinRate = totalGames > 0 ? totalWins / totalGames : 0

  printSubheader(
    `Overall: ${winRateColor(overallWinRate)} win rate (${totalWins}/${totalGames})`,
  )

  // Win rates by opponent role
  const roleWins = new Map<string, { wins: number; total: number }>()
  for (const m of matchups) {
    const role = m.opponent.role
    if (!roleWins.has(role)) roleWins.set(role, { wins: 0, total: 0 })
    const s = roleWins.get(role)!
    s.wins += m.wins
    s.total += m.total
  }

  console.log('  Win rate by opponent role:')
  for (const [role, s] of roleWins) {
    const rate = s.total > 0 ? s.wins / s.total : 0
    console.log(`    vs ${roleColor(role)}: ${winRateColor(rate)}`)
  }
  console.log()

  // Best matchups (top 10)
  printSubheader('BEST MATCHUPS')
  printRankedList(
    [
      { header: 'Opponent' },
      { header: 'Rarity' },
      { header: 'Role' },
      { header: 'Win Rate' },
      { header: 'Avg Turns' },
    ],
    matchups.slice(0, 10).map((m) => [
      m.opponent.name,
      rarityColor(m.opponent.rarity),
      roleColor(m.opponent.role),
      winRateColor(m.winRate),
      m.avgTurns.toFixed(1),
    ]),
  )

  // Worst matchups (bottom 10)
  printSubheader('WORST MATCHUPS')
  printRankedList(
    [
      { header: 'Opponent' },
      { header: 'Rarity' },
      { header: 'Role' },
      { header: 'Win Rate' },
      { header: 'Avg Turns' },
    ],
    matchups
      .slice(-10)
      .reverse()
      .map((m) => [
        m.opponent.name,
        rarityColor(m.opponent.rarity),
        roleColor(m.opponent.role),
        winRateColor(m.winRate),
        m.avgTurns.toFixed(1),
      ]),
  )
}
