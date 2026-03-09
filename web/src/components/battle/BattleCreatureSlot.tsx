import { X } from 'lucide-react'
import type { Rarity } from '@paleo-waifu/shared/types'
import { RARITY_BG, RARITY_BORDER } from '@/lib/rarity-styles'

export interface BattleReadyCreature {
  id: string
  creatureId: string
  name: string
  scientificName: string
  rarity: string
  era: string
  diet: string
  type: string | null
  imageUrl: string | null
  imageAspectRatio: number | null
  role: string
  hp: number
  atk: number
  def: number
  spd: number
}

interface BattleCreatureSlotProps {
  creature: BattleReadyCreature | null
  row: 'front' | 'back'
  slotIndex: number
  onRowChange: (row: 'front' | 'back') => void
  onClick: () => void
  onClear: () => void
}

export function BattleCreatureSlot({
  creature,
  row,
  slotIndex,
  onRowChange,
  onClick,
  onClear,
}: BattleCreatureSlotProps) {
  if (!creature) {
    return (
      <button
        onClick={onClick}
        className="flex h-48 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 transition-colors hover:border-amber-500/50 hover:bg-muted/40"
      >
        <span className="text-3xl text-muted-foreground/50">+</span>
        <span className="mt-1 text-xs text-muted-foreground">
          Slot {slotIndex + 1}
        </span>
      </button>
    )
  }

  const rarity = creature.rarity as Rarity
  return (
    <div
      className={`relative overflow-hidden rounded-lg border ${RARITY_BORDER[rarity]} ${RARITY_BG[rarity]}`}
    >
      <button
        onClick={onClear}
        className="absolute right-1 top-1 z-10 rounded-full bg-black/60 p-0.5 text-white hover:bg-red-500/80"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <button onClick={onClick} className="w-full text-left">
        {creature.imageUrl ? (
          <img
            src={creature.imageUrl}
            alt={creature.name}
            className="h-20 w-full object-contain"
          />
        ) : (
          <div className="flex h-24 items-center justify-center bg-muted/30">
            <span className="text-2xl">🦴</span>
          </div>
        )}
        <div className="p-2">
          <p className="truncate text-sm font-semibold">{creature.name}</p>
          <p className="text-xs capitalize text-muted-foreground">
            {creature.role} &middot; {creature.rarity}
          </p>
          <div className="mt-1 grid grid-cols-4 gap-1 text-[10px] text-muted-foreground">
            <span>HP {creature.hp}</span>
            <span>ATK {creature.atk}</span>
            <span>DEF {creature.def}</span>
            <span>SPD {creature.spd}</span>
          </div>
        </div>
      </button>

      <div className="flex border-t border-border/50">
        <button
          onClick={() => onRowChange('front')}
          className={`flex-1 py-1 text-center text-xs transition-colors ${
            row === 'front'
              ? 'bg-amber-500/20 font-semibold text-amber-400'
              : 'text-muted-foreground hover:bg-muted/30'
          }`}
        >
          Front
        </button>
        <button
          onClick={() => onRowChange('back')}
          className={`flex-1 py-1 text-center text-xs transition-colors ${
            row === 'back'
              ? 'bg-amber-500/20 font-semibold text-amber-400'
              : 'text-muted-foreground hover:bg-muted/30'
          }`}
        >
          Back
        </button>
      </div>
    </div>
  )
}
