import { useMemo, useState } from 'react'
import { ArrowUpDown, ImageOff } from 'lucide-react'
import { slugify, toCdnUrl } from '../lib/types'
import { RarityBadge } from './RarityBadge'
import { FilterBar  } from './FilterBar'
import type {Creature} from '../lib/types';
import type {Filters} from './FilterBar';

type SortKey = 'name' | 'scientificName' | 'era' | 'rarity' | 'diet' | 'type'
type SortDir = 'asc' | 'desc'

const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 }

export function CreatureList({
  creatures,
  onSelect,
}: {
  creatures: Array<Creature>
  onSelect: (slug: string) => void
}) {
  const [filters, setFilters] = useState<Filters>({
    search: '',
    rarity: '',
    era: '',
    diet: '',
  })
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const eras = useMemo(
    () => [...new Set(creatures.map((c) => c.era))].sort(),
    [creatures],
  )
  const diets = useMemo(
    () => [...new Set(creatures.map((c) => c.diet).filter(Boolean))].sort(),
    [creatures],
  )

  const filtered = useMemo(() => {
    let result = creatures
    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.scientificName.toLowerCase().includes(q),
      )
    }
    if (filters.rarity) result = result.filter((c) => c.rarity === filters.rarity)
    if (filters.era) result = result.filter((c) => c.era === filters.era)
    if (filters.diet) result = result.filter((c) => c.diet === filters.diet)

    result = [...result].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'rarity') {
        cmp = RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]
      } else {
        cmp = a[sortKey].localeCompare(b[sortKey])
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [creatures, filters, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function SortHeader({ label, field }: { label: string; field: SortKey }) {
    return (
      <th
        className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
        onClick={() => toggleSort(field)}
      >
        <span className="flex items-center gap-1">
          {label}
          <ArrowUpDown
            className={`h-3 w-3 ${sortKey === field ? 'text-foreground' : 'opacity-30'}`}
          />
        </span>
      </th>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <FilterBar
        filters={filters}
        onChange={setFilters}
        eras={eras}
        diets={diets}
        filteredCount={filtered.length}
        totalCount={creatures.length}
      />
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="border-b border-border">
              <th className="w-12 px-4 py-3" />
              <SortHeader label="Name" field="name" />
              <SortHeader label="Scientific Name" field="scientificName" />
              <SortHeader label="Era" field="era" />
              <SortHeader label="Rarity" field="rarity" />
              <SortHeader label="Diet" field="diet" />
              <SortHeader label="Type" field="type" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const slug = slugify(c.scientificName)
              return (
                <tr
                  key={slug}
                  onClick={() => onSelect(slug)}
                  className="cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/50"
                >
                  <td className="px-4 py-2">
                    {c.imageUrl ? (
                      <img
                        src={toCdnUrl(c.imageUrl)!}
                        alt=""
                        className="h-8 w-8 rounded object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                        <ImageOff className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 font-medium text-foreground">
                    {c.name}
                  </td>
                  <td className="px-4 py-2 text-sm italic text-muted-foreground">
                    {c.scientificName}
                  </td>
                  <td className="px-4 py-2 text-sm text-muted-foreground">
                    {c.era}
                  </td>
                  <td className="px-4 py-2">
                    <RarityBadge rarity={c.rarity} />
                  </td>
                  <td className="px-4 py-2 text-sm text-muted-foreground">
                    {c.diet}
                  </td>
                  <td className="px-4 py-2 text-sm text-muted-foreground">
                    {c.type}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            No creatures match your filters.
          </div>
        )}
      </div>
    </div>
  )
}
