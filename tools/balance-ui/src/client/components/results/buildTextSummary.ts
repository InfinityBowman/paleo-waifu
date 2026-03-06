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
): string {
  const lines: Array<string> = []
  const last = snapshots[snapshots.length - 1]

  lines.push('=== Balance Sim Summary ===')
  lines.push(`Generations: ${snapshots.length} | Population: ${population ?? '?'}`)
  lines.push(`Avg Turns: ${last.avgTurns.toFixed(1)} (P10: ${last.turnP10.toFixed(1)}, P90: ${last.turnP90.toFixed(1)})`)
  lines.push(`Top Fitness: ${last.topFitness.toFixed(3)} | Avg Fitness: ${last.avgFitness.toFixed(3)}`)

  if (config) {
    const templates = [
      ...(constantsSnapshot?.activeTemplates ?? []),
      ...(constantsSnapshot?.passiveTemplates ?? []),
    ]
    const diffLines = buildDiffLines(config.constants, config.creaturePatches, config.options, templates)
    if (diffLines.length > 0) {
      lines.push('')
      lines.push('--- Applied Changes ---')
      for (const dl of diffLines) lines.push(`  ${dl.text}`)
    }
  }

  lines.push('')
  lines.push('--- Role Meta Share ---')
  for (const [role, share] of entries(meta.roleMetaShare).sort(([, a], [, b]) => b - a)) {
    const wr = meta.roleWinRates?.[role]
    lines.push(`  ${role}: ${pct(share)}${wr != null ? ` (WR: ${pct(wr)})` : ''}`)
  }

  if (meta.roleContributions && Object.keys(meta.roleContributions).length > 0) {
    lines.push('')
    lines.push('--- Role Contributions (per battle avg) ---')
    for (const [role, stats] of Object.entries(meta.roleContributions)) {
      lines.push(`  ${role}: dmg=${Math.round(stats.avgDamageDealt)} taken=${Math.round(stats.avgDamageTaken)} heal=${Math.round(stats.avgHealingDone)} shield=${Math.round(stats.avgShieldsApplied)} debuffs=${stats.avgDebuffsLanded.toFixed(1)}`)
    }
  }

  lines.push('')
  lines.push('--- Formation Distribution ---')
  for (const [form, share] of entries(meta.formationMetaShare).sort(([, a], [, b]) => b - a)) {
    lines.push(`  ${form}: ${pct(share)}`)
  }

  if (meta.compMetaShare && Object.keys(meta.compMetaShare).length > 0) {
    lines.push('')
    lines.push('--- Team Compositions ---')
    for (const [comp, share] of entries(meta.compMetaShare).sort(([, a], [, b]) => b - a).slice(0, 10)) {
      const wr = meta.compWinRates?.[comp]
      lines.push(`  ${comp}: ${pct(share)}${wr != null ? ` (WR: ${pct(wr)})` : ''}`)
    }
  }

  if (Object.keys(meta.synergyMetaShare).length > 0) {
    lines.push('')
    lines.push('--- Synergy Presence ---')
    for (const [syn, share] of entries(meta.synergyMetaShare).sort(([, a], [, b]) => b - a)) {
      lines.push(`  ${syn}: ${pct(share)}`)
    }
  }

  lines.push('')
  lines.push('--- Top 15 Creatures ---')
  for (const entry of meta.creatureLeaderboard.slice(0, 15)) {
    lines.push(`  ${entry.creature.name} (${entry.creature.role}) — ${entry.appearances} appearances, fitness ${entry.avgFitness.toFixed(3)}`)
  }

  lines.push('')
  lines.push('--- Top 15 Abilities ---')
  for (const entry of meta.abilityLeaderboard.slice(0, 15)) {
    lines.push(`  ${entry.name} (${entry.abilityType}) — ${entry.appearances} appearances, fitness ${entry.avgFitness.toFixed(3)}`)
  }

  if (meta.abilityUsage && meta.abilityUsage.length > 0) {
    lines.push('')
    lines.push('--- Ability Usage (final gen battles) ---')
    for (const entry of meta.abilityUsage.slice(0, 15)) {
      lines.push(`  ${entry.name}: ${entry.uses} uses, ${Math.round(entry.totalDamage)} total dmg, ${entry.avgDamagePerUse.toFixed(1)} avg dmg/use`)
    }
  }

  lines.push('')
  lines.push('--- Hall of Fame (Top 3) ---')
  for (const ind of meta.hallOfFame.slice(0, 3)) {
    const names = ind.members.map((m) => `${m.name} (${m.role})`).join(', ')
    lines.push(`  ${ind.fitness.toFixed(3)} W${ind.wins}/L${ind.losses}/D${ind.draws} — ${names}`)
  }

  return lines.join('\n')
}
