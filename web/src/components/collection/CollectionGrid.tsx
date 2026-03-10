import { useMemo, useState } from 'react'
import { CreatureModal } from './CreatureModal'
import type { BattleStatsData } from '@/components/shared/BattleStatsPanel'
import { IconMagnifyingGlass } from '@/components/icons'
import { CreatureCard } from '@/components/shared/CreatureCard'
import { useMasonryColumns } from '@/hooks/useMasonryColumns'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
  isBattleReady: boolean
  battleStats?: BattleStatsData | null
}

export function CollectionGrid({
  collection,
}: {
  collection: Array<CollectionItem>
}) {
  const [search, setSearch] = useState('')
  const [rarityFilter, setRarityFilter] = useState<string>('all')
  const [eraFilter, setEraFilter] = useState<string>('all')
  const [battleFilter, setBattleFilter] = useState<string>('all')
  const [selected, setSelected] = useState<CollectionItem | null>(null)

  const eras = useMemo(
    () => [...new Set(collection.map((c) => c.era))],
    [collection],
  )
  const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary']

  const filtered = useMemo(
    () =>
      collection.filter((c) => {
        if (search && !c.name.toLowerCase().includes(search.toLowerCase()))
          return false
        if (rarityFilter !== 'all' && c.rarity !== rarityFilter) return false
        if (eraFilter !== 'all' && c.era !== eraFilter) return false
        if (battleFilter === 'battle' && !c.isBattleReady) return false
        return true
      }),
    [collection, search, rarityFilter, eraFilter, battleFilter],
  )

  const { containerRef, columns } = useMasonryColumns(filtered)

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
          <SelectTrigger className="w-full sm:w-35">
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
          <SelectTrigger className="w-full sm:w-35">
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
        <Select value={battleFilter} onValueChange={setBattleFilter}>
          <SelectTrigger className="w-full sm:w-38">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">All Creatures</SelectItem>
            <SelectItem value="battle">Battle Ready</SelectItem>
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
