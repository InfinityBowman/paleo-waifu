import { buildDiffLines } from '../BaselineDiffSummary'
import { entries, pct } from './constants'
import type {
  ConstantsOverride,
  ConstantsSnapshot,
  CreatureOverridePatch,
  GenerationSnapshot,
  MetaResult,
  SimRequest,
} from '../../../shared/types.ts'

function ppDiff(v: number): string {
  const pp = (v * 100).toFixed(1)
  return v > 0 ? `+${pp}pp` : `${pp}pp`
}

export function buildTextSummary(
  meta: MetaResult,
  snapshots: Array<GenerationSnapshot>,
  population?: number,
  config?: {
    options: SimRequest['options']
    constants: ConstantsOverride
    creaturePatches: Array<CreatureOverridePatch>
  } | null,
  constantsSnapshot?: ConstantsSnapshot | null,
  totalCreatures?: number,
): string {
  const lines: Array<string> = []
  const last = snapshots[snapshots.length - 1]
  const pop = population ?? 100

  lines.push('=== Balance Sim Summary ===')
  lines.push(`Generations: ${snapshots.length} | Population: ${pop}`)
  lines.push(
    `Avg Turns: ${last.avgTurns.toFixed(1)} (P10: ${last.turnP10.toFixed(1)}, P90: ${last.turnP90.toFixed(1)})`,
  )
  lines.push(
    `Top Fitness: ${last.topFitness.toFixed(3)} | Avg Fitness: ${last.avgFitness.toFixed(3)}`,
  )

  // Battle health
  const diversity = ((last.uniqueGenomes / pop) * 100).toFixed(0)
  const creaturesInMeta = Object.keys(last.creatureFrequency).length
  const breadth =
    (totalCreatures ?? 0) > 0
      ? ((creaturesInMeta / (totalCreatures ?? 1)) * 100).toFixed(0)
      : '?'
  lines.push(
    `Diversity: ${diversity}% unique genomes | Meta Breadth: ${breadth}% (${creaturesInMeta} creatures in top teams)`,
  )

  if (config) {
    const templates = [
      ...(constantsSnapshot?.activeTemplates ?? []),
      ...(constantsSnapshot?.passiveTemplates ?? []),
    ]
    const diffLines = buildDiffLines(
      config.constants,
      config.creaturePatches,
      config.options,
      templates,
    )
    if (diffLines.length > 0) {
      lines.push('')
      lines.push('--- Applied Changes ---')
      for (const dl of diffLines) lines.push(`  ${dl.text}`)
    }
  }

  // Role Meta Share + Win Rates
  lines.push('')
  lines.push('--- Role Meta Share ---')
  for (const [role, share] of entries(meta.roleMetaShare).sort(
    ([, a], [, b]) => b - a,
  )) {
    const wr = meta.roleWinRates?.[role]
    lines.push(
      `  ${role}: ${pct(share)}${wr != null ? ` (WR: ${pct(wr)})` : ''}`,
    )
  }

  // Team Compositions
  if (meta.compMetaShare && Object.keys(meta.compMetaShare).length > 0) {
    lines.push('')
    lines.push('--- Team Compositions ---')
    for (const [comp, share] of entries(meta.compMetaShare)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)) {
      const wr = meta.compWinRates?.[comp]
      lines.push(
        `  ${comp}: ${pct(share)}${wr != null ? ` (WR: ${pct(wr)})` : ''}`,
      )
    }
  }

  // Role Contributions
  if (
    meta.roleContributions &&
    Object.keys(meta.roleContributions).length > 0
  ) {
    lines.push('')
    lines.push('--- Role Contributions (per battle avg) ---')
    for (const [role, stats] of Object.entries(meta.roleContributions)) {
      lines.push(
        `  ${role}: dmg=${Math.round(stats.avgDamageDealt)} taken=${Math.round(stats.avgDamageTaken)} heal=${Math.round(stats.avgHealingDone)} shield=${Math.round(stats.avgShieldsApplied)} debuffs=${stats.avgDebuffsLanded.toFixed(1)}`,
      )
    }
  }

  // Formation + Synergy
  lines.push('')
  lines.push('--- Formation Distribution ---')
  for (const [form, share] of entries(meta.formationMetaShare).sort(
    ([, a], [, b]) => b - a,
  )) {
    lines.push(`  ${form}: ${pct(share)}`)
  }

  if (Object.keys(meta.synergyMetaShare).length > 0) {
    lines.push('')
    lines.push('--- Synergy Presence ---')
    for (const [syn, share] of entries(meta.synergyMetaShare).sort(
      ([, a], [, b]) => b - a,
    )) {
      lines.push(`  ${syn}: ${pct(share)}`)
    }
  }

  // Top Creatures
  lines.push('')
  lines.push('--- Top 15 Creatures ---')
  for (const entry of meta.creatureLeaderboard.slice(0, 15)) {
    lines.push(
      `  ${entry.creature.name} (${entry.creature.role}) — ${entry.appearances} appearances, WR diff ${ppDiff(entry.allTeamWinRate)}, fitness ${entry.avgFitness.toFixed(3)}`,
    )
  }

  // Bottom 10 by WR diff
  const worstCreatures = [...meta.creatureLeaderboard]
    .sort((a, b) => a.allTeamWinRate - b.allTeamWinRate)
    .slice(0, 10)
  if (worstCreatures.length > 0) {
    lines.push('')
    lines.push('--- Bottom 10 Creatures by WR Diff ---')
    for (const entry of worstCreatures) {
      lines.push(
        `  ${entry.creature.name} (${entry.creature.role}) — WR diff ${ppDiff(entry.allTeamWinRate)}, ${entry.appearances} appearances`,
      )
    }
  }

  // Top Abilities
  lines.push('')
  lines.push('--- Top 15 Abilities ---')
  for (const entry of meta.abilityLeaderboard
    .filter((a) => a.templateId !== 'basic_attack')
    .slice(0, 15)) {
    lines.push(
      `  ${entry.name} (${entry.abilityType}) — ${entry.appearances} appearances, WR diff ${ppDiff(entry.allTeamWinRate)}, fitness ${entry.avgFitness.toFixed(3)}`,
    )
  }

  // Bottom 10 abilities by WR diff
  const worstAbilities = [...meta.abilityLeaderboard]
    .filter((a) => a.templateId !== 'basic_attack')
    .sort((a, b) => a.allTeamWinRate - b.allTeamWinRate)
    .slice(0, 10)
  if (worstAbilities.length > 0) {
    lines.push('')
    lines.push('--- Bottom 10 Abilities by WR Diff ---')
    for (const entry of worstAbilities) {
      lines.push(
        `  ${entry.name} (${entry.abilityType}) — WR diff ${ppDiff(entry.allTeamWinRate)}, ${entry.appearances} appearances`,
      )
    }
  }

  // Ability Usage
  if (meta.abilityUsage && meta.abilityUsage.length > 0) {
    lines.push('')
    lines.push('--- Ability Usage (final gen battles) ---')
    for (const entry of meta.abilityUsage.slice(0, 15)) {
      lines.push(
        `  ${entry.name}: ${entry.uses} uses, ${Math.round(entry.totalDamage)} total dmg, ${entry.avgDamagePerUse.toFixed(1)} avg dmg/use`,
      )
    }
  }

  // Hall of Fame
  lines.push('')
  lines.push('--- Hall of Fame (Top 3) ---')
  for (const ind of meta.hallOfFame.slice(0, 3)) {
    const names = ind.members.map((m) => `${m.name} (${m.role})`).join(', ')
    lines.push(
      `  ${ind.fitness.toFixed(3)} W${ind.wins}/L${ind.losses}/D${ind.draws} — ${names}`,
    )
  }

  return lines.join('\n')
}
