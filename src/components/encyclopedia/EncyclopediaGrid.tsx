import { useState } from 'react'
import { Search, Skull } from 'lucide-react'
import type { Rarity } from '@/lib/types'
import { cn } from '@/lib/utils'
import { RARITY_BG, RARITY_BORDER, RARITY_COLORS } from '@/lib/types'
import { CreatureModal } from '@/components/collection/CreatureModal'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface CreatureData {
  id: string
  name: string
  scientificName: string
  era: string
  period: string | null
  diet: string
  sizeMeters: number | null
  weightKg: number | null
  rarity: string
  description: string
  funFacts: string | null
  imageUrl: string | null
}

export function EncyclopediaGrid({
  creatures,
}: {
  creatures: Array<CreatureData>
}) {
  const [search, setSearch] = useState('')
  const [eraFilter, setEraFilter] = useState<string>('all')
  const [dietFilter, setDietFilter] = useState<string>('all')
  const [selected, setSelected] = useState<CreatureData | null>(null)

  const eras = [...new Set(creatures.map((c) => c.era))]
  const diets = [...new Set(creatures.map((c) => c.diet))]

  const filtered = creatures.filter((c) => {
    if (
      search &&
      !c.name.toLowerCase().includes(search.toLowerCase()) &&
      !c.scientificName.toLowerCase().includes(search.toLowerCase())
    )
      return false
    if (eraFilter !== 'all' && c.era !== eraFilter) return false
    if (dietFilter !== 'all' && c.diet !== dietFilter) return false
    return true
  })

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name or scientific name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={eraFilter} onValueChange={setEraFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">All Eras</SelectItem>
            {eras.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dietFilter} onValueChange={setDietFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">All Diets</SelectItem>
            {diets.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        {filtered.length} creature{filtered.length !== 1 ? 's' : ''}
      </p>

      <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {filtered.map((c) => {
          const rarity = c.rarity as Rarity
          return (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className={cn(
                'group relative overflow-hidden rounded-xl border-2 text-left transition-all duration-200 hover:scale-[1.03] hover:-translate-y-1',
                RARITY_BORDER[rarity],
                RARITY_BG[rarity],
              )}
            >
              <div className="aspect-[3/4] overflow-hidden">
                {c.imageUrl ? (
                  <img
                    src={c.imageUrl}
                    alt={c.name}
                    loading="lazy"
                    className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted/20">
                    <Skull className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <div className="p-2 pt-0">
                <span
                  className={cn(
                    'font-display text-[10px] font-semibold uppercase',
                    RARITY_COLORS[rarity],
                  )}
                >
                  {rarity}
                </span>
                <div className="font-display text-sm font-bold leading-tight">
                  {c.name}
                </div>
                <div className="text-[11px] italic text-muted-foreground">
                  {c.scientificName}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {c.era} · {c.diet}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <CreatureModal
        creature={selected}
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      />
    </>
  )
}
