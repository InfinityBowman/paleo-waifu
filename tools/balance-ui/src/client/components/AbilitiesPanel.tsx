import { useState } from 'react'
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import { cn } from '../lib/utils'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import type {
  AbilityOverride,
  ConstantsOverride,
  ConstantsSnapshot,
} from '../../shared/types.ts'
import type { AbilityTemplate, Effect } from '@paleo-waifu/shared/battle/types'

interface Props {
  constants: ConstantsSnapshot
  overrides: ConstantsOverride
  onChange: (overrides: ConstantsOverride) => void
}

// ─── Tunable parameter definitions per effect type ──────────────

const TUNABLE_PARAMS: Record<string, Array<{ key: string; label: string; step: number; min: number; max: number }>> = {
  damage: [{ key: 'multiplier', label: 'Multiplier', step: 0.1, min: 0.1, max: 5 }],
  heal: [{ key: 'percent', label: 'Heal %', step: 1, min: 1, max: 100 }],
  dot: [
    { key: 'percent', label: 'Tick %', step: 1, min: 1, max: 50 },
    { key: 'duration', label: 'Duration', step: 1, min: 1, max: 10 },
  ],
  buff: [
    { key: 'percent', label: 'Buff %', step: 1, min: 1, max: 200 },
    { key: 'duration', label: 'Duration', step: 1, min: 1, max: 10 },
  ],
  debuff: [
    { key: 'percent', label: 'Debuff %', step: 1, min: 1, max: 200 },
    { key: 'duration', label: 'Duration', step: 1, min: 1, max: 10 },
  ],
  shield: [
    { key: 'percent', label: 'Shield %', step: 1, min: 1, max: 100 },
    { key: 'duration', label: 'Duration', step: 1, min: 1, max: 10 },
  ],
  stun: [{ key: 'duration', label: 'Duration', step: 1, min: 1, max: 5 }],
  taunt: [{ key: 'duration', label: 'Duration', step: 1, min: 1, max: 5 }],
  lifesteal: [{ key: 'percent', label: 'Lifesteal %', step: 1, min: 1, max: 100 }],
  reflect: [
    { key: 'percent', label: 'Reflect %', step: 1, min: 1, max: 100 },
    { key: 'duration', label: 'Duration', step: 1, min: 1, max: 10 },
  ],
  damage_reduction: [{ key: 'percent', label: 'DR %', step: 1, min: 1, max: 100 }],
  crit_reduction: [{ key: 'percent', label: 'Crit DR %', step: 1, min: 1, max: 100 }],
  flat_reduction: [{ key: 'scalingPercent', label: 'DEF Scale %', step: 1, min: 1, max: 100 }],
  dodge: [{ key: 'basePercent', label: 'Dodge %', step: 1, min: 1, max: 100 }],
}

function getEffectValue(effect: Effect, key: string): number {
  return (effect as Record<string, unknown>)[key] as number ?? 0
}

function effectSummary(effect: Effect): string {
  switch (effect.type) {
    case 'damage': return `${effect.multiplier}x ${effect.scaling} dmg`
    case 'heal': return `${effect.percent}% heal`
    case 'dot': return `${effect.percent}%/t ${effect.dotKind} (${effect.duration}t)`
    case 'buff': return `+${effect.percent}% ${effect.stat} (${effect.duration}t)`
    case 'debuff': return `-${effect.percent}% ${effect.stat} (${effect.duration}t)`
    case 'shield': return `${effect.percent}% shield (${effect.duration}t)`
    case 'stun': return `stun ${effect.duration}t`
    case 'taunt': return `taunt ${effect.duration}t`
    case 'lifesteal': return `${effect.percent}% lifesteal`
    case 'reflect': return `${effect.percent}% reflect (${effect.duration}t)`
    case 'damage_reduction': return `${effect.percent}% DR`
    case 'crit_reduction': return `${effect.percent}% crit DR`
    case 'flat_reduction': return `${effect.scalingPercent}% DEF flat DR`
    case 'dodge': return `${effect.basePercent}% dodge`
    default: return (effect as { type: string }).type
  }
}

