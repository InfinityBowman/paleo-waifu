import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react'
import { Search, Skull } from 'lucide-react'
import type { Rarity } from '@/lib/types'
import { cn } from '@/lib/utils'
import { RARITY_BG, RARITY_BORDER, RARITY_COLORS } from '@/lib/types'
import { CreatureModal } from '@/components/collection/CreatureModal'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getCreatureDetails } from '@/routes/_public/encyclopedia'

interface CreatureGridItem {
  id: string
  name: string
  scientificName: string
  era: string
  diet: string
  rarity: string
  imageUrl: string | null
  imageAspectRatio: number | null
}

interface CreatureDetails {
  description: string
  period: string | null
  sizeMeters: number | null
  weightKg: number | null
  funFacts: string | null
}

export function EncyclopediaGrid({
  creatures,
}: {
  creatures: Array<CreatureGridItem>
}) {
  const [search, setSearch] = useState('')
  const [eraFilter, setEraFilter] = useState<string>('all')
  const [dietFilter, setDietFilter] = useState<string>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedDetails, setSelectedDetails] =
    useState<CreatureDetails | null>(null)

  const prefetchCache = useRef<Map<string, CreatureDetails>>(new Map())
  const prefetchInFlight = useRef<Set<string>>(new Set())

  const prefetch = useCallback((id: string) => {
    if (prefetchCache.current.has(id) || prefetchInFlight.current.has(id))
      return
    prefetchInFlight.current.add(id)
    getCreatureDetails({ data: id }).then((result) => {
      prefetchInFlight.current.delete(id)
      if (result) {
        prefetchCache.current.set(id, result)
      }
    })
  }, [])

  const handleClick = useCallback((id: string) => {
    setSelectedId(id)
    const cached = prefetchCache.current.get(id)
    if (cached) {
      setSelectedDetails(cached)
    } else {
      setSelectedDetails(null)
      getCreatureDetails({ data: id }).then((result) => {
        if (result) {
          prefetchCache.current.set(id, result)
          setSelectedDetails(result)
        }
      })
    }
  }, [])

  const selectedGridItem = selectedId
    ? (creatures.find((c) => c.id === selectedId) ?? null)
    : null

  const modalCreature = selectedGridItem
    ? { ...selectedGridItem, ...selectedDetails }
    : null

  const deferredSearch = useDeferredValue(search)

  const eras = useMemo(
    () => [...new Set(creatures.map((c) => c.era))],
    [creatures],
  )
  const diets = useMemo(
    () => [...new Set(creatures.map((c) => c.diet))],
    [creatures],
  )

  const filtered = useMemo(
    () =>
      creatures.filter((c) => {
        if (
          deferredSearch &&
          !c.name.toLowerCase().includes(deferredSearch.toLowerCase()) &&
          !c.scientificName.toLowerCase().includes(deferredSearch.toLowerCase())
        )
          return false
        if (eraFilter !== 'all' && c.era !== eraFilter) return false
        if (dietFilter !== 'all' && c.diet !== dietFilter) return false
        return true
      }),
    [creatures, deferredSearch, eraFilter, dietFilter],
  )

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
        <Select value={dietFilter} onValueChange={setDietFilter}>
          <SelectTrigger className="w-35">
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

      <div className="columns-2 gap-4 sm:columns-3 md:columns-4 lg:columns-5">
        {filtered.map((c) => {
          const rarity = c.rarity as Rarity
          return (
            <button
              key={c.id}
              onMouseEnter={() => prefetch(c.id)}
              onClick={() => handleClick(c.id)}
              className={cn(
                'group mb-4 inline-block w-full overflow-hidden rounded-xl border-2 text-left break-inside-avoid transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1',
                RARITY_BORDER[rarity],
                RARITY_BG[rarity],
              )}
            >
              <div
                className="overflow-hidden"
                style={
                  c.imageAspectRatio
                    ? { aspectRatio: c.imageAspectRatio }
                    : undefined
                }
              >
                {c.imageUrl ? (
                  <img
                    src={c.imageUrl}
                    alt={c.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-muted/20">
                    <Skull className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <div className="p-2">
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
        creature={modalCreature}
        open={!!selectedId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null)
            setSelectedDetails(null)
          }
        }}
      />
    </>
  )
}
