import { runTrials, summarizeTrials } from '../runner.ts'
import {
  createProgressBar,
  printHeader,
  printRankedList,
  printSubheader,
  rarityColor,
  roleColor,
  winRateColor,
  writeCsvHeader,
  writeCsvRow,
} from '../report.ts'
import type { CreatureRecord } from '../db.ts'

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary']

export function runMatchupReport(
  creatures: Array<CreatureRecord>,
  options: { trials: number; csv: boolean },
): void {
  // Calculate total pairs
  const n = creatures.length
  const totalPairs = (n * (n - 1)) / 2

  if (!options.csv) {
    printHeader('ROUND-ROBIN MATCHUP (mono-team 3v3)')
    console.log(
      `  ${n} creatures, ${totalPairs} unique pairs, ${options.trials} trials each`,
    )
    console.log()
  }

  // Track per-creature win stats
  const stats = new Map<
    string,
    { wins: number; total: number; creature: CreatureRecord }
  >()
  for (const c of creatures) {
    stats.set(c.id, { wins: 0, total: 0, creature: c })
  }

  const bar = options.csv ? null : createProgressBar(totalPairs, 'Matchups')

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = creatures[i]
      const b = creatures[j]

      const results = runTrials([a, a, a], [b, b, b], options.trials)
      const summary = summarizeTrials(results)

      const sA = stats.get(a.id)!
      const sB = stats.get(b.id)!
      sA.wins += summary.winsA
      sA.total += results.length
      sB.wins += summary.winsB
      sB.total += results.length

      bar?.increment()
    }
  }

  bar?.stop()

  // Calculate overall win rates and sort
  const ranked = [...stats.values()]
    .filter((s) => s.total > 0)
    .map((s) => ({
      ...s,
      winRate: s.wins / s.total,
    }))
    .sort((a, b) => b.winRate - a.winRate)

  if (options.csv) {
    writeCsvHeader([
      'name',
      'rarity',
      'role',
      'type',
      'diet',
      'era',
      'hp',
      'atk',
      'def',
      'spd',
      'active',
      'passive',
      'win_rate',
      'wins',
      'losses',
      'total',
    ])
    for (const s of ranked) {
      const c = s.creature
      writeCsvRow([
        c.name,
        c.rarity,
        c.role,
        c.type,
        c.diet,
        c.era,
        c.hp,
        c.atk,
        c.def,
        c.spd,
        c.active.templateId,
        c.passive.templateId,
        (s.winRate * 100).toFixed(2),
        s.wins,
        s.total - s.wins,
        s.total,
      ])
    }
    return
  }

  // Top 10 overpowered
  printSubheader('TOP 10 (highest win rate)')
  printRankedList(
    [
      { header: 'Creature' },
      { header: 'Rarity' },
      { header: 'Role' },
      { header: 'Win Rate' },
      { header: 'W/L' },
    ],
    ranked
      .slice(0, 10)
      .map((s) => [
        s.creature.name,
        rarityColor(s.creature.rarity),
        roleColor(s.creature.role),
        winRateColor(s.winRate),
        `${s.wins}/${s.total - s.wins}`,
      ]),
  )

  // Bottom 10 underpowered
  printSubheader('BOTTOM 10 (lowest win rate)')
  printRankedList(
    [
      { header: 'Creature' },
      { header: 'Rarity' },
      { header: 'Role' },
      { header: 'Win Rate' },
      { header: 'W/L' },
    ],
    ranked
      .slice(-10)
      .reverse()
      .map((s) => [
        s.creature.name,
        rarityColor(s.creature.rarity),
        roleColor(s.creature.role),
        winRateColor(s.winRate),
        `${s.wins}/${s.total - s.wins}`,
      ]),
  )

  // Rarity tier cross-winrates
  printSubheader('RARITY TIER WIN RATES')

  // Rarity summary using per-creature win rates grouped by rarity
  const byRarity = new Map<string, Array<number>>()
  for (const s of ranked) {
    const r = s.creature.rarity
    if (!byRarity.has(r)) byRarity.set(r, [])
    byRarity.get(r)!.push(s.winRate)
  }

  const rarityRows: Array<Array<string>> = []
  for (const rarity of RARITY_ORDER) {
    const rates = byRarity.get(rarity)
    if (!rates || rates.length === 0) continue
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length
    rarityRows.push([
      rarityColor(rarity),
      String(rates.length),
      winRateColor(avg),
    ])
  }

  printRankedList(
    [{ header: 'Rarity' }, { header: 'Count' }, { header: 'Avg Win Rate' }],
    rarityRows,
  )
}
