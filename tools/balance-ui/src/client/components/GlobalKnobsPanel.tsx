import { useState } from 'react'
import { ChevronDown, ChevronRight, Info } from 'lucide-react'
import { cn } from '../lib/utils'
import { Input } from './ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import type {
  ConstantsOverride,
  ConstantsSnapshot,
  StatKey,
} from '../../shared/types.ts'

const STAT_KEYS: Array<StatKey> = ['hp', 'atk', 'def', 'spd']

interface Props {
  constants: ConstantsSnapshot
  overrides: ConstantsOverride
  onChange: (overrides: ConstantsOverride) => void
}

export function GlobalKnobsPanel({ constants, overrides, onChange }: Props) {
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

  const getRoleStatMod = (role: string, stat: StatKey) =>
    overrides.roleModifiers?.[role]?.[stat] ?? 0
  const getRarityMod = (rarity: string) =>
    overrides.rarityModifiers?.[rarity] ?? 0
  const effectiveScale =
    overrides.combatDamageScale ?? constants.combatDamageScale

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
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
                  {/* Show base distribution as reference */}
                  <span className="text-[9px] font-mono text-muted-foreground/50">
                    base: {STAT_KEYS.map(
                      (s) => `${s} ${Math.round(dist[s] * 100)}%`,
                    ).join(' ')}
                  </span>
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
                        <Input
                          type="number"
                          step={5}
                          min={-50}
                          max={100}
                          value={displayVal}
                          onChange={(e) => {
                            const pct = parseInt(e.target.value, 10)
                            if (!isNaN(pct)) {
                              setRoleStatMod(role, stat, pct / 100)
                            }
                          }}
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
          <Input
            type="number"
            step={0.05}
            min={0.1}
            max={2}
            value={effectiveScale}
            onChange={(e) =>
              setCombatScale(parseFloat(e.target.value) || 0.6)
            }
            className={cn(
              'w-20 text-center text-xs px-2',
              overrides.combatDamageScale !== undefined &&
                'border-primary/50 text-primary',
            )}
          />
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
                <span className="w-8 text-right text-[9px] font-mono text-muted-foreground/50">
                  {baseTotal}
                </span>
                <Input
                  type="number"
                  step={5}
                  min={-50}
                  max={100}
                  value={displayVal}
                  onChange={(e) => {
                    const pct = parseInt(e.target.value, 10)
                    if (!isNaN(pct)) {
                      setRarityMod(rarity, pct / 100)
                    }
                  }}
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
              <Info size={10} className="text-muted-foreground/40" />
            </TooltipTrigger>
            <TooltipContent side="right">{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </button>
      {expanded && children}
    </div>
  )
}
