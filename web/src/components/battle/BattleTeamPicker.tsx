import { useMemo, useState } from 'react'
import { BattleCreatureSlot } from './BattleCreatureSlot'
import { SynergyPreview } from './SynergyPreview'
import type { BattleReadyCreature } from './BattleCreatureSlot'
import {
  Dialog,
  DialogContent,
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
  const selectedCreatureIds = new Set(
    value.filter(Boolean).map((s) => s!.creature.creatureId),
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
            <DialogTitle>Select Creature</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2">
            <Input
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
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

          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No battle-ready creatures found
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  className="rounded-lg border border-border bg-card p-2 text-left transition-colors hover:border-amber-500/50 hover:bg-muted/40"
                >
                  {c.imageUrl ? (
                    <img
                      src={c.imageUrl}
                      alt={c.name}
                      className="h-14 w-full rounded object-contain"
                    />
                  ) : (
                    <div className="flex h-16 items-center justify-center rounded bg-muted/30">
                      <span className="text-lg">🦴</span>
                    </div>
                  )}
                  <p className="mt-1 truncate text-xs font-semibold">
                    {c.name}
                  </p>
                  <p className="text-[10px] capitalize text-muted-foreground">
                    {c.role} &middot; {c.rarity}
                  </p>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
