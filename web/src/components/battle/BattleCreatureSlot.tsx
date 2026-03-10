import { Heart, Shield, Swords, Wind, X, Zap } from 'lucide-react'
import type { Rarity } from '@paleo-waifu/shared/types'
import { IconFossil } from '@/components/icons'
import { cn } from '@/lib/utils'
import {
  RARITY_BG,
  RARITY_BORDER,
  RARITY_COLORS,
  RARITY_GLOW,
} from '@/lib/rarity-styles'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

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
  active: { displayName: string; description: string; cooldown: number } | null
  passive: { displayName: string; description: string } | null
}

interface BattleCreatureSlotProps {
  creature: BattleReadyCreature | null
  row: 'front' | 'back'
  slotIndex: number
  onRowChange: (row: 'front' | 'back') => void
  onClick: () => void
  onClear: () => void
}

const ROLE_COLOR: Record<string, string> = {
  striker: 'text-red-400',
  tank: 'text-blue-400',
  support: 'text-green-400',
  bruiser: 'text-orange-400',
}

const STAT_MINI = [
  { key: 'hp', icon: Heart, color: 'text-green-500' },
  { key: 'atk', icon: Swords, color: 'text-red-400' },
  { key: 'def', icon: Shield, color: 'text-blue-400' },
  { key: 'spd', icon: Wind, color: 'text-amber-400' },
] as const

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
        className="group flex h-full min-h-52 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/10 transition-colors duration-200 hover:border-primary/40 hover:bg-muted/20"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-muted-foreground/20 transition-colors group-hover:border-primary/40 group-hover:text-primary">
          <span className="text-lg text-muted-foreground/40 group-hover:text-primary">
            +
          </span>
        </div>
        <span className="mt-2 font-display text-xs text-muted-foreground/50">
          Slot {slotIndex + 1}
        </span>
      </button>
    )
  }

  const rarity = creature.rarity as Rarity
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border-2',
        RARITY_BORDER[rarity],
        RARITY_BG[rarity],
        RARITY_GLOW[rarity] && `shadow-lg ${RARITY_GLOW[rarity]}`,
      )}
    >
      {/* Remove button */}
      <button
        onClick={onClear}
        className="absolute right-1.5 top-1.5 z-10 rounded-full bg-black/50 p-1 text-white/70 backdrop-blur-sm transition-colors hover:bg-red-500/80 hover:text-white"
      >
        <X className="h-3 w-3" />
      </button>

      {/* Creature image + info */}
      <button onClick={onClick} className="w-full text-left">
        <div className="relative">
          {creature.imageUrl ? (
            <img
              src={creature.imageUrl}
              alt={creature.name}
              className="h-24 w-full object-contain"
            />
          ) : (
            <div className="flex h-24 items-center justify-center bg-muted/20">
              <IconFossil className="h-10 w-10 text-muted-foreground/20" />
            </div>
          )}
          {/* Gradient fade to content */}
          <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/30 to-transparent" />
        </div>

        <div className="space-y-1.5 p-2.5 pt-1.5">
          {/* Name + role badge */}
          <div>
            <p className="truncate font-display text-sm font-bold leading-tight">
              {creature.name}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span
                className={cn(
                  'font-display text-[10px] font-semibold uppercase',
                  RARITY_COLORS[rarity],
                )}
              >
                {rarity}
              </span>
              <span className="text-muted-foreground/30">&middot;</span>
              <span
                className={cn(
                  'text-[10px] font-semibold capitalize',
                  ROLE_COLOR[creature.role] ?? 'text-muted-foreground',
                )}
              >
                {creature.role}
              </span>
            </div>
          </div>

          {/* Stat icons row */}
          <div className="flex gap-2">
            {STAT_MINI.map(({ key, icon: Icon, color }) => (
              <div key={key} className="flex items-center gap-0.5">
                <Icon className={cn('h-2.5 w-2.5', color)} />
                <span className="text-[10px] font-medium">{creature[key]}</span>
              </div>
            ))}
          </div>
        </div>
      </button>

      {/* Abilities — clickable popovers */}
      {(creature.active || creature.passive) && (
        <div className="space-y-1 border-t border-border/50 px-2.5 pb-2 pt-1.5">
          {creature.active && (
            <AbilityPill
              icon={<Zap className="h-2.5 w-2.5 shrink-0 text-amber-400" />}
              name={creature.active.displayName}
              nameClass="text-amber-300"
              bgClass="bg-amber-500/8 hover:bg-amber-500/15"
              cooldown={creature.active.cooldown}
              description={creature.active.description}
              popoverIcon={<Zap className="h-3.5 w-3.5 text-amber-400" />}
              popoverAccent="text-amber-300"
              popoverBadge={
                creature.active.cooldown > 1 ? (
                  <span className="rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                    CD {creature.active.cooldown}
                  </span>
                ) : null
              }
            />
          )}
          {creature.passive && (
            <AbilityPill
              icon={<Shield className="h-2.5 w-2.5 shrink-0 text-purple-400" />}
              name={creature.passive.displayName}
              nameClass="text-purple-300"
              bgClass="bg-purple-500/8 hover:bg-purple-500/15"
              description={creature.passive.description}
              popoverIcon={<Shield className="h-3.5 w-3.5 text-purple-400" />}
              popoverAccent="text-purple-300"
              popoverBadge={
                <span className="rounded-sm bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-medium text-purple-400">
                  Passive
                </span>
              }
            />
          )}
        </div>
      )}

      {/* Front / Back row toggle */}
      <div className="flex border-t border-border/50">
        {(['front', 'back'] as const).map((r) => (
          <button
            key={r}
            onClick={() => onRowChange(r)}
            className={cn(
              'flex-1 py-1.5 text-center font-display text-[11px] capitalize transition-colors',
              row === r
                ? 'bg-primary/15 font-semibold text-primary'
                : 'text-muted-foreground/60 hover:bg-muted/20 hover:text-muted-foreground',
            )}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  )
}

function AbilityPill({
  icon,
  name,
  nameClass,
  bgClass,
  cooldown,
  description,
  popoverIcon,
  popoverAccent,
  popoverBadge,
}: {
  icon: React.ReactNode
  name: string
  nameClass: string
  bgClass: string
  cooldown?: number
  description: string
  popoverIcon: React.ReactNode
  popoverAccent: string
  popoverBadge: React.ReactNode
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors',
            bgClass,
          )}
        >
          {icon}
          <span className={cn('truncate text-[10px] font-semibold', nameClass)}>
            {name}
          </span>
          {cooldown != null && cooldown > 1 && (
            <span className="ml-auto shrink-0 rounded-sm bg-amber-500/15 px-1 text-[8px] font-medium text-amber-400/70">
              CD {cooldown}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="w-56 p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          {popoverIcon}
          <span
            className={cn('font-display text-sm font-semibold', popoverAccent)}
          >
            {name}
          </span>
          {popoverBadge}
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </PopoverContent>
    </Popover>
  )
}
