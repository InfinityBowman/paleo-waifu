import { useState } from 'react'
import { Search } from 'lucide-react'
import { CreatureModal } from './CreatureModal'
import type {Rarity} from '@/lib/types';
import { cn } from '@/lib/utils'
import {
  RARITY_BG,
  RARITY_BORDER,
  RARITY_COLORS
  
} from '@/lib/types'
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

  const eras = [...new Set(collection.map((c) => c.era))]
  const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary']

  const filtered = collection.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()))
      return false
    if (rarityFilter !== 'all' && c.rarity !== rarityFilter) return false
    if (eraFilter !== 'all' && c.era !== eraFilter) return false
    return true
  })

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
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Rarities</SelectItem>
            {rarities.map((r) => (
              <SelectItem key={r} value={r}>
                {r[0].toUpperCase() + r.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={eraFilter} onValueChange={setEraFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
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
                  'group relative overflow-hidden rounded-lg border-2 text-left transition-all hover:scale-[1.02]',
                  RARITY_BORDER[rarity],
                  RARITY_BG[rarity],
                )}
              >
                <div className="aspect-[3/4] p-2">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl">
                      🦖
                    </div>
                  )}
                </div>
                <div className="p-2 pt-0">
                  <span
                    className={cn(
                      'text-[10px] font-semibold uppercase',
                      RARITY_COLORS[rarity],
                    )}
                  >
                    {rarity}
                  </span>
                  <div className="text-sm font-bold leading-tight">
                    {item.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {item.era}
                  </div>
                </div>
                {item.isFavorite && (
                  <div className="absolute right-1 top-1 text-amber-400">★</div>
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
