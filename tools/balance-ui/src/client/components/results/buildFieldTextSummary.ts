import { RARITY_ORDER, ROLE_ORDER } from './constants'
import { pct } from './constants'
import type { FieldResult } from '../../../shared/types.ts'

export function buildFieldTextSummary(result: FieldResult): string {
  const lines: Array<string> = []
  const { scorecard, creatureStats, roleMatchupMatrix, abilityImpact, synergyImpact } = result

  lines.push('=== Field Sim Summary ===')
  lines.push(`Creatures: ${creatureStats.length}`)
  lines.push('')

  // Scorecard
  lines.push('--- Balance Scorecard ---')
  lines.push(`  Gini Coefficient: ${scorecard.giniCoefficient.toFixed(3)}`)
  lines.push(`  Win Rate Spread: ${pct(scorecard.winRateSpread)} (${pct(scorecard.minWinRate)} - ${pct(scorecard.maxWinRate)})`)
  lines.push(`  Within 45-55%: ${scorecard.percentWithin45to55.toFixed(0)}%`)
  lines.push(`  Within 40-60%: ${scorecard.percentWithin40to60.toFixed(0)}%`)
  lines.push(`  Role WR Variance: ${scorecard.roleWinRateVariance.toFixed(4)}`)

  // Role Matchup Matrix
  lines.push('')
  lines.push('--- Role Matchup Matrix ---')
  const roles = ROLE_ORDER
  const matrixMap = new Map(roleMatchupMatrix.map((m) => [`${m.attacker}-${m.defender}`, m]))
  lines.push(`  ${''.padEnd(10)} ${roles.map((r) => r.padEnd(10)).join(' ')}`)
  for (const attacker of roles) {
    const row = roles.map((defender) => {
      const m = matrixMap.get(`${attacker}-${defender}`)
      return m ? `${pct(m.winRate)}`.padEnd(10) : '—'.padEnd(10)
    })
    lines.push(`  ${attacker.padEnd(10)} ${row.join(' ')}`)
  }

  // Top/Bottom creatures
  const sorted = [...creatureStats].sort((a, b) => b.winRate - a.winRate)
  lines.push('')
  lines.push('--- Top 10 Creatures ---')
  for (const c of sorted.slice(0, 10)) {
    lines.push(`  ${c.name} (${c.role}) — ${pct(c.winRate)} WR (${c.wins}/${c.total})`)
  }

  if (sorted.length > 10) {
    const bottomCount = Math.min(10, sorted.length - 10)
    const bottom = sorted.slice(-bottomCount).reverse()
    lines.push('')
    lines.push(`--- Bottom ${bottomCount} Creatures ---`)
    for (const c of bottom) {
      lines.push(`  ${c.name} (${c.role}) — ${pct(c.winRate)} WR (${c.wins}/${c.total})`)
    }
  }

  // Outliers
  const outliers = sorted.filter((c) => c.winRate > 0.6 || c.winRate < 0.4)
  if (outliers.length > 0) {
    lines.push('')
    lines.push(`--- Outliers (${outliers.length}) ---`)
    for (const c of outliers) {
      const best = c.bestMatchup.opponentName || '—'
      const worst = c.worstMatchup.opponentName || '—'
      lines.push(`  ${c.name} (${c.role}) — ${pct(c.winRate)} WR | best: ${best} ${(c.bestMatchup.winRate * 100).toFixed(0)}% | worst: ${worst} ${(c.worstMatchup.winRate * 100).toFixed(0)}%`)
    }
  }

  // Ability Impact
  const sortedAbilities = [...abilityImpact].sort((a, b) => b.avgWinRate - a.avgWinRate)
  lines.push('')
  lines.push('--- Ability Impact ---')
  for (const a of sortedAbilities) {
    const delta = a.avgWinRate - 0.5
    lines.push(`  ${a.name} (${a.abilityType}) — ${pct(a.avgWinRate)} avg WR (${delta > 0 ? '+' : ''}${(delta * 100).toFixed(1)}pp) | ${a.creaturesWithAbility} creatures`)
  }

  // Synergy
  if (synergyImpact.length > 0) {
    const sortedSynergies = [...synergyImpact].sort((a, b) => b.delta - a.delta)
    lines.push('')
    lines.push('--- Synergy Value ---')
    for (const s of sortedSynergies) {
      lines.push(`  ${s.synergy}: ${pct(s.avgWinRate)} with vs ${pct(s.avgWinRateWithout)} without (${s.delta > 0 ? '+' : ''}${(s.delta * 100).toFixed(1)}pp) | ${s.sampleSize} teams`)
    }
  }

  // Rarity breakdown
  const byRarity = new Map<string, Array<number>>()
  for (const c of creatureStats) {
    const arr = byRarity.get(c.rarity) ?? []
    arr.push(c.winRate)
    byRarity.set(c.rarity, arr)
  }
  if (byRarity.size > 1) {
    lines.push('')
    lines.push('--- Rarity Tier Balance ---')
    for (const rarity of RARITY_ORDER) {
      const rates = byRarity.get(rarity)
      if (!rates) continue
      const avg = rates.reduce((s, v) => s + v, 0) / rates.length
      const rarSorted = [...rates].sort((a, b) => a - b)
      const min = rarSorted[0]
      const max = rarSorted[rarSorted.length - 1]
      lines.push(`  ${rarity}: n=${rates.length} avg=${pct(avg)} range=${pct(min)}-${pct(max)}`)
    }
  }

  return lines.join('\n')
}
