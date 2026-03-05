import { Search, X } from 'lucide-react'
import type { Rarity } from '../lib/types'

const RARITIES: Array<Rarity> = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
]

export interface Filters {
  search: string
  rarity: string
  era: string
  diet: string
}

export function FilterBar({
  filters,
  onChange,
  eras,
  diets,
  filteredCount,
  totalCount,
}: {
  filters: Filters
  onChange: (filters: Filters) => void
  eras: Array<string>
  diets: Array<string>
  filteredCount: number
  totalCount: number
}) {
  const hasFilters =
    filters.search || filters.rarity || filters.era || filters.diet

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name or scientific name..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <select
        value={filters.rarity}
        onChange={(e) => onChange({ ...filters, rarity: e.target.value })}
        className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All rarities</option>
        {RARITIES.map((r) => (
          <option key={r} value={r}>
            {r.charAt(0).toUpperCase() + r.slice(1)}
          </option>
        ))}
      </select>

      <select
        value={filters.era}
        onChange={(e) => onChange({ ...filters, era: e.target.value })}
        className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All eras</option>
        {eras.map((e) => (
          <option key={e} value={e}>
            {e}
          </option>
        ))}
      </select>

      <select
        value={filters.diet}
        onChange={(e) => onChange({ ...filters, diet: e.target.value })}
        className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All diets</option>
        {diets.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      {hasFilters && (
        <button
          onClick={() =>
            onChange({ search: '', rarity: '', era: '', diet: '' })
          }
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}

      <span className="ml-auto text-sm text-muted-foreground">
        {filteredCount === totalCount
          ? `${totalCount} creatures`
          : `${filteredCount} of ${totalCount}`}
      </span>
    </div>
  )
}
