import { useDeferredValue, useMemo, useState } from 'react'
import { Search, Skull, Star } from 'lucide-react'
import { CreatureModal } from './CreatureModal'
import type { Rarity } from '@/lib/types'
import { cn } from '@/lib/utils'
import { RARITY_BG, RARITY_BORDER, RARITY_COLORS } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface CollectionItem {
  id: string
  creatureId: string
  name: string
  scientificName: string
  rarity: string
  era: string
  diet: string
  imageUrl: string | null
  description: string
  isFavorite: boolean | null
  isLocked: boolean | null
}

export function CollectionGrid({
  collection,
}: {
  collection: Array<CollectionItem>
}) {
  const [search, setSearch] = useState('')
  const [rarityFilter, setRarityFilter] = useState<string>('all')
  const [eraFilter, setEraFilter] = useState<string>('all')
  const [selected, setSelected] = useState<CollectionItem | null>(null)

  const deferredSearch = useDeferredValue(search)

  const eras = useMemo(
    () => [...new Set(collection.map((c) => c.era))],
    [collection],
  )
  const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary']

  const filtered = useMemo(
    () =>
      collection.filter((c) => {
        if (
          deferredSearch &&
          !c.name.toLowerCase().includes(deferredSearch.toLowerCase())
        )
          return false
        if (rarityFilter !== 'all' && c.rarity !== rarityFilter) return false
        if (eraFilter !== 'all' && c.era !== eraFilter) return false
        return true
      }),
    [collection, deferredSearch, rarityFilter, eraFilter],
  )

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search creatures..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={rarityFilter} onValueChange={setRarityFilter}>
          <SelectTrigger className="w-35">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">All Rarities</SelectItem>
            {rarities.map((r) => (
              <SelectItem key={r} value={r}>
                {r[0].toUpperCase() + r.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={eraFilter} onValueChange={setEraFilter}>
          <SelectTrigger className="w-35">
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
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No creatures match your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((item) => {
            const rarity = item.rarity as Rarity
            return (
              <button
                key={item.id}
                onClick={() => setSelected(item)}
                className={cn(
                  'group relative overflow-hidden rounded-xl border-2 text-left transition-all duration-200 hover:scale-[1.03] hover:-translate-y-1',
                  RARITY_BORDER[rarity],
                  RARITY_BG[rarity],
                )}
              >
                <div className="aspect-3/4 overflow-hidden p-2">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full rounded object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
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
                    {item.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {item.era}
                  </div>
                </div>
                {item.isFavorite && (
                  <Star className="absolute right-1.5 top-1.5 h-4 w-4 animate-sparkle fill-amber-400 text-amber-400" />
                )}
              </button>
            )
          })}
        </div>
      )}

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
