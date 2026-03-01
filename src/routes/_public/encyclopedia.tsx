import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq, gt, or, sql } from 'drizzle-orm'
import { getCfEnv } from '@/lib/env'
import { createDb } from '@/lib/db/client'
import { creature } from '@/lib/db/schema'
import { toCdnUrl } from '@/lib/utils'
import { EncyclopediaGrid } from '@/components/encyclopedia/EncyclopediaGrid'

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 30

const RARITY_SORT_SQL = sql<number>`
  CASE ${creature.rarity}
    WHEN 'common'    THEN 0
    WHEN 'uncommon'  THEN 1
    WHEN 'rare'      THEN 2
    WHEN 'epic'      THEN 3
    WHEN 'legendary' THEN 4
    ELSE 99
  END`

const RARITY_RANKS = ['common', 'uncommon', 'rare', 'epic', 'legendary']

// ─── Types ───────────────────────────────────────────────────────────────────

export type EncyclopediaSort = 'name' | 'rarity' | 'era'

export interface EncyclopediaFilters {
  search: string
  era: string
  diet: string
  sort: EncyclopediaSort
}

interface Cursor {
  v: string | number
  id: string
}

// ─── Cursor helpers ──────────────────────────────────────────────────────────

function encodeCursor(c: Cursor): string {
  return btoa(JSON.stringify(c))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

function decodeCursor(s: string): Cursor {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(b64)) as Cursor
}

// ─── LIKE escape ─────────────────────────────────────────────────────────────

function escapeLike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

// ─── Shared query builder ────────────────────────────────────────────────────

async function queryCreaturePage(
  db: Awaited<ReturnType<typeof createDb>>,
  filters: EncyclopediaFilters,
  cursor: Cursor | null,
) {
  const { search, era, diet, sort } = filters
  const conditions = []

  if (search) {
    const escaped = `%${escapeLike(search)}%`
    conditions.push(
      or(
        sql`${creature.name} LIKE ${escaped} ESCAPE '\\'`,
        sql`${creature.scientificName} LIKE ${escaped} ESCAPE '\\'`,
      ),
    )
  }
  if (era) conditions.push(eq(creature.era, era))
  if (diet) conditions.push(eq(creature.diet, diet))

  if (cursor !== null) {
    if (sort === 'name') {
      const v = cursor.v as string
      conditions.push(
        or(
          gt(creature.name, v),
          and(eq(creature.name, v), gt(creature.id, cursor.id)),
        ),
      )
    } else if (sort === 'era') {
      const v = cursor.v as string
      conditions.push(
        or(
          gt(creature.era, v),
          and(eq(creature.era, v), gt(creature.id, cursor.id)),
        ),
      )
    } else {
      const v = cursor.v as number
      conditions.push(
        or(
          sql`${RARITY_SORT_SQL} > ${v}`,
          and(sql`${RARITY_SORT_SQL} = ${v}`, gt(creature.id, cursor.id)),
        ),
      )
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const orderBy =
    sort === 'name'
      ? [asc(creature.name), asc(creature.id)]
      : sort === 'era'
        ? [asc(creature.era), asc(creature.id)]
        : [asc(RARITY_SORT_SQL), asc(creature.id)]

  const rows = await db
    .select({
      id: creature.id,
      name: creature.name,
      scientificName: creature.scientificName,
      era: creature.era,
      diet: creature.diet,
      rarity: creature.rarity,
      imageUrl: creature.imageUrl,
      imageAspectRatio: creature.imageAspectRatio,
    })
    .from(creature)
    .where(whereClause)
    .orderBy(...orderBy)
    .limit(PAGE_SIZE + 1)
    .all()

  const hasMore = rows.length > PAGE_SIZE
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows

  const last = page[page.length - 1]
  const nextCursor: string | null = hasMore
    ? encodeCursor({
        v:
          sort === 'name'
            ? last.name
            : sort === 'era'
              ? last.era
              : Math.max(0, RARITY_RANKS.indexOf(last.rarity)),
        id: last.id,
      })
    : null

  return {
    creatures: page.map((r) => ({ ...r, imageUrl: toCdnUrl(r.imageUrl) })),
    hasMore,
    nextCursor,
  }
}

// ─── Server functions ────────────────────────────────────────────────────────

interface PageInput {
  filters: EncyclopediaFilters
  cursor: string | null
}

const getEncyclopediaPage = createServerFn({ method: 'GET' })
  .inputValidator((d: PageInput) => d)
  .handler(async ({ data }) => {
    const db = await createDb(getCfEnv().DB)
    return queryCreaturePage(
      db,
      data.filters,
      data.cursor ? decodeCursor(data.cursor) : null,
    )
  })

export const loadMoreCreatures = createServerFn({ method: 'GET' })
  .inputValidator((d: PageInput) => d)
  .handler(async ({ data }) => {
    const db = await createDb(getCfEnv().DB)
    return queryCreaturePage(
      db,
      data.filters,
      data.cursor ? decodeCursor(data.cursor) : null,
    )
  })

const getFilterOptions = createServerFn({ method: 'GET' }).handler(async () => {
  const db = await createDb(getCfEnv().DB)
  const [eras, diets] = await Promise.all([
    db
      .selectDistinct({ era: creature.era })
      .from(creature)
      .orderBy(asc(creature.era))
      .all(),
    db
      .selectDistinct({ diet: creature.diet })
      .from(creature)
      .orderBy(asc(creature.diet))
      .all(),
  ])
  return {
    eras: eras.map((r) => r.era),
    diets: diets.map((r) => r.diet),
  }
})

export const getCreatureDetails = createServerFn({ method: 'GET' })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const db = await createDb(getCfEnv().DB)
    const rows = await db
      .select({
        description: creature.description,
        period: creature.period,
        sizeMeters: creature.sizeMeters,
        weightKg: creature.weightKg,
        funFacts: creature.funFacts,
      })
      .from(creature)
      .where(eq(creature.id, id))
    return rows[0] ?? null
  })

