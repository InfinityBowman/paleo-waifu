import { pct } from './constants'
import type { FieldResult } from '../../../shared/types.ts'

export function buildFieldTextSummary(result: FieldResult): string {
  const lines: Array<string> = []
  const { scorecard, creatureStats, synergyImpact, compWinRates, formationWinRates, creatureTeamStats, teamAbilityImpact, teamRoleMatchup } = result

  lines.push('=== Field Sim Summary ===')
  lines.push(`Creatures: ${creatureStats.length}`)

  // Scorecard (from team win rates)
  lines.push('')
  lines.push('--- Balance Scorecard (3v3) ---')
  lines.push(`  Gini Coefficient: ${scorecard.giniCoefficient.toFixed(3)}`)
  lines.push(`  Win Rate Spread: ${pct(scorecard.winRateSpread)} (${pct(scorecard.minWinRate)} - ${pct(scorecard.maxWinRate)})`)
  lines.push(`  Within 45-55%: ${scorecard.percentWithin45to55.toFixed(0)}%`)
  lines.push(`  Within 40-60%: ${scorecard.percentWithin40to60.toFixed(0)}%`)
  lines.push(`  Role WR Variance: ${scorecard.roleWinRateVariance.toFixed(4)}`)
  lines.push(`  Strongest: ${pct(scorecard.maxWinRate)} | Weakest: ${pct(scorecard.minWinRate)}`)

  // Creature Team Performance
  if (creatureTeamStats.length > 0) {
    const teamSorted = [...creatureTeamStats].sort((a, b) => b.teamWinRate - a.teamWinRate)
    lines.push('')
    lines.push('--- Top 10 Team Performers ---')
    for (const c of teamSorted.slice(0, 10)) {
      const delta = c.teamDelta > 0 ? `+${(c.teamDelta * 100).toFixed(1)}` : (c.teamDelta * 100).toFixed(1)
      lines.push(`  ${c.name} (${c.role}) — Team: ${pct(c.teamWinRate)} | Solo: ${pct(c.soloWinRate)} | Δ: ${delta}pp`)
    }

    if (teamSorted.length > 10) {
      const bottomCount = Math.min(10, teamSorted.length - 10)
      const bottom = teamSorted.slice(-bottomCount).reverse()
      lines.push('')
      lines.push(`--- Bottom ${bottomCount} Team Performers ---`)
      for (const c of bottom) {
        const delta = c.teamDelta > 0 ? `+${(c.teamDelta * 100).toFixed(1)}` : (c.teamDelta * 100).toFixed(1)
        lines.push(`  ${c.name} (${c.role}) — Team: ${pct(c.teamWinRate)} | Solo: ${pct(c.soloWinRate)} | Δ: ${delta}pp`)
      }
    }

    // Biggest team boosted / solo reliant
    const byDelta = [...creatureTeamStats].sort((a, b) => b.teamDelta - a.teamDelta)
    const boosted = byDelta.filter((c) => c.teamDelta > 0.03)
    const reliant = byDelta.filter((c) => c.teamDelta < -0.03)
    if (boosted.length > 0 || reliant.length > 0) {
      lines.push('')
      lines.push('--- Team Effect Outliers ---')
      if (boosted.length > 0) {
        lines.push(`  Team-boosted (${boosted.length}): ${boosted.slice(0, 5).map((c) => `${c.name} (+${(c.teamDelta * 100).toFixed(1)}pp)`).join(', ')}`)
      }
      if (reliant.length > 0) {
        lines.push(`  Solo-reliant (${reliant.length}): ${reliant.slice(0, 5).map((c) => `${c.name} (${(c.teamDelta * 100).toFixed(1)}pp)`).join(', ')}`)
      }
    }
  }

  // Team Ability Impact
  if (teamAbilityImpact.length > 0) {
    const sortedAbilities = [...teamAbilityImpact].sort((a, b) => b.teamWinRate - a.teamWinRate)
    lines.push('')
    lines.push('--- Ability Impact (3v3) ---')
    for (const a of sortedAbilities) {
      const delta = a.teamWinRate - 0.5
      lines.push(`  ${a.name} (${a.abilityType}) — ${pct(a.teamWinRate)} team WR (${delta > 0 ? '+' : ''}${(delta * 100).toFixed(1)}pp) | ${a.creaturesWithAbility} creatures | ${a.sampleSize} games`)
    }
  }

  // Team Role Contribution
  if (teamRoleMatchup.length > 0) {
    const sortedRoles = [...teamRoleMatchup].sort((a, b) => b.winRate - a.winRate)
    lines.push('')
    lines.push('--- Role Contribution (3v3) ---')
    for (const r of sortedRoles) {
      const delta = r.winRate - 0.5
      lines.push(`  ${r.role}: ${pct(r.winRate)} team WR (${delta > 0 ? '+' : ''}${(delta * 100).toFixed(1)}pp) | ${r.sampleSize} games`)
    }
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
