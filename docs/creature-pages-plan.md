# Creature Pages & SSR Optimization Plan

## Creature Pages (Completed)

Individual creatures are accessible via sharable URLs with OG social previews, while preserving fast modal browsing in the encyclopedia.

### How It Works

- **`/encyclopedia/$creatureSlug`** — Standalone full page (direct visits, SEO, social sharing)
- **`/encyclopedia/$creatureSlug/modal`** — Modal overlay on top of the encyclopedia grid
- **`createRouteMask()`** — Masks the modal route URL to show the page URL in the browser

When a user clicks a creature card in the encyclopedia:
1. Navigates to the modal route (fast, stays on grid)
2. URL bar shows `/encyclopedia/triceratops` (the standalone page URL)
3. If someone shares that URL, the recipient gets the full standalone page with OG tags

### Key Files

```
web/src/routes/_public/
├── encyclopedia.tsx                              # Grid page with <Outlet /> for modal
├── encyclopedia_.$creatureSlug.tsx               # Standalone page (non-nested via _ suffix)
└── encyclopedia.$creatureSlug.modal.tsx          # Modal overlay route

web/src/router.tsx                                # Route mask config
web/src/components/encyclopedia/CreatureDetail.tsx # Shared detail component (modal + page)
web/src/lib/slug.ts                               # toSlug() derivation
```

### Implementation Checklist

- [x] Standalone page route with `head()` OG tags
- [x] Modal overlay route with `useCloseModal()` preserving parent search params
- [x] `createRouteMask()` in router config
- [x] `Cache-Control: s-maxage=3600, stale-while-revalidate=86400` on standalone page
- [x] Dynamic sitemap listing all creature slugs from D1
- [x] Grid cards wrapped in `<Link>` with `preload="intent"`
- [x] `notFoundComponent` for missing creatures
- [x] Slug column with unique index, backfill, `toSlug()` utility
- [x] Shared `CreatureDetail` component for both modal and page
- [ ] Route-specific `staleTime` / `gcTime` on creature page loader
- [ ] Discord bot `/pull` responses linking to creature pages

---

## Static Prerendering (SSG)

TanStack Start can prerender routes at build time. Routes with no loader or static-only data are ideal candidates.

### Candidates

| Route | Loader | Change Frequency | Verdict |
|-------|--------|-----------------|---------|
| `/` (landing) | None | Never | **Excellent** — purely static |
| `/privacy` | None | Rarely | **Excellent** — static HTML |
| `/terms` | None | Rarely | **Excellent** — static HTML |
| `/patch-notes` | Markdown glob (build-time) | Infrequent | **Excellent** — static files |
| `/patch-notes/$postId` | Markdown file (build-time) | Never once published | **Excellent** — enumerate at build |
| `/encyclopedia` (default view) | D1 query + filters | Daily | **Partial** — default first page only, filters need dynamic |
| `/encyclopedia/$creatureSlug` | D1 query | Rarely | **Skip** — 600+ pages, CDN caching already handles this well |
| `/leaderboard` | D1 aggregations | Hourly | **Not suitable** — dynamic rankings |

### Recommendation

Prerender the **5 quick wins** (landing, privacy, terms, patch-notes index, individual patch notes). Skip encyclopedia creatures — the existing `s-maxage` CDN caching achieves similar results without bloating build time with 600+ pages.

### Config

```ts
// web/app.config.ts or vite.config.ts
prerender: {
  enabled: true,
  crawlLinks: false,
  routes: [
    '/',
    '/privacy',
    '/terms',
    '/patch-notes',
    // Enumerate patch note posts at build time:
    // ...getUpdatePostSlugs().map(id => `/patch-notes/${id}`)
  ],
}
```

---

## Selective SSR

Auth-gated routes have zero SEO value — no crawler will ever see them. Using `ssr: 'data-only'` (run loaders on server, render component on client) reduces server work and avoids hydration mismatches with interactive components.

### Candidates

| Route | Queries | Interactivity | Data Size | Recommendation |
|-------|---------|---------------|-----------|----------------|
| `/_app/gacha` | 3-4 (banner, fossils, daily) | **Very high** (pull animations, motion) | Tiny | **`ssr: 'data-only'`** — animations fight hydration |
| `/_app/collection` | 3-4 (creatures + abilities) | High (filter, sort, modals) | Medium-large | **`ssr: 'data-only'`** — large result set, no SEO |
| `/_app/trade` | 4-5 parallel (trades, proposals, creatures) | High (tabs, infinite scroll, modals) | Large | **`ssr: 'data-only'`** — paginated, user-specific |
| `/_app/battle/` (arena) | 5-6 (history, teams, creatures, rating, opponents) | Very high (team builder, opponent carousel) | Large | **`ssr: 'data-only'`** — heaviest loader in the app |
| `/_app/battle/$id` (replay) | 3-4 (battle log, teams, ratings) | Medium (replay display) | Medium | **Keep `ssr: true`** — shareable, could get OG tags later |
| `/_app/profile` | 7 parallel aggregates | Low (stats display) | Tiny | **Either** — low impact either way |
| `/admin/analytics` | **14 parallel** aggregates | High (Recharts) | Medium | **`ssr: 'data-only'`** — charts are client-only anyway |
| `/admin/` (dashboard) | 6 count queries | Low (stat cards) | Tiny | **Keep `ssr: true`** — lightweight |

