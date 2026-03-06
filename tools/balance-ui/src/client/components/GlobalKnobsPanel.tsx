import { useMemo, useState } from 'react'
import { BarChart3, ChevronDown, ChevronRight, Info } from 'lucide-react'
import { cn } from '../lib/utils'
import { NumericInput } from './ui/numeric-input'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import type {
  ConstantsOverride,
  ConstantsSnapshot,
  CreatureRecord,
  StatKey,
} from '../../shared/types.ts'

const STAT_KEYS: Array<StatKey> = ['hp', 'atk', 'def', 'spd']

const STAT_COLORS: Record<StatKey, string> = {
  hp: 'oklch(0.65 0.17 145)',
  atk: 'oklch(0.65 0.2 25)',
  def: 'oklch(0.65 0.15 245)',
  spd: 'oklch(0.75 0.15 75)',
}

interface Props {
  constants: ConstantsSnapshot
  creatures: Array<CreatureRecord>
  overrides: ConstantsOverride
  onChange: (overrides: ConstantsOverride) => void
  normalizeStats?: boolean
}

const TARGET_TOTAL = 170

export function GlobalKnobsPanel({
  constants,
  creatures,
  overrides,
  onChange,
  normalizeStats = false,
}: Props) {
  const [expanded, setExpanded] = useState({
    roles: true,
    rarity: false,
    combat: true,
  })

  function toggle(key: keyof typeof expanded) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function setRoleStatMod(role: string, stat: StatKey, pct: number) {
    const existing = overrides.roleModifiers?.[role] ?? {}
    const updated = { ...existing, [stat]: pct }
    // Remove zeroed-out entries
    if (pct === 0) delete updated[stat]
    const allRoleMods = { ...overrides.roleModifiers, [role]: updated }
    // Remove empty role entries
    if (Object.keys(updated).length === 0) delete allRoleMods[role]
    onChange({ ...overrides, roleModifiers: allRoleMods })
  }

  function setRarityMod(rarity: string, pct: number) {
    const updated = { ...overrides.rarityModifiers, [rarity]: pct }
    if (pct === 0) delete updated[rarity]
    onChange({ ...overrides, rarityModifiers: updated })
  }

  function setCombatScale(value: number) {
    onChange({ ...overrides, combatDamageScale: value })
  }

  function setDefScaling(value: number) {
    onChange({ ...overrides, defScalingConstant: value })
  }

  function setBasicAttackMultiplier(value: number) {
    onChange({ ...overrides, basicAttackMultiplier: value })
  }

  const getRoleStatMod = (role: string, stat: StatKey) =>
    overrides.roleModifiers?.[role]?.[stat] ?? 0
  const getRarityMod = (rarity: string) =>
    overrides.rarityModifiers?.[rarity] ?? 0
  const effectiveScale =
    overrides.combatDamageScale ?? constants.combatDamageScale
  const effectiveDefScaling =
    overrides.defScalingConstant ?? constants.defScalingConstant

  // Compute actual stat distributions per role from creature data
  const roleStats = useMemo(() => {
    const byRole: Record<string, Array<CreatureRecord>> = {}
    for (const c of creatures) {
      ;(byRole[c.role] ??= []).push(c)
    }
    const result: Record<
      string,
      Record<StatKey, { min: number; avg: number; max: number }>
    > = {}
    for (const [role, group] of Object.entries(byRole)) {
      const stats = {} as Record<
        StatKey,
        { min: number; avg: number; max: number }
      >
      for (const stat of STAT_KEYS) {
        const vals = group.map((c) => {
          if (!normalizeStats) return c[stat]
          const total = c.hp + c.atk + c.def + c.spd
          return total > 0 ? Math.round(c[stat] * (TARGET_TOTAL / total)) : c[stat]
        })
        stats[stat] = {
          min: Math.min(...vals),
          avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
          max: Math.max(...vals),
        }
      }
      result[role] = stats
    }
    return result
  }, [creatures, normalizeStats])

  return (
    <div className="flex flex-col text-xs">
      {/* Role Stat Adjustments */}
      <Section
        title="Role Adjustments"
        tooltip="Percentage adjustments to each stat for all creatures of a role. +10 means +10% on top of each creature's unique base stat."
        expanded={expanded.roles}
        onToggle={() => toggle('roles')}
      >
        <div className="flex flex-col gap-3 px-3 pb-3">
          {Object.entries(constants.roleDistributions).map(([role, dist]) => {
            if (!dist) return null

            return (
              <div key={role}>
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      'capitalize font-medium',
                      `text-role-${role}`,
                    )}
                  >
                    {role}
                  </span>
                  {role in roleStats && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-muted-foreground/90 hover:text-muted-foreground transition-colors">
                          <BarChart3 size={12} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent side="right" className="w-56 p-3">
                        <p className="mb-2 text-[11px] font-medium capitalize text-foreground">
                          {role} stat ranges
                          <span className="ml-1 font-normal text-muted-foreground">
                            ({creatures.filter((c) => c.role === role).length}{' '}
                            creatures)
                          </span>
                        </p>
                        <div className="flex flex-col gap-2">
                          {STAT_KEYS.map((stat) => {
                            const s = roleStats[role][stat]
                            // Global max across all roles for consistent scale
                            const globalMax = Math.max(
                              ...Object.values(roleStats).map(
                                (r) => r[stat].max,
                              ),
                            )
                            return (
                              <div key={stat}>
                                <div className="mb-0.5 flex items-center justify-between text-[10px]">
                                  <span className="uppercase text-muted-foreground">
                                    {stat}
                                  </span>
                                  <span className="font-mono text-muted-foreground">
                                    {s.min}–{s.max}{' '}
                                    <span className="text-foreground">
                                      avg {s.avg}
                                    </span>
                                  </span>
                                </div>
                                <div className="relative h-2 w-full rounded-full bg-muted">
                                  {/* Range bar */}
                                  <div
                                    className="absolute top-0 h-full rounded-full opacity-60"
                                    style={{
                                      left: `${(s.min / globalMax) * 100}%`,
                                      width: `${((s.max - s.min) / globalMax) * 100}%`,
                                      backgroundColor: STAT_COLORS[stat],
                                    }}
                                  />
                                  {/* Avg marker */}
                                  <div
                                    className="absolute top-0 h-full w-1 rounded-full"
                                    style={{
                                      left: `${(s.avg / globalMax) * 100}%`,
                                      backgroundColor: STAT_COLORS[stat],
                                    }}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {STAT_KEYS.map((stat) => {
                    const mod = getRoleStatMod(role, stat)
                    const displayVal = Math.round(mod * 100)
                    return (
                      <div key={stat} className="flex flex-col items-center">
                        <label className="mb-0.5 text-[10px] uppercase text-muted-foreground">
                          {stat}%
                        </label>
                        <NumericInput
                          step={1}
                          min={-50}
                          max={100}
                          value={displayVal}
                          onChange={(pct) => setRoleStatMod(role, stat, pct / 100)}
                          className={cn(
                            'w-16 text-center text-xs h-7 px-2',
                            mod !== 0 && 'border-primary/50 text-primary',
                          )}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      {/* Combat Scale */}
      <Section
        title="Combat Scale"
        tooltip="Global multiplier applied to all damage calculations. Lower = tankier battles, higher = burstier."
        expanded={expanded.combat}
        onToggle={() => toggle('combat')}
      >
        <div className="flex items-center gap-2 px-3 pb-3">
          <label className="w-24 text-muted-foreground">Damage Scale</label>
          <NumericInput
            float
            step={0.1}
            min={0.1}
            max={2}
            value={effectiveScale}
            onChange={setCombatScale}
            className={cn(
              'w-20 text-center text-xs px-2',
              overrides.combatDamageScale !== undefined &&
                'border-primary/50 text-primary',
            )}
          />
        </div>
        <div className="flex items-center gap-2 px-3 pb-3">
          <label className="w-24 text-muted-foreground">DEF Scaling</label>
          <NumericInput
            step={10}
            min={10}
            max={200}
            value={effectiveDefScaling}
            onChange={setDefScaling}
            className={cn(
              'w-20 text-center text-xs px-2',
              overrides.defScalingConstant !== undefined &&
                'border-primary/50 text-primary',
            )}
          />
          <span className="text-[9px] text-muted-foreground/60">lower = DEF stronger</span>
        </div>
        <div className="flex items-center gap-2 px-3 pb-3">
          <label className="w-24 text-muted-foreground">Basic ATK</label>
          <NumericInput
            float
            step={0.05}
            min={0.1}
            max={3}
            value={overrides.basicAttackMultiplier ?? 0.9}
            onChange={setBasicAttackMultiplier}
            className={cn(
              'w-20 text-center text-xs px-2',
              overrides.basicAttackMultiplier !== undefined &&
                'border-primary/50 text-primary',
            )}
          />
          <span className="text-[9px] text-muted-foreground/60">default 0.9</span>
        </div>
      </Section>

      {/* Rarity Scaling */}
      <Section
        title="Rarity Scaling"
        tooltip="Uniform % adjustment to all stats for creatures of a rarity tier. +10 means +10% to HP, ATK, DEF, and SPD."
        expanded={expanded.rarity}
        onToggle={() => toggle('rarity')}
      >
        <div className="flex flex-col gap-1.5 px-3 pb-3">
          {Object.keys(constants.rarityBaseTotals).map((rarity) => {
            const mod = getRarityMod(rarity)
            const displayVal = Math.round(mod * 100)
            const baseTotal = constants.rarityBaseTotals[rarity] ?? 0
            return (
              <div key={rarity} className="flex items-center gap-2">
                <label
                  className={cn('w-20 capitalize', `text-rarity-${rarity}`)}
                >
                  {rarity}%
                </label>
                <span className="w-8 text-right text-[9px] font-mono text-muted-foreground/75">
                  {baseTotal}
                </span>
                <NumericInput
                  step={1}
                  min={-50}
                  max={100}
                  value={displayVal}
                  onChange={(pct) => setRarityMod(rarity, pct / 100)}
                  className={cn(
                    'w-16 text-center text-xs h-7 px-2',
                    mod !== 0 && 'border-primary/50 text-primary',
                  )}
                />
              </div>
            )
          })}
        </div>
      </Section>
    </div>
  )
}

function Section({
  title,
  tooltip,
  expanded,
  onToggle,
  children,
}: {
  title: string
  tooltip?: string
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-border">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Info size={10} className="text-muted-foreground/70" />
            </TooltipTrigger>
            <TooltipContent side="right">{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </button>
      {expanded && children}
    </div>
  )
}
