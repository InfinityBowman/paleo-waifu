import { useState, useMemo } from 'react'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from './ui/select'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from './ui/tooltip'
import { cn } from '../lib/utils'
import type {
  CreatureRecord,
  CreatureOverridePatch,
  ConstantsSnapshot,
} from '../../shared/types.ts'

type SortKey =
  | 'name'
  | 'rarity'
  | 'role'
  | 'hp'
  | 'atk'
  | 'def'
  | 'spd'
  | 'total'
type SortDir = 'asc' | 'desc'

const RARITY_ORDER: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
}

const RARITY_CLASSES: Record<string, string> = {
  common: 'text-rarity-common',
  uncommon: 'text-rarity-uncommon',
  rare: 'text-rarity-rare',
  epic: 'text-rarity-epic',
  legendary: 'text-rarity-legendary',
}

const ROLE_CLASSES: Record<string, string> = {
  striker: 'text-role-striker',
  tank: 'text-role-tank',
  support: 'text-role-support',
  bruiser: 'text-role-bruiser',
}

const STAT_TOOLTIPS: Record<string, string> = {
  hp: 'Health Points - determines how much damage a creature can take before being knocked out',
  atk: 'Attack - influences damage dealt by active abilities',
  def: 'Defense - reduces incoming damage from attacks',
  spd: 'Speed - determines turn order; higher speed acts first',
}

const ROLE_TOOLTIPS: Record<string, string> = {
  striker: 'Striker - high ATK, low DEF. Glass cannon damage dealer.',
  tank: 'Tank - high HP & DEF, low ATK. Absorbs damage for the team.',
  support: 'Support - balanced stats with utility abilities. Enables teammates.',
  bruiser: 'Bruiser - balanced ATK & DEF. Versatile front-liner.',
}

interface Props {
  creatures: CreatureRecord[]
  patches: Map<string, CreatureOverridePatch>
  constants: ConstantsSnapshot
  onPatch: (patch: CreatureOverridePatch) => void
}

