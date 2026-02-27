import { useState } from 'react'
import { cn } from '@/lib/utils'
import { RARITY_COLORS, RARITY_BORDER, RARITY_BG, type Rarity } from '@/lib/types'
import { CreatureModal } from '@/components/collection/CreatureModal'
import { Search } from 'lucide-react'

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

export function EncyclopediaGrid({ creatures }: { creatures: CreatureData[] }) {
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
          <input
            type="text"
            placeholder="Search by name or scientific name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border bg-transparent pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
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
        <select
          value={dietFilter}
          onChange={(e) => setDietFilter(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="all">All Diets</option>
          {diets.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
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
                'group overflow-hidden rounded-lg border-2 text-left transition-all hover:scale-[1.02]',
                RARITY_BORDER[rarity],
                RARITY_BG[rarity],
              )}
            >
              <div className="aspect-[3/4] p-2">
                {c.imageUrl ? (
                  <img
                    src={c.imageUrl}
                    alt={c.name}
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
                <div className="text-sm font-bold leading-tight">{c.name}</div>
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

      {selected && (
        <CreatureModal creature={selected} onClose={() => setSelected(null)} />
      )}
    </>
  )
}
