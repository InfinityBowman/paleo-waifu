import { useState } from 'react'
import { cn } from '@/lib/utils'
import { RARITY_COLORS, RARITY_BORDER, RARITY_BG, type Rarity } from '@/lib/types'
import { CreatureModal } from './CreatureModal'
import { Search } from 'lucide-react'

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

export function CollectionGrid({ collection }: { collection: CollectionItem[] }) {
  const [search, setSearch] = useState('')
  const [rarityFilter, setRarityFilter] = useState<string>('all')
  const [eraFilter, setEraFilter] = useState<string>('all')
  const [selected, setSelected] = useState<CollectionItem | null>(null)

  const eras = [...new Set(collection.map((c) => c.era))]
  const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary']

  const filtered = collection.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    if (rarityFilter !== 'all' && c.rarity !== rarityFilter) return false
    if (eraFilter !== 'all' && c.era !== eraFilter) return false
    return true
  })

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search creatures..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border bg-transparent pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <select
          value={rarityFilter}
          onChange={(e) => setRarityFilter(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="all">All Rarities</option>
          {rarities.map((r) => (
            <option key={r} value={r}>
              {r[0].toUpperCase() + r.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={eraFilter}
          onChange={(e) => setEraFilter(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="all">All Eras</option>
          {eras.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          No creatures match your filters.
        </div>
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
                  <div className="text-sm font-bold leading-tight">{item.name}</div>
                  <div className="text-[11px] text-muted-foreground">{item.era}</div>
                </div>
                {item.isFavorite && (
                  <div className="absolute right-1 top-1 text-amber-400">★</div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {selected && (
        <CreatureModal creature={selected} onClose={() => setSelected(null)} />
      )}
    </>
  )
}
