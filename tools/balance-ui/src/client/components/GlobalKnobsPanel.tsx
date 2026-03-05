import { useState } from 'react'
import { ChevronDown, ChevronRight, Info } from 'lucide-react'
import { Input } from './ui/input'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'
import { cn } from '../lib/utils'
import type { ConstantsSnapshot, ConstantsOverride } from '../../shared/types.ts'

interface Props {
  constants: ConstantsSnapshot
  overrides: ConstantsOverride
  onChange: (overrides: ConstantsOverride) => void
}

export function GlobalKnobsPanel({ constants, overrides, onChange }: Props) {
  const [expanded, setExpanded] = useState({
    rarity: true,
    roles: false,
    combat: true,
  })

  function toggle(key: keyof typeof expanded) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function setRarityTotal(rarity: string, value: number) {
    onChange({
      ...overrides,
      rarityBaseTotals: {
        ...overrides.rarityBaseTotals,
        [rarity]: value,
      },
    })
  }

  function setRoleDist(
    role: string,
    stat: 'hp' | 'atk' | 'def' | 'spd',
    value: number,
  ) {
    const existing =
      overrides.roleDistributions?.[role] ??
      constants.roleDistributions[role] ?? { hp: 0.25, atk: 0.25, def: 0.25, spd: 0.25 }
    onChange({
      ...overrides,
      roleDistributions: {
        ...overrides.roleDistributions,
        [role]: { ...existing, [stat]: value },
      },
    })
  }

  function setCombatScale(value: number) {
    onChange({ ...overrides, combatDamageScale: value })
  }

  const effectiveRarity = (r: string) =>
    overrides.rarityBaseTotals?.[r] ?? constants.rarityBaseTotals[r] ?? 0
  const effectiveRole = (role: string) =>
    overrides.roleDistributions?.[role] ?? constants.roleDistributions[role]
  const effectiveScale = overrides.combatDamageScale ?? constants.combatDamageScale

  return (
    <div className="flex flex-col text-xs">
      {/* Combat Scale */}
      <Section
        title="Combat Scale"
        tooltip="Global multiplier applied to all damage calculations. Lower = tankier battles, higher = burstier."
        expanded={expanded.combat}
        onToggle={() => toggle('combat')}
      >
        <div className="flex items-center gap-2 px-3 pb-3">
          <label className="w-24 text-muted-foreground">Damage Scale</label>
          <Input
            type="number"
            step={0.05}
            min={0.1}
            max={2}
            value={effectiveScale}
            onChange={(e) => setCombatScale(parseFloat(e.target.value) || 0.6)}
            className={cn(
              'w-20 text-center text-xs px-2',
              overrides.combatDamageScale !== undefined && 'border-primary/50 text-primary',
            )}
          />
        </div>
      </Section>

      {/* Rarity Totals */}
      <Section
        title="Rarity Totals"
        tooltip="Total stat budget per rarity tier. Creatures' HP+ATK+DEF+SPD are distributed from this pool."
        expanded={expanded.rarity}
        onToggle={() => toggle('rarity')}
      >
        <div className="flex flex-col gap-1.5 px-3 pb-3">
          {Object.keys(constants.rarityBaseTotals).map((rarity) => (
            <div key={rarity} className="flex items-center gap-2">
              <label className={cn('w-24 capitalize', `text-rarity-${rarity}`)}>
                {rarity}
              </label>
              <Input
                type="number"
                value={effectiveRarity(rarity)}
                onChange={(e) =>
                  setRarityTotal(rarity, parseInt(e.target.value, 10) || 0)
                }
                className={cn(
                  'w-20 text-center text-xs px-2',
                  overrides.rarityBaseTotals?.[rarity] !== undefined && 'border-primary/50 text-primary',
                )}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Role Distributions */}
      <Section
        title="Role Distributions"
        tooltip="How the stat budget is split across HP/ATK/DEF/SPD for each role. Values should sum to 1.0."
        expanded={expanded.roles}
        onToggle={() => toggle('roles')}
      >
        <div className="flex flex-col gap-3 px-3 pb-3">
          {Object.keys(constants.roleDistributions).map((role) => {
            const dist = effectiveRole(role)
            if (!dist) return null
            const sum = dist.hp + dist.atk + dist.def + dist.spd
            const sumOk = Math.abs(sum - 1) < 0.01

            return (
              <div key={role}>
                <div className="mb-1 flex items-center justify-between">
                  <span className={cn('capitalize font-medium', `text-role-${role}`)}>
                    {role}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-mono',
                      sumOk ? 'text-success' : 'text-destructive',
                    )}
                  >
                    = {sum.toFixed(2)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {(['hp', 'atk', 'def', 'spd'] as const).map((stat) => (
                    <div key={stat} className="flex flex-col items-center">
                      <label className="mb-0.5 text-[10px] uppercase text-muted-foreground">
                        {stat}
                      </label>
                      <Input
                        type="number"
                        step={0.01}
                        min={0}
                        max={1}
                        value={dist[stat]}
                        onChange={(e) =>
                          setRoleDist(
                            role,
                            stat,
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className={cn(
                          'text-center text-xs px-2',
                          overrides.roleDistributions?.[role] && 'border-primary/50 text-primary',
                        )}
                      />
                    </div>
                  ))}
                </div>
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
              <Info size={10} className="text-muted-foreground/40 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right">{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </button>
      {expanded && children}
    </div>
  )
}