export function CreatureTable({ creatures, patches, constants, onPatch }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [filter, setFilter] = useState('')

  function getEffective(c: CreatureRecord): CreatureRecord {
    const patch = patches.get(c.id)
    if (!patch) return c
    return {
      ...c,
      hp: patch.hp ?? c.hp,
      atk: patch.atk ?? c.atk,
      def: patch.def ?? c.def,
      spd: patch.spd ?? c.spd,
      active: patch.activeTemplateId
        ? { templateId: patch.activeTemplateId, displayName: patch.activeTemplateId }
        : c.active,
      passive: patch.passiveTemplateId
        ? { templateId: patch.passiveTemplateId, displayName: patch.passiveTemplateId }
        : c.passive,
    }
  }

  const sorted = useMemo(() => {
    const filtered = creatures.filter((c) =>
      c.name.toLowerCase().includes(filter.toLowerCase()),
    )

    return [...filtered].sort((a, b) => {
      const ea = getEffective(a)
      const eb = getEffective(b)
      let cmp = 0

      switch (sortKey) {
        case 'name':
          cmp = ea.name.localeCompare(eb.name)
          break
        case 'rarity':
          cmp = (RARITY_ORDER[ea.rarity] ?? 0) - (RARITY_ORDER[eb.rarity] ?? 0)
          break
        case 'role':
          cmp = ea.role.localeCompare(eb.role)
          break
        case 'hp':
        case 'atk':
        case 'def':
        case 'spd':
          cmp = ea[sortKey] - eb[sortKey]
          break
        case 'total':
          cmp =
            ea.hp + ea.atk + ea.def + ea.spd -
            (eb.hp + eb.atk + eb.def + eb.spd)
          break
      }

      return sortDir === 'asc' ? cmp : -cmp
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatures, sortKey, sortDir, filter, patches])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'name' || key === 'role' ? 'asc' : 'desc')
    }
  }

  function SortHeader({
    k,
    label,
    tooltip,
    className,
  }: {
    k: SortKey
    label: string
    tooltip?: string
    className?: string
  }) {
    const header = (
      <th
        onClick={() => toggleSort(k)}
        className={cn(
          'cursor-pointer select-none px-2 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground transition-colors',
          className,
        )}
      >
        {label}
        {sortKey === k && (
          <span className="ml-0.5 text-primary">
            {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
          </span>
        )}
      </th>
    )

    if (!tooltip) return header

    return (
      <Tooltip>
        <TooltipTrigger asChild>{header}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    )
  }

  function isPatched(id: string, field: keyof CreatureOverridePatch): boolean {
    const patch = patches.get(id)
    if (!patch) return false
    return patch[field] !== undefined
  }

  return (
    <div className="p-3">
      <Input
        type="text"
        placeholder="Filter creatures..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-3 w-64"
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-8 px-2 py-2 text-xs font-medium text-muted-foreground">
                On
              </th>
              <SortHeader k="name" label="Name" className="min-w-[140px]" />
              <SortHeader k="rarity" label="Rarity" />
              <SortHeader
                k="role"
                label="Role"
                tooltip="Click column to sort. Hover a role name for details."
              />
              <SortHeader k="hp" label="HP" tooltip={STAT_TOOLTIPS.hp} />
              <SortHeader k="atk" label="ATK" tooltip={STAT_TOOLTIPS.atk} />
              <SortHeader k="def" label="DEF" tooltip={STAT_TOOLTIPS.def} />
              <SortHeader k="spd" label="SPD" tooltip={STAT_TOOLTIPS.spd} />
              <SortHeader k="total" label="Total" tooltip="Sum of all four stats" />
              <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                Active
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                Passive
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const eff = getEffective(c)
              const patch = patches.get(c.id)
              const disabled = patch?.disabled ?? false

              return (
                <tr
                  key={c.id}
                  className={cn(
                    'border-b border-border/30 hover:bg-muted/30 transition-colors',
                    disabled && 'opacity-40',
                  )}
                >
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={!disabled}
                      onChange={(e) =>
                        onPatch({
                          id: c.id,
                          disabled: !e.target.checked,
                        })
                      }
                      className="accent-primary"
                    />
                  </td>
                  <td className="px-2 py-1.5 font-medium">{c.name}</td>
                  <td className="px-2 py-1.5">
                    <Badge
                      variant="ghost"
                      className={cn(
                        'text-[10px] capitalize',
                        RARITY_CLASSES[c.rarity],
                      )}
                    >
                      {c.rarity}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn(
                          'text-xs capitalize cursor-help',
                          ROLE_CLASSES[c.role],
                        )}>
                          {c.role}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {ROLE_TOOLTIPS[c.role] ?? c.role}
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  <StatCell
                    creature={c}
                    field="hp"
                    value={eff.hp}
                    original={c.hp}
                    patched={isPatched(c.id, 'hp')}
                    onPatch={onPatch}
                  />
                  <StatCell
                    creature={c}
                    field="atk"
                    value={eff.atk}
                    original={c.atk}
                    patched={isPatched(c.id, 'atk')}
                    onPatch={onPatch}
                  />
                  <StatCell
                    creature={c}
                    field="def"
                    value={eff.def}
                    original={c.def}
                    patched={isPatched(c.id, 'def')}
                    onPatch={onPatch}
                  />
                  <StatCell
                    creature={c}
                    field="spd"
                    value={eff.spd}
                    original={c.spd}
                    patched={isPatched(c.id, 'spd')}
                    onPatch={onPatch}
                  />
                  <td className="px-2 py-1.5">
                    <span className={cn(
                      'text-xs font-mono',
                      (isPatched(c.id, 'hp') || isPatched(c.id, 'atk') || isPatched(c.id, 'def') || isPatched(c.id, 'spd'))
                        ? 'text-primary'
                        : 'text-muted-foreground',
                    )}>
                      {eff.hp + eff.atk + eff.def + eff.spd}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <AbilitySelect
                      value={eff.active.templateId}
                      options={constants.activeTemplates}
                      onChange={(templateId) =>
                        onPatch({ id: c.id, activeTemplateId: templateId })
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <AbilitySelect
                      value={eff.passive.templateId}
                      options={constants.passiveTemplates}
                      onChange={(templateId) =>
                        onPatch({ id: c.id, passiveTemplateId: templateId })
                      }
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCell({
  creature,
  field,
  value,
  original,
  patched,
  onPatch,
}: {
  creature: CreatureRecord
  field: 'hp' | 'atk' | 'def' | 'spd'
  value: number
  original: number
  patched: boolean
  onPatch: (patch: CreatureOverridePatch) => void
}) {
  const delta = value - original

  return (
    <td className="px-1 py-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <Input
              type="number"
              value={value}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                if (!isNaN(v)) {
                  onPatch({
                    id: creature.id,
                    [field]: v === original ? undefined : v,
                  })
                }
              }}
              className={cn(
                'w-16 text-center text-xs h-7 px-2',
                patched && 'border-primary/50 text-primary',
              )}
            />
          </div>
        </TooltipTrigger>
        {patched && delta !== 0 && (
          <TooltipContent>
            Original: {original} ({delta > 0 ? '+' : ''}{delta})
          </TooltipContent>
        )}
      </Tooltip>
    </td>
  )
}

function AbilitySelect({
  value,
  options,
  onChange,
}: {
  value: string
  options: Array<{ id: string; name: string; description?: string }>
  onChange: (id: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full min-w-[120px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
