import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, Search, Skull } from 'lucide-react'
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
import {
  getCreatureDetails,
  loadMoreCreatures,
} from '@/routes/_public/encyclopedia'
import type { EncyclopediaFilters } from '@/routes/_public/encyclopedia'

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

interface Props {
  creatures: Array<CreatureGridItem>
  hasMore: boolean
  initialCursor: string | null
  filterOptions: { eras: Array<string>; diets: Array<string> }
  filters: EncyclopediaFilters
}

export function EncyclopediaGrid({
  creatures,
  hasMore: initialHasMore,
  initialCursor,
  filterOptions,
  filters,
}: Props) {
  const navigate = useNavigate()

  // ── Infinite scroll state ──────────────────────────────────────────────────
  const [extraItems, setExtraItems] = useState<Array<CreatureGridItem>>([])
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [loadingMore, setLoadingMore] = useState(false)

  // Reset when loader fires a new initial page (filters/sort changed)
  const creaturesRef = useRef(creatures)
  useEffect(() => {
    if (creaturesRef.current !== creatures) {
      creaturesRef.current = creatures
      setExtraItems([])
      setHasMore(initialHasMore)
      setCursor(initialCursor)
    }
  }, [creatures, initialHasMore, initialCursor])

  // ── Local search input (debounced → URL) ───────────────────────────────────
  const [searchInput, setSearchInput] = useState(filters.search)

  useEffect(() => {
    setSearchInput(filters.search)
  }, [filters.search])

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      void navigate({
        to: '/encyclopedia',
        search: { ...filters, search: value || undefined },
        replace: true,
      })
    }, 350)
  }

  // ── Filter navigate helpers ────────────────────────────────────────────────
  const handleEraChange = (value: string) => {
    void navigate({
      to: '/encyclopedia',
      search: { ...filters, era: value || undefined },
      replace: true,
    })
  }

  const handleDietChange = (value: string) => {
    void navigate({
      to: '/encyclopedia',
      search: { ...filters, diet: value || undefined },
      replace: true,
    })
  }

  const handleSortChange = (value: string) => {
    void navigate({
      to: '/encyclopedia',
      search: {
        ...filters,
        sort: value !== 'name' ? (value as 'rarity' | 'era') : undefined,
      },
      replace: true,
    })
  }

  // ── Prefetch / modal ──────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedDetails, setSelectedDetails] =
    useState<CreatureDetails | null>(null)

  const prefetchCache = useRef<Map<string, CreatureDetails>>(new Map())
  const prefetchInFlight = useRef<Set<string>>(new Set())
  const prefetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelPrefetch = useCallback(() => {
    if (prefetchTimer.current) {
      clearTimeout(prefetchTimer.current)
      prefetchTimer.current = null
    }
  }, [])

  const prefetch = useCallback(
    (id: string) => {
      cancelPrefetch()
      if (prefetchCache.current.has(id) || prefetchInFlight.current.has(id))
        return
      prefetchTimer.current = setTimeout(() => {
        prefetchInFlight.current.add(id)
        getCreatureDetails({ data: id }).then((result) => {
          prefetchInFlight.current.delete(id)
          if (result) prefetchCache.current.set(id, result)
        })
      }, 200)
    },
    [cancelPrefetch],
  )

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

  const allCreatures = [...creatures, ...extraItems]

  const selectedGridItem = selectedId
    ? (allCreatures.find((c) => c.id === selectedId) ?? null)
    : null
  const modalCreature = selectedGridItem
    ? { ...selectedGridItem, ...selectedDetails }
    : null

  // ── Infinite scroll ────────────────────────────────────────────────────────
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const cursorRef = useRef(cursor)
  const loadingMoreRef = useRef(loadingMore)
  const hasMoreRef = useRef(hasMore)

  useEffect(() => {
    cursorRef.current = cursor
  }, [cursor])
  useEffect(() => {
    loadingMoreRef.current = loadingMore
  }, [loadingMore])
  useEffect(() => {
    hasMoreRef.current = hasMore
  }, [hasMore])

  const handleLoadMore = useCallback(async () => {
    if (!cursorRef.current || loadingMoreRef.current || !hasMoreRef.current)
      return
    setLoadingMore(true)
    observerRef.current?.disconnect()
    try {
      const result = await loadMoreCreatures({
        data: { filters, cursor: cursorRef.current },
      })
      setExtraItems((prev) => [...prev, ...result.creatures])
      setHasMore(result.hasMore)
      setCursor(result.nextCursor)
    } finally {
      setLoadingMore(false)
    }
  }, [filters])

  useEffect(() => {
    if (!hasMore) {
      observerRef.current?.disconnect()
      return
    }
    const sentinel = sentinelRef.current
    if (!sentinel) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void handleLoadMore()
        }
      },
      { rootMargin: '200px' },
    )
    observerRef.current.observe(sentinel)
    return () => observerRef.current?.disconnect()
  }, [hasMore, handleLoadMore])

  return (
    <>
      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name or scientific name..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={filters.era || 'all'}
          onValueChange={(v) => handleEraChange(v === 'all' ? '' : v)}
        >
          <SelectTrigger className="w-35">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">All Eras</SelectItem>
            {filterOptions.eras.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.diet || 'all'}
          onValueChange={(v) => handleDietChange(v === 'all' ? '' : v)}
        >
          <SelectTrigger className="w-35">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">All Diets</SelectItem>
            {filterOptions.diets.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.sort} onValueChange={handleSortChange}>
          <SelectTrigger className="w-35">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="rarity">Rarity</SelectItem>
            <SelectItem value="era">Era</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      <div className="columns-2 gap-4 sm:columns-3 md:columns-4 lg:columns-5">
        {allCreatures.map((c) => {
          const rarity = c.rarity as Rarity
          return (
            <button
              key={c.id}
              onMouseEnter={() => prefetch(c.id)}
              onMouseLeave={cancelPrefetch}
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

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-4" aria-hidden="true" />

      {loadingMore && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {/* Modal */}
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