### Priority

1. **`/_app/gacha`** — highest impact, animations conflict with server render
2. **`/_app/battle/`** — heaviest loader, most interactive UI
3. **`/admin/analytics`** — 14 queries, Recharts can't SSR meaningfully
4. **`/_app/collection`** — large data, interactive grid
5. **`/_app/trade`** — complex paginated marketplace

### Implementation

```tsx
// Per-route opt-in, e.g. in gacha.tsx:
export const Route = createFileRoute('/_app/gacha')({
  ssr: 'data-only',
  loader: async () => { /* ... */ },
  component: GachaPage,
})
```

---

## Streaming SSR

Loaders can return unawaited promises for secondary data. Server streams initial HTML immediately, then streams updates as promises resolve. Use `<Await>` with a fallback in the component.

### Best Candidates

**Creature standalone page** — battle stats are secondary:
```tsx
loader: async ({ params }) => {
  const creature = await getCreatureBySlug({ data: params.creatureSlug })
  if (!creature) throw notFound()
  // Don't await — stream battle stats in after initial paint
  const battleStats = creature.id ? getBattleStats(creature.id) : null
  return { ...creature, battleStats }
}
```

**Profile** — arena stats are secondary:
```tsx
loader: async () => {
  const [currency, xp, creatures] = await Promise.all([...]) // critical
  // Stream these in later
  const battleRating = getBattleRating(userId)
  const tradeCount = getTradeCount(userId)
  return { currency, xp, creatures, battleRating, tradeCount }
}
```

**Leaderboard** — two independent tabs, stream the inactive one:
```tsx
loader: async () => {
  const xpLeaderboard = await getXpLeaderboard()  // critical (default tab)
  const collectionLeaderboard = getCollectionLeaderboard() // stream (other tab)
  const totalSpecies = getTotalSpecies() // stream
  return { xpLeaderboard, collectionLeaderboard, totalSpecies }
}
```

**Battle arena** — history is below the fold:
```tsx
loader: async () => {
  const [teams, creatures, rating] = await Promise.all([...]) // critical
  const history = getBattleHistory(userId) // stream (below fold)
  const opponents = findOpponents(rating) // stream (secondary panel)
  return { teams, creatures, rating, history, opponents }
}
```

### Component Pattern

```tsx
import { Await } from '@tanstack/react-router'

function CreaturePage() {
  const { name, description, battleStats } = Route.useLoaderData()
  return (
    <>
      <CreatureHero name={name} description={description} />
      <Await promise={battleStats} fallback={<BattleStatsSkeleton />}>
        {(stats) => stats && <BattleStatsPanel stats={stats} />}
      </Await>
    </>
  )
}
```

### Priority

1. **Creature page** — battle stats deferred (most visible, public SEO page)
2. **Profile** — arena/trade stats deferred (7 queries → 3 critical + 4 streamed)
3. **Leaderboard** — inactive tab deferred (faster first paint)
4. **Battle arena** — history deferred (below fold)

---

## Other Ideas

### Search Param Middleware

`retainSearchParams()` / `stripSearchParams()` for controlling filter propagation. Could be useful if encyclopedia filters (era, rarity, search) should persist when navigating to/from creature pages via back button.

### Discord Bot Links

Bot `/pull` responses could include a link to the creature's encyclopedia page:
```
🦕 You pulled **Triceratops** (Legendary)!
🔗 https://paleowaifu.com/encyclopedia/triceratops
```

### Community Stats on Creature Pages

Add owner count and battle win rate as streamed secondary data:
```tsx
const ownerCount = getOwnerCount(creatureId)     // stream
const battleWinRate = getBattleWinRate(creatureId) // stream
```

---

## Reference

TanStack Router docs cloned to `reference/tanstack-router/` (gitignored). Key files:

- `docs/router/guide/route-masking.md` — Route masking API
- `docs/router/guide/search-params.md` — Search param validation
- `docs/router/guide/document-head-management.md` — Dynamic head/meta tags
- `docs/router/guide/not-found-errors.md` — 404 handling
- `docs/start/framework/react/guide/static-prerendering.md` — SSG/prerendering
- `docs/start/framework/react/guide/isr.md` — ISR / cache headers
- `docs/start/framework/react/guide/streaming-data-from-server-functions.md` — Streaming SSR
- `docs/start/framework/react/guide/seo.md` — SEO and meta tags
- `examples/react/location-masking/` — Photo modal masking example
