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

### Checklist

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

## Static Prerendering (SSG) — Completed

Configured in `web/vite.config.ts` via `tanstackStart({ prerender: { ... } })`. Requires `@tanstack/react-start` v1.138.0+ (we're on 1.166.6). Works with the Cloudflare Vite plugin — prerendered pages are served as static assets from Workers Assets (zero Worker invocations).

### What's Prerendered

| Route | Why |
|-------|-----|
| `/` | No loader, static hero |
| `/privacy` | No loader, static HTML |
| `/terms` | No loader, static HTML |
| `/patch-notes` | Loader reads build-time markdown (Vite glob) |
| `/patch-notes/$postId` | Auto-discovered via `crawlLinks` from index page links |

### What's Excluded

- **`/encyclopedia`**, **`/leaderboard`** — D1 queries at runtime, filtered out
- **`/encyclopedia/$creatureSlug`** — 600+ pages, CDN `s-maxage` caching already handles this
- **Auth-gated routes** (`/_app/*`, `/admin/*`) — filtered out, no SSG value

### Config

```ts
// web/vite.config.ts
tanstackStart({
  prerender: {
    enabled: true,
    crawlLinks: true,
    filter: ({ path }) => {
      const allowed = ['/', '/privacy', '/terms', '/patch-notes']
      return allowed.includes(path) || path.startsWith('/patch-notes/')
    },
  },
})
```

New patch notes are auto-discovered as they're added to `web/content/updates/` — `crawlLinks` picks them up from the index page.

---

## Selective SSR — Completed

Using `ssr: 'data-only'` per-route (not on layout) so the nav still SSRs and the user sees familiar chrome on refresh. Only applied where it makes a real difference.

### Applied

| Route | Why | Pending Component |
|-------|-----|-------------------|
| `/_app/gacha` | Pull animations conflict with hydration, tiny data payload | Skeleton matching page layout |
| `/admin/analytics` | 14 parallel queries, Recharts is client-only anyway | Skeleton with stat cards + chart placeholders |

### Not Applied (SSR fine as-is)

| Route | Why keep full SSR |
|-------|-------------------|
| `/_app/collection` | Standard grid, benefits from showing content on refresh |
| `/_app/trade` | Standard list/tabs, content visible immediately is better UX |
| `/_app/battle/` | Team builder, but content-on-refresh preferred |
| `/_app/battle/$id` | Shareable replay, could get OG tags later |
| `/_app/profile` | Tiny data, low interactivity |
| `/admin/` | Lightweight stat cards |

### Key Learnings

- Putting `ssr: 'data-only'` on a layout (`_app.tsx`) prevents the **entire layout** from SSR-ing (including Nav), causing a jarring full-page loading state. Apply it on leaf routes instead.
- Child routes inherit parent `ssr` and can only make it **more** restrictive (not less). So `_app` layout must stay `ssr: true` for child routes to have the option.
- `pendingComponent` is rendered server-side as fallback when `ssr` is `false` or `'data-only'`.

---

## Streaming SSR — Future

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
  const collectionLeaderboard = getCollectionLeaderboard() // stream
  const totalSpecies = getTotalSpecies() // stream
  return { xpLeaderboard, collectionLeaderboard, totalSpecies }
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

---

## Other Ideas

### Discord Bot Links

Bot `/pull` responses could include a link to the creature's encyclopedia page:
```
🦕 You pulled **Triceratops** (Legendary)!
🔗 https://paleowaifu.com/encyclopedia/triceratops
```

### Community Stats on Creature Pages

Add owner count and battle win rate as streamed secondary data on creature pages.

### Search Param Middleware

`retainSearchParams()` / `stripSearchParams()` for controlling encyclopedia filter propagation when navigating to/from creature pages.

---

## Reference

TanStack Router docs cloned to `reference/tanstack-router/` (gitignored). Key files:

- `docs/router/guide/route-masking.md` — Route masking API
- `docs/start/framework/react/guide/selective-ssr.md` — Selective SSR docs
- `docs/start/framework/react/guide/static-prerendering.md` — SSG/prerendering
- `docs/start/framework/react/guide/isr.md` — ISR / cache headers
- `docs/start/framework/react/guide/streaming-data-from-server-functions.md` — Streaming SSR
- `docs/start/framework/react/guide/seo.md` — SEO and meta tags
- `examples/react/location-masking/` — Photo modal masking example
