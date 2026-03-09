import { ROLE_ORDER, pct } from './constants'
import type { FieldResult } from '../../../shared/types.ts'

export function buildFieldTextSummary(result: FieldResult): string {
  const lines: Array<string> = []
  const { scorecard, creatureStats, roleMatchupMatrix, abilityImpact, synergyImpact, compWinRates, formationWinRates } = result

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
  lines.push(`  Strongest: ${pct(scorecard.maxWinRate)} | Weakest: ${pct(scorecard.minWinRate)}`)

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

  // Composition Win Rates
  const compEntries = Object.entries(compWinRates).sort(([, a], [, b]) => b.winRate - a.winRate)
  if (compEntries.length > 0) {
    lines.push('')
    lines.push('--- Team Composition Win Rates ---')
    for (const [comp, { winRate, count }] of compEntries) {
      lines.push(`  ${comp}: ${pct(winRate)} WR (${count} teams)`)
    }
  }

  // Formation Win Rates
  const formEntries = Object.entries(formationWinRates).sort(([, a], [, b]) => b.winRate - a.winRate)
  if (formEntries.length > 0) {
    lines.push('')
    lines.push('--- Formation Win Rates ---')
    for (const [formation, { winRate, count }] of formEntries) {
      lines.push(`  ${formation}: ${pct(winRate)} WR (${count} teams)`)
    }
  }

  return lines.join('\n')
}
