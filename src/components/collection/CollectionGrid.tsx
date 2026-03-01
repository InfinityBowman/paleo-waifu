import { useEffect, useMemo, useRef, useState } from 'react'
import { CreatureModal } from './CreatureModal'
import { IconMagnifyingGlass } from '@/components/icons'
import { distributeToColumns } from '@/lib/utils'
import { CreatureCard } from '@/components/shared/CreatureCard'
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
  imageAspectRatio: number | null
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

  const eras = useMemo(
    () => [...new Set(collection.map((c) => c.era))],
    [collection],
  )
  const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary']

  const filtered = useMemo(
    () =>
      collection.filter((c) => {
        if (
          search &&
          !c.name.toLowerCase().includes(search.toLowerCase())
        )
          return false
        if (rarityFilter !== 'all' && c.rarity !== rarityFilter) return false
        if (eraFilter !== 'all' && c.era !== eraFilter) return false
        return true
      }),
    [collection, search, rarityFilter, eraFilter],
  )

  // ── Masonry column distribution ──────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [columnCount, setColumnCount] = useState(5)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width
      setColumnCount(w >= 980 ? 5 : w >= 730 ? 4 : w >= 500 ? 3 : 2)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const columns = useMemo(
    () => distributeToColumns(filtered, columnCount),
    [filtered, columnCount],
  )

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1">
          <IconMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
        <div ref={containerRef} className="flex gap-4">
          {columns.map((col, colIdx) => (
            <div key={colIdx} className="flex flex-1 flex-col gap-4">
              {col.map((item) => (
                <CreatureCard
                  key={item.id}
                  creature={item}
                  onClick={() => setSelected(item)}
                />
              ))}
            </div>
          ))}
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