// ─── Route ───────────────────────────────────────────────────────────────────

interface EncyclopediaSearch {
  search?: string
  era?: string
  diet?: string
  sort?: EncyclopediaSort
}

export const Route = createFileRoute('/_public/encyclopedia')({
  headers: () => ({
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
  }),

  validateSearch: (raw: Record<string, unknown>): EncyclopediaSearch => ({
    search: typeof raw.search === 'string' ? raw.search : undefined,
    era: typeof raw.era === 'string' ? raw.era : undefined,
    diet: typeof raw.diet === 'string' ? raw.diet : undefined,
    sort:
      raw.sort === 'rarity' || raw.sort === 'era'
        ? (raw.sort as EncyclopediaSort)
        : raw.sort === 'name'
          ? 'name'
          : undefined,
  }),

  loaderDeps: ({ search }) => ({
    search: search.search ?? '',
    era: search.era ?? '',
    diet: search.diet ?? '',
    sort: search.sort ?? 'name',
  }),

  loader: async ({ deps }) => {
    const filters: EncyclopediaFilters = {
      search: deps.search,
      era: deps.era,
      diet: deps.diet,
      sort: deps.sort,
    }
    const [pageResult, filterOptions] = await Promise.all([
      getEncyclopediaPage({ data: { filters, cursor: null } }),
      getFilterOptions(),
    ])
    return { ...pageResult, filterOptions, filters }
  },

  component: EncyclopediaPage,
})

function EncyclopediaPage() {
  const { creatures, hasMore, nextCursor, filterOptions, filters } =
    Route.useLoaderData()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 2xl:max-w-[1600px]">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Encyclopedia</h1>
        <p className="mt-2 text-muted-foreground">
          Discover prehistoric creatures from across the ages.
        </p>
      </div>
      <EncyclopediaGrid
        creatures={creatures}
        hasMore={hasMore}
        initialCursor={nextCursor}
        filterOptions={filterOptions}
        filters={filters}
      />
    </div>
  )
}