// ─── Component ──────────────────────────────────────────────────

export function AbilitiesPanel({ constants, overrides, onChange }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | 'active' | 'passive' | 'modified'>('all')

  const abilityOverrides = overrides.abilityOverrides ?? {}
  const modifiedCount = Object.keys(abilityOverrides).length

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function setOverride(templateId: string, override: AbilityOverride) {
    const updated = { ...abilityOverrides, [templateId]: override }
    // Remove empty overrides
    if (
      override.cooldown === undefined &&
      (!override.effectOverrides || Object.keys(override.effectOverrides).length === 0)
    ) {
      delete updated[templateId]
    }
    onChange({ ...overrides, abilityOverrides: updated })
  }

  function resetAbility(templateId: string) {
    const updated = { ...abilityOverrides }
    delete updated[templateId]
    onChange({ ...overrides, abilityOverrides: updated })
  }

  function resetAll() {
    onChange({ ...overrides, abilityOverrides: undefined })
  }

  const allTemplates = [
    ...constants.activeTemplates.map((t) => ({ ...t, abilityType: 'active' as const })),
    ...constants.passiveTemplates.map((t) => ({ ...t, abilityType: 'passive' as const })),
  ]

  const filtered = allTemplates.filter((t) => {
    if (t.id === 'none') return false
    if (filter === 'active') return t.abilityType === 'active'
    if (filter === 'passive') return t.abilityType === 'passive'
    if (filter === 'modified') return !!abilityOverrides[t.id]
    return true
  })

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Ability Templates</h2>
          {modifiedCount > 0 && (
            <Badge variant="default" className="text-[10px]">
              {modifiedCount} modified
            </Badge>
          )}
        </div>
        {modifiedCount > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetAll}>
            <RotateCcw size={12} />
            Reset All
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1">
        {(['all', 'active', 'passive', 'modified'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs capitalize transition-colors',
              filter === f
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {f}
            {f === 'modified' && modifiedCount > 0 && (
              <span className="ml-1 text-[10px]">({modifiedCount})</span>
            )}
          </button>
        ))}
      </div>

      {/* Template list */}
      <div className="flex flex-col gap-1">
        {filtered.map((template) => (
          <AbilityRow
            key={template.id}
            template={template}
            abilityType={template.abilityType}
            override={abilityOverrides[template.id]}
            expanded={expandedIds.has(template.id)}
            onToggle={() => toggleExpand(template.id)}
            onOverride={(o) => setOverride(template.id, o)}
            onReset={() => resetAbility(template.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Ability Row ────────────────────────────────────────────────

function AbilityRow({
  template,
  abilityType,
  override,
  expanded,
  onToggle,
  onOverride,
  onReset,
}: {
  template: AbilityTemplate
  abilityType: 'active' | 'passive'
  override?: AbilityOverride
  expanded: boolean
  onToggle: () => void
  onOverride: (o: AbilityOverride) => void
  onReset: () => void
}) {
  const isModified = !!override
  const cooldown = template.trigger.type === 'onUse' ? template.trigger.cooldown : null
  const effectiveCooldown = override?.cooldown ?? cooldown

  return (
    <div
      className={cn(
        'rounded-lg border transition-colors',
        isModified ? 'border-primary/30 bg-primary/5' : 'border-border bg-card',
      )}
    >
      {/* Header row */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {expanded ? <ChevronDown size={12} className="shrink-0 text-muted-foreground" /> : <ChevronRight size={12} className="shrink-0 text-muted-foreground" />}

        <span className={cn('text-xs font-medium', isModified && 'text-primary')}>
          {template.name}
        </span>

        <Badge variant="outline" className="text-[9px] px-1.5 py-0">
          {abilityType}
        </Badge>

        {cooldown !== null && (
          <span className={cn(
            'text-[10px] font-mono',
            override?.cooldown !== undefined ? 'text-primary' : 'text-muted-foreground',
          )}>
            cd:{effectiveCooldown}
          </span>
        )}

        <span className="ml-auto text-[10px] text-muted-foreground/80 truncate max-w-[200px]">
          {template.effects.map(effectSummary).join(' + ')}
        </span>

        {/* Role affinity dots */}
        <div className="flex gap-0.5 shrink-0">
          {template.roleAffinity.map((role) => (
            <span
              key={role}
              className={cn('h-1.5 w-1.5 rounded-full', `bg-role-${role}`)}
              title={role}
            />
          ))}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border/50 px-3 py-2.5">
          <p className="mb-3 text-[11px] text-muted-foreground/90">{template.description}</p>

          <div className="flex flex-col gap-3">
            {/* Cooldown (actives only) */}
            {cooldown !== null && (
              <div className="flex items-center gap-2">
                <label className="w-20 text-[11px] text-muted-foreground">Cooldown</label>
                <Input
                  type="number"
                  step={1}
                  min={0}
                  max={10}
                  value={effectiveCooldown ?? 0}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    if (isNaN(val)) return
                    const next = { ...override, cooldown: val === cooldown ? undefined : val }
                    if (next.cooldown === undefined) delete next.cooldown
                    onOverride(next)
                  }}
                  className={cn(
                    'w-16 text-center text-xs px-2',
                    override?.cooldown !== undefined && 'border-primary/50 text-primary',
                  )}
                />
                <span className="text-[10px] text-muted-foreground/75">
                  base: {cooldown}
                </span>
              </div>
            )}

            {/* Effects */}
            {template.effects.map((effect, effectIdx) => {
              const params = TUNABLE_PARAMS[effect.type]
              if (!params || params.length === 0) return null

              return (
                <div key={effectIdx} className="flex flex-col gap-1.5">
                  <div className="text-[10px] font-medium uppercase text-muted-foreground/80">
                    Effect {effectIdx + 1}: {effect.type}
                    {'stat' in effect && ` (${(effect as { stat: string }).stat})`}
                    {'dotKind' in effect && ` (${(effect as { dotKind: string }).dotKind})`}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {params.map((param) => {
                      const baseVal = getEffectValue(effect, param.key)
                      const overrideVal = override?.effectOverrides?.[effectIdx]?.[param.key]
                      const currentVal = overrideVal ?? baseVal

                      return (
                        <div key={param.key} className="flex items-center gap-1.5">
                          <label className="text-[10px] text-muted-foreground w-16">
                            {param.label}
                          </label>
                          <Input
                            type="number"
                            step={param.step}
                            min={param.min}
                            max={param.max}
                            value={currentVal}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value)
                              if (isNaN(val)) return

                              const existingEffects = { ...override?.effectOverrides }
                              const existingParams = { ...existingEffects[effectIdx] }

                              if (val === baseVal) {
                                delete existingParams[param.key]
                              } else {
                                existingParams[param.key] = val
                              }

                              if (Object.keys(existingParams).length === 0) {
                                delete existingEffects[effectIdx]
                              } else {
                                existingEffects[effectIdx] = existingParams
                              }

                              const next: AbilityOverride = {
                                ...override,
                                effectOverrides: Object.keys(existingEffects).length > 0
                                  ? existingEffects
                                  : undefined,
                              }
                              if (!next.effectOverrides) delete next.effectOverrides
                              onOverride(next)
                            }}
                            className={cn(
                              'w-16 text-center text-xs px-2',
                              overrideVal !== undefined && 'border-primary/50 text-primary',
                            )}
                          />
                          <span className="text-[10px] font-mono text-muted-foreground/70">
                            {baseVal}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {isModified && (
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={onReset}>
                <RotateCcw size={10} />
                Reset
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
