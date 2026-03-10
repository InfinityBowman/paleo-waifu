import { useMemo, useState } from 'react'
import { Shield, Zap } from 'lucide-react'
import { BattleCreatureSlot } from './BattleCreatureSlot'
import { SynergyPreview } from './SynergyPreview'
import type { BattleReadyCreature } from './BattleCreatureSlot'
import type { Rarity } from '@paleo-waifu/shared/types'
import { IconFossil, IconMagnifyingGlass } from '@/components/icons'
import { cn } from '@/lib/utils'
import { RARITY_BG, RARITY_BORDER, RARITY_COLORS } from '@/lib/rarity-styles'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface TeamSlot {
  creature: BattleReadyCreature
  row: 'front' | 'back'
}

interface BattleTeamPickerProps {
  creatures: Array<BattleReadyCreature>
  value: [TeamSlot | null, TeamSlot | null, TeamSlot | null]
  onChange: (slots: [TeamSlot | null, TeamSlot | null, TeamSlot | null]) => void
}

const DEFAULT_ROW_FOR_ROLE: Record<string, 'front' | 'back'> = {
  tank: 'front',
  bruiser: 'front',
  striker: 'back',
  support: 'back',
}

const ROLE_COLOR: Record<string, string> = {
  striker: 'text-red-400',
  tank: 'text-blue-400',
  support: 'text-green-400',
  bruiser: 'text-orange-400',
}

export function BattleTeamPicker({
  creatures,
  value,
  onChange,
}: BattleTeamPickerProps) {
  const [activeSlot, setActiveSlot] = useState<0 | 1 | 2 | null>(null)
  const [search, setSearch] = useState('')
  const [rarityFilter, setRarityFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  // Exclude already-selected creature IDs
  const selectedCreatureIds = useMemo(
    () => new Set(value.filter(Boolean).map((s) => s!.creature.creatureId)),
    [value],
  )

  const filtered = useMemo(() => {
    return creatures.filter((c) => {
      if (selectedCreatureIds.has(c.creatureId)) return false
      if (search && !c.name.toLowerCase().includes(search.toLowerCase()))
        return false
      if (rarityFilter !== 'all' && c.rarity !== rarityFilter) return false
      if (roleFilter !== 'all' && c.role !== roleFilter) return false
      return true
    })
  }, [creatures, search, rarityFilter, roleFilter, selectedCreatureIds])

  function handleSelect(creature: BattleReadyCreature) {
    if (activeSlot === null) return
    const newSlots = [...value] as [
      TeamSlot | null,
      TeamSlot | null,
      TeamSlot | null,
    ]
    newSlots[activeSlot] = {
      creature,
      row: DEFAULT_ROW_FOR_ROLE[creature.role] ?? 'front',
    }
    onChange(newSlots)
    setActiveSlot(null)
    setSearch('')
    setRarityFilter('all')
    setRoleFilter('all')
  }

  function handleClear(idx: 0 | 1 | 2) {
    const newSlots = [...value] as [
      TeamSlot | null,
      TeamSlot | null,
      TeamSlot | null,
    ]
    newSlots[idx] = null
    onChange(newSlots)
  }

  function handleRowChange(idx: 0 | 1 | 2, row: 'front' | 'back') {
    const slot = value[idx]
    if (!slot) return
    const newSlots = [...value] as [
      TeamSlot | null,
      TeamSlot | null,
      TeamSlot | null,
    ]
    newSlots[idx] = { ...slot, row }
    onChange(newSlots)
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {([0, 1, 2] as const).map((idx) => (
          <BattleCreatureSlot
            key={idx}
            creature={value[idx]?.creature ?? null}
            row={value[idx]?.row ?? 'front'}
            slotIndex={idx}
            onRowChange={(row) => handleRowChange(idx, row)}
            onClick={() => setActiveSlot(idx)}
            onClear={() => handleClear(idx)}
          />
        ))}
      </div>

      <div className="mt-3">
        <SynergyPreview creatures={value.map((s) => s?.creature ?? null)} />
      </div>

      <Dialog
        open={activeSlot !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActiveSlot(null)
            setSearch('')
            setRarityFilter('all')
            setRoleFilter('all')
          }
        }}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              Choose Your Creature
            </DialogTitle>
            <DialogDescription>
              {filtered.length} creature{filtered.length !== 1 ? 's' : ''}{' '}
              available
            </DialogDescription>
          </DialogHeader>

          {/* Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <IconMagnifyingGlass className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={rarityFilter} onValueChange={setRarityFilter}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Rarity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="common">Common</SelectItem>
                <SelectItem value="uncommon">Uncommon</SelectItem>
                <SelectItem value="rare">Rare</SelectItem>
                <SelectItem value="epic">Epic</SelectItem>
                <SelectItem value="legendary">Legendary</SelectItem>
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="striker">Striker</SelectItem>
                <SelectItem value="tank">Tank</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="bruiser">Bruiser</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-muted-foreground">
              <IconFossil className="mb-2 h-8 w-8 text-muted-foreground/20" />
              <p className="text-sm">No creatures match your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {filtered.map((c) => {
                const rarity = c.rarity as Rarity
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelect(c)}
                    className={cn(
                      'group overflow-hidden rounded-xl border-2 text-left transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02]',
                      RARITY_BORDER[rarity],
                      RARITY_BG[rarity],
                    )}
                  >
                    {c.imageUrl ? (
                      <img
                        src={c.imageUrl}
                        alt={c.name}
                        className="h-16 w-full object-contain transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-16 items-center justify-center bg-muted/20">
                        <IconFossil className="h-6 w-6 text-muted-foreground/20" />
                      </div>
                    )}
                    <div className="p-2">
                      <p className="truncate font-display text-xs font-bold">
                        {c.name}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1">
                        <span
                          className={cn(
                            'font-display text-[9px] font-semibold uppercase',
                            RARITY_COLORS[rarity],
                          )}
                        >
                          {rarity}
                        </span>
                        <span className="text-muted-foreground/30">
                          &middot;
                        </span>
                        <span
                          className={cn(
                            'text-[9px] font-semibold capitalize',
                            ROLE_COLOR[c.role] ?? 'text-muted-foreground',
                          )}
                        >
                          {c.role}
                        </span>
                      </div>
                      {(c.active || c.passive) && (
                        <div className="mt-1 space-y-0.5">
                          {c.active && (
                            <div className="flex items-center gap-1 text-[9px]">
                              <Zap className="h-2 w-2 shrink-0 text-amber-400" />
                              <span className="truncate text-amber-300/80">
                                {c.active.displayName}
                              </span>
                            </div>
                          )}
                          {c.passive && (
                            <div className="flex items-center gap-1 text-[9px]">
                              <Shield className="h-2 w-2 shrink-0 text-purple-400" />
                              <span className="truncate text-purple-300/80">
                                {c.passive.displayName}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
