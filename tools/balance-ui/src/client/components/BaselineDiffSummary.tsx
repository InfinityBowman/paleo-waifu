import { cn } from '../lib/utils'
import type {
  ConstantsOverride,
  CreatureOverridePatch,
  SimRequest,
} from '../../shared/types.ts'
import type { AbilityTemplate } from '@paleo-waifu/shared/battle/types'

interface Props {
  constants: ConstantsOverride
  creaturePatches: Array<CreatureOverridePatch>
  options: SimRequest['options']
  /** Ability templates for name resolution */
  activeTemplates?: Array<AbilityTemplate>
  passiveTemplates?: Array<AbilityTemplate>
  /** Compact mode for history panel (fewer details) */
  compact?: boolean
  className?: string
}

export function BaselineDiffSummary({
  constants,
  creaturePatches,
  options,
  activeTemplates = [],
  passiveTemplates = [],
  compact = false,
  className,
}: Props) {
  const lines = buildDiffLines(constants, creaturePatches, options, [
    ...activeTemplates,
    ...passiveTemplates,
  ])

  if (lines.length === 0) {
    if (compact) return null
    return (
      <div className={cn('text-[11px] text-muted-foreground/60 italic', className)}>
        Baseline (no changes)
      </div>
    )
  }

  if (compact) {
    return (
      <div className={cn('flex flex-wrap gap-x-2 gap-y-0.5', className)}>
        {lines.map((line, i) => (
          <span key={i} className="text-[10px] text-muted-foreground">
            {line.text}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {lines.map((line, i) => (
        <div
          key={i}
          className={cn(
            'text-xs',
            line.type === 'buff' && 'text-success',
            line.type === 'nerf' && 'text-destructive',
            line.type === 'neutral' && 'text-muted-foreground',
            line.type === 'flag' && 'text-primary',
          )}
        >
          {line.text}
        </div>
      ))}
    </div>
  )
}

// ─── Line builder ───────────────────────────────────────────

interface DiffLine {
  text: string
  type: 'buff' | 'nerf' | 'neutral' | 'flag'
}

function buildDiffLines(
  constants: ConstantsOverride,
  creaturePatches: Array<CreatureOverridePatch>,
  options: SimRequest['options'],
  templates: Array<AbilityTemplate>,
): Array<DiffLine> {
  const lines: Array<DiffLine> = []
  const templateNameMap = new Map(templates.map((t) => [t.id, t]))

  // Isolation flags
  if (options.normalizeStats) {
    lines.push({ text: 'Normalize stats ON', type: 'flag' })
  }
  if (options.noActives) {
    lines.push({ text: 'No actives ON', type: 'flag' })
  }
  if (options.noPassives) {
    lines.push({ text: 'No passives ON', type: 'flag' })
  }

  // Combat damage scale
  if (constants.combatDamageScale !== undefined) {
    lines.push({
      text: `Damage scale: ${constants.combatDamageScale}`,
      type: constants.combatDamageScale > 0.6 ? 'buff' : 'nerf',
    })
  }

  // Role modifiers
  if (constants.roleModifiers) {
    for (const [role, mods] of Object.entries(constants.roleModifiers)) {
      const parts = Object.entries(mods)
        .filter(([, v]) => v !== undefined && v !== 0)
        .map(([stat, v]) => `${stat.toUpperCase()} ${v! > 0 ? '+' : ''}${Math.round(v! * 100)}%`)

      if (parts.length > 0) {
        const isPositive = Object.values(mods).every((v) => v === undefined || v >= 0)
        const isNegative = Object.values(mods).every((v) => v === undefined || v <= 0)
        lines.push({
          text: `${capitalize(role)}: ${parts.join(', ')}`,
          type: isPositive ? 'buff' : isNegative ? 'nerf' : 'neutral',
        })
      }
    }
  }

  // Rarity modifiers
  if (constants.rarityModifiers) {
    for (const [rarity, v] of Object.entries(constants.rarityModifiers)) {
      if (v === 0) continue
      lines.push({
        text: `${capitalize(rarity)} rarity: ${v > 0 ? '+' : ''}${Math.round(v * 100)}% all stats`,
        type: v > 0 ? 'buff' : 'nerf',
      })
    }
  }

  // Ability overrides
  if (constants.abilityOverrides) {
    for (const [templateId, override] of Object.entries(constants.abilityOverrides)) {
      const template = templateNameMap.get(templateId)
      const name = template?.name ?? templateId
      const parts: Array<string> = []

      if (override.cooldown !== undefined) {
        const baseCd = template?.trigger.type === 'onUse' ? template.trigger.cooldown : '?'
        parts.push(`cd ${baseCd}\u2192${override.cooldown}`)
      }

      if (override.effectOverrides) {
        for (const [idxStr, params] of Object.entries(override.effectOverrides)) {
          const idx = parseInt(idxStr, 10)
          const baseEffect = template?.effects[idx]
          for (const [key, val] of Object.entries(params)) {
            const baseVal = baseEffect ? (baseEffect as Record<string, unknown>)[key] : '?'
            parts.push(`${key} ${baseVal}\u2192${val}`)
          }
        }
      }

      if (parts.length > 0) {
        lines.push({
          text: `${name}: ${parts.join(', ')}`,
          type: 'neutral',
        })
      }
    }
  }

  // Creature patches
  const disabled = creaturePatches.filter((p) => p.disabled)
  const statOverrides = creaturePatches.filter(
    (p) =>
      !p.disabled &&
      (p.hp !== undefined || p.atk !== undefined || p.def !== undefined || p.spd !== undefined),
  )
  const abilitySwaps = creaturePatches.filter(
    (p) =>
      !p.disabled &&
      (p.activeTemplateId !== undefined || p.passiveTemplateId !== undefined),
  )

  if (disabled.length > 0) {
    lines.push({
      text: `${disabled.length} creature${disabled.length !== 1 ? 's' : ''} disabled`,
      type: 'nerf',
    })
  }
  if (statOverrides.length > 0) {
    lines.push({
      text: `${statOverrides.length} creature stat override${statOverrides.length !== 1 ? 's' : ''}`,
      type: 'neutral',
    })
  }
  if (abilitySwaps.length > 0) {
    lines.push({
      text: `${abilitySwaps.length} creature ability swap${abilitySwaps.length !== 1 ? 's' : ''}`,
      type: 'neutral',
    })
  }

  return lines
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
