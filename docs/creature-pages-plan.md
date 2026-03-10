# Creature Pages & SEO Optimization Plan

## Goal

Make individual creatures accessible via sharable URLs with proper social previews (OG tags), while preserving the current fast modal-based browsing experience in the encyclopedia.

## Current State

- Creatures only exist inside modals on encyclopedia/collection grids
- No individual URLs, no creature-specific OG tags, no deep linking
- Encyclopedia is public and SSR'd, but modal content isn't indexable
- Sitemap is static (only lists main pages)

## Approach: Route Masking (Option C)

TanStack Router has first-class **route masking** support — render one route while displaying a different URL in the browser. This gives us both fast modal browsing AND sharable standalone pages.

### How It Works

1. **`/encyclopedia/$creatureId`** — Standalone full page (for direct visits, SEO, social sharing)
2. **`/encyclopedia/$creatureId/modal`** — Modal overlay on top of the encyclopedia grid
3. **`createRouteMask()`** — Masks the modal route URL to show the page URL in the browser

When a user clicks a creature card in the encyclopedia:

- Navigates to the modal route (fast, stays on grid)
- URL bar shows `/encyclopedia/triceratops` (the standalone page URL)
- If someone copies and shares that URL, the recipient gets the full standalone page with OG tags

### File Structure

```
web/src/routes/_public/
├── encyclopedia.tsx                          # Existing grid page
├── encyclopedia.$creatureId.tsx              # NEW: Standalone creature page
└── encyclopedia.$creatureId.modal.tsx        # NEW: Modal overlay route
```

### Route Mask Config

```tsx
// In router config
import { createRouteMask } from '@tanstack/react-router'

const creatureModalMask = createRouteMask({
  routeTree,
  from: '/encyclopedia/$creatureId/modal',
  to: '/encyclopedia/$creatureId',
  params: (prev) => ({ creatureId: prev.creatureId }),
})

const router = createRouter({
  routeTree,
  routeMasks: [creatureModalMask],
})
```

### SEO: Dynamic head() on Standalone Page

```tsx
export const Route = createFileRoute('/_public/encyclopedia/$creatureId')({
  loader: ({ params }) => getCreatureByIdOrSlug(params.creatureId),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData.name} — PaleoWaifu Encyclopedia` },
      { name: 'description', content: loaderData.description },
      { property: 'og:title', content: loaderData.name },
      { property: 'og:description', content: loaderData.description },
      {
        property: 'og:image',
        content: `https://cdn.jacobmaynard.dev/${loaderData.imageUrl}`,
      },
      { property: 'og:type', content: 'article' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  notFoundComponent: () => <div>Creature not found</div>,
})
```

### Dynamic Sitemap

Update `web/src/routes/sitemap[.]xml.ts` to query all creatures and include them:

```xml
<url>
  <loc>https://paleowaifu.com/encyclopedia/triceratops</loc>
  <changefreq>monthly</changefreq>
</url>
```

## Caching Strategy

Creature data rarely changes — aggressive caching is safe.

### Edge Caching (CDN)

Add `Cache-Control` headers on creature page routes:

```tsx
headers: () => ({
  'Cache-Control':
    'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
})
```

- `max-age=3600` — Browser caches for 1 hour
- `s-maxage=86400` — Cloudflare CDN caches for 1 day
- `stale-while-revalidate=604800` — Serve stale for up to 7 days while revalidating in background

### Client-Side Caching

```tsx
staleTime: 5 * 60_000,   // 5 min before refetching on navigation
gcTime: 30 * 60_000,     // 30 min before garbage collecting from memory
```

### Preloading

TanStack Router supports preloading on hover/intent — creature pages would start loading before the user clicks:

```tsx
<Link to="/encyclopedia/$creatureId" preload="intent" />
```

## Other TanStack Features to Explore

### Prerendering (SSG)

TanStack Start can prerender static routes at build time via `vite.config.ts`:

```ts
prerender: {
  enabled: true,
  crawlLinks: true,
  autoStaticPathsDiscovery: true,
}
```

- Auto-discovers routes **without** path params (landing, encyclopedia grid, leaderboard)
- Dynamic routes like `/encyclopedia/$creatureId` are NOT auto-discovered
- Could potentially enumerate creatures at build time, but CDN caching (ISR-style) is simpler for dynamic routes on Cloudflare

### Streaming SSR

Loaders can return unawaited promises for non-critical data. Server streams HTML as promises resolve:

```tsx
loader: async ({ params }) => {
  const creature = await getCreature(params.creatureId)
  // Don't await — stream these in later
  const ownerCount = getOwnerCount(params.creatureId)
  const battleStats = getBattleWinRate(params.creatureId)
  return { creature, ownerCount, battleStats }
}
```

Use `<Await>` component with a fallback for streamed data:

```tsx
<Await promise={ownerCount} fallback={<Skeleton />}>
  {(count) => <p>{count} trainers own this creature</p>}
</Await>
```

### Selective SSR

Routes can opt into different SSR modes:

- `ssr: true` — Full SSR (default, what creature pages should use)
- `ssr: false` — Client-only rendering (skip SSR entirely)
- `ssr: 'data-only'` — Run loaders on server, render component on client

Auth-gated routes (`_app/*`) could potentially use `ssr: 'data-only'` since they don't need SEO.

### Search Param Middleware

TanStack Router has `retainSearchParams()` and `stripSearchParams()` middleware for controlling search param propagation across routes. Could be useful if filters on the encyclopedia grid (era, rarity, search query) should persist when navigating to/from creature pages.

## Implementation Checklist

- [ ] Create `/encyclopedia/$creatureId` standalone page route
- [ ] Create `/encyclopedia/$creatureId/modal` modal overlay route
- [ ] Add `createRouteMask()` to router config
- [ ] Add `head()` with dynamic OG tags on standalone page
- [ ] Add `Cache-Control` headers for edge caching
- [ ] Add `staleTime` / `gcTime` for client caching
- [ ] Update sitemap to dynamically list all creatures
- [ ] Update encyclopedia grid cards to use masked Link
- [ ] Add `notFoundComponent` for missing creatures
- [ ] Consider: slug-based URLs vs ID-based (e.g., `/encyclopedia/triceratops` vs `/encyclopedia/abc123`)
- [ ] Consider: Discord bot `/pull` responses linking to creature pages
- [ ] Consider: Preloading creature data on hover (`preload="intent"`)
- [ ] Consider: Streaming community stats (owner count, battle win rate) as deferred data

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
