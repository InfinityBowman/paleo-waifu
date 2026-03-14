# Performance Audit — PaleoWaifu

**Date:** 2026-03-12

Consolidated audit across build/bundle, caching/network, database/server, and frontend rendering. Each finding includes a confidence rating based on code verification.

**Confidence scale:** `[Verified]` = read the actual code, confirmed. `[High]` = strong evidence, minor uncertainty. `[Medium]` = reasonable inference, needs testing to confirm. `[Low]` = plausible but speculative.

---

## CRITICAL

### 1. `createDb` fires a PRAGMA on every request — `[Verified]`

**`packages/shared/src/db/client.ts:8`**

`await d1.exec('PRAGMA foreign_keys = ON')` adds a full D1 network round-trip to every single request (API, server function, bot command).

**Caveat:** The original audit claimed "D1 enforces FK constraints at the schema level regardless of this pragma." This is uncertain. Standard SQLite has foreign keys OFF by default and requires `PRAGMA foreign_keys = ON` per-connection. Cloudflare D1 documentation states FK enforcement is enabled by default, but if that's changed or inaccurate, removing this could silently break FK enforcement. **Test before removing** — run `PRAGMA foreign_keys` on D1 without setting it first to see if it returns `1`.

**Fix:** If D1 enforces FKs by default, remove the PRAGMA entirely. If not, consider whether the extra round-trip is worth the safety guarantee.

---

### 2. `createAuth` instantiates `betterAuth()` on every request — `[Verified, fix is wrong]`

**`web/src/lib/auth.ts:7`**

Called from every auth-requiring API route. It constructs plugin chains, adapter bindings, and OAuth configs each time. Also calls `createDb` internally, meaning 2 D1 PRAGMA round-trips per auth-requiring request (if #1 is kept).

**Caveat:** The original audit suggested memoizing at module level. This is **risky in Cloudflare Workers** — `env` (including D1 bindings) is request-scoped. A module-level singleton would reuse the D1 binding from the first request for all subsequent requests in the same isolate. While this likely works in practice (bindings are stable within an isolate), it's not officially guaranteed by Cloudflare and could cause subtle bugs.

**Fix:** The safest optimization is to avoid calling `createAuth` + `createDb` separately in API routes that also need a `db` instance. Instead, create `db` once and pass it into auth. This saves the duplicate PRAGMA call at minimum. Full memoization of `betterAuth()` is a judgment call — it would save object construction overhead but introduces binding-lifetime risk.

---

### 3. ~~No `defaultPreload` on the router~~ — `[FIXED]`

Added `defaultPreload: 'intent'` to `web/src/router.tsx`. Route loader data is now prefetched on hover/focus before the user clicks.

---

## HIGH

### 4. ~~`motion` library bundled into every route that uses `<Tabs>`~~ — `[FIXED]`

**`web/src/components/ui/tabs.tsx`**

`GlassPill` (which imports `motion/react`) was extracted to `web/src/components/ui/GlassPill.tsx` and lazy-loaded via `React.lazy` + `Suspense`, only triggered when `variant === 'glass'`.

**Before:** `leaderboard`, `trade`, `users.$userId`, `main`, and `tabs` all statically depended on the 120KB motion proxy chunk.
**After:** Those routes have zero references to the motion chunk. Motion is only loaded when a `glass`-variant `TabsList` renders (battle and gacha routes, which already import motion directly for animations).

---

### 5. No `React.lazy` for heavy intra-route components — `[High]`

- `recharts` (~200KB) statically imported in `admin/analytics.tsx`
- `motion/react` statically imported in `gacha.tsx` via `PullAnimation`
- `CreaturePickerModal` statically imported in `trade.tsx` (only opened on button click)

**Caveat:** TanStack Start does file-based route splitting, so these are in separate route chunks. The concern is about intra-route splitting — whether `PullAnimation` (and thus `motion`) could be deferred until a pull actually happens, etc. Actual bundle impact should be verified with `pnpm build` + chunk analysis. The admin route is only visited by admins, so `recharts` being in its chunk may not matter in practice.

**Fix:** Use `React.lazy` + `Suspense` for `PullAnimation` and `CreaturePickerModal`. `recharts` in admin is lower priority.

---

### 6. Collection page renders entire collection with no rendering optimization — `[Verified]`

**`web/src/components/collection/CollectionGrid.tsx`**

The server function loads all of a user's creatures, and the component renders them all as DOM nodes. A user with 500 cards = 500 DOM nodes simultaneously.

**Fix:** Apply `content-visibility: auto` with `contain-intrinsic-size` to each card. This is a CSS-only solution — the browser skips layout/paint for off-screen cards while keeping DOM nodes intact (Cmd+F, accessibility, and existing masonry/filter logic all work unchanged). No JS library needed.

```css
.creature-card {
  content-visibility: auto;
  contain-intrinsic-size: auto 300px;
}
```

Full JS virtualization (`@tanstack/react-virtual`) would be overkill unless collections reach thousands of cards. `content-visibility` gets most of the rendering savings with zero complexity. Severity depends on typical collection sizes — if most users have <100 cards, this is less urgent.

---

### 7. `Nav.getBadges` fires on every route change — `[Verified]`

**`web/src/components/layout/Nav.tsx:78-86`**

```tsx
useEffect(() => {
  if (!session) { setBadges(null); return }
  getBadges().then(setBadges).catch(() => setBadges(null))
}, [session, location.pathname])
```

Every `location.pathname` change triggers a server function call → D1 query. No throttle, no cache.

**Fix:** Add a stale-time guard or use TanStack Query.

---

### 8. ~~Redundant `getFossils` query after pulls~~ — `[FIXED]`

`deductFossils` now returns `number | null` (new balance or null if insufficient) instead of a boolean. Both `web/src/routes/api/gacha.ts` and `bot/src/commands/pull.ts` updated to use the returned balance directly on the success path. Saves 1 D1 query per pull.

---

### 9. ~~`isCreatureInTrade` uses 2 sequential queries~~ — `[FIXED]`

Wrapped the two queries in `Promise.all` in `web/src/lib/trade-locks.ts`, matching the pattern already used by `getLockedCreatureIds` in the same file.

---

### 10. Trade expiry runs on every page load — `[High]`

**`web/src/routes/_app/trade.tsx:45-76`**

`expireStaleTradesIfAny` runs a SELECT (and potentially batch UPDATE) on every trade page visit by any user.

**Caveat:** Did not verify the exact line numbers — the agent reported these but I didn't read this file directly. Pattern is plausible given the architecture.

**Fix:** Move to a Cloudflare Cron Trigger or add a time-based guard (only check every N minutes).

---

## MEDIUM — Build & Bundle

### 11. No `manualChunks` in Vite config — `[Medium]`

**`web/vite.config.ts`**

No `build` block. Rollup's heuristic controls chunk splitting.

**Caveat:** TanStack Start + `@cloudflare/vite-plugin` may handle chunk splitting differently than vanilla Vite. The actual chunk layout should be verified with a production build before adding `manualChunks`, which can conflict with framework-level splitting.

---

### 12. Unused dependencies — `[Verified / High]`

- `next-themes` — **[Already removed]** was not in `package.json` at time of fix.
- `shadcn` in `dependencies` — **[High]** `styles.css` imports `shadcn/tailwind.css` (line 3). This CSS import is resolved at build time by Tailwind, so `shadcn` in `devDependencies` should work. Test the build after moving it.

---

### 13. `ALL_ABILITY_TEMPLATES` at module scope may leak to client — `[Medium]`

**`collection.tsx:5,17`, `encyclopedia.tsx:5,214`, `battle.index.tsx:6,27`**

`TEMPLATE_MAP` is declared at module scope as `new Map(ALL_ABILITY_TEMPLATES.map(...))`. It's only *used* inside `createServerFn` handlers. TanStack Start replaces server function bodies with proxies on the client, but module-scope declarations with side effects (like `new Map(...)`) may survive tree-shaking.

**Caveat:** This needs verification with a production build + bundle analysis. TanStack Start's server function extraction may or may not eliminate module-scope code that's only referenced by server handlers.

---

### 14. `marked` in client bundle — `[High]`

**`web/src/components/updates/MarkdownRenderer.tsx`**

`marked` is imported in a client component. Patch notes pages are prerendered (static), so the markdown could be parsed at build time.

**Caveat:** If the component is only used in prerendered routes, the `marked` chunk may only be loaded when navigating to a patch note. Impact depends on whether users commonly visit patch notes.

---

### ~~15. `verbatimModuleSyntax: false`~~ — `[Low — Overstated]`

**`web/tsconfig.json:14`**

**Correction:** This setting only affects `tsc` output. Since Vite uses esbuild to transform TypeScript (not `tsc`), esbuild does its own import analysis regardless of this setting. The practical bundle impact is **near zero**. Setting it to `true` is a good TypeScript hygiene practice but won't measurably affect bundle size.

---

## MEDIUM — Caching & Network

### 16. ~~Missing cache headers on static content pages~~ — `[FIXED]`

Added `headers: () => ({ 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' })` to `/patch-notes/$postId`, `/privacy`, and `/terms`.

---

### 17. ~~No `preconnect` for the image CDN~~ — `[FIXED]`

Added `<link rel="preconnect" href="https://cdn.paleowaifu.com" crossorigin="anonymous">` to `web/src/routes/__root.tsx`.

---

### 18. No `fetchpriority="high"` on LCP images — `[High]`

All creature images default to `loading="lazy"`. First-visible cards are LCP candidates.

---

### 19. No `width`/`height` on creature images — `[High]`

Causes layout shift. The `imageAspectRatio` field exists in the DB and is used for `aspectRatio` CSS, which partially mitigates CLS.

---

### ~~20. 6 Google Font families, 2 unused~~ — `[WRONG — Corrected]`

**Original claim:** `Bangers` and `Permanent Marker` appear in no component.

**Correction:** Both fonts are used extensively in `web/src/components/battle/BattleTransition.tsx` — `Bangers` appears 8 times, `Permanent Marker` 5 times, applied via inline `fontFamily` style. **This finding was incorrect.** The fonts are needed.

**Revised finding:** The 14 font weight/family combinations are potentially heavy (especially for CJK-range fonts like M PLUS Rounded 1c and Shippori Mincho with 5 weights each). Consider whether all 5 weights of each are actually used in the CSS. Lower-priority optimization.

---

### 21. ~~No WebP/AVIF image serving~~ — `[N/A]`

**Original claim:** Creature images served as PNG/JPEG with no format optimization.

**Correction:** All 615 creature images are already WebP (converted by the Python pipeline at quality=85). No PNG/JPEG originals exist in R2. WebP is supported by all modern browsers (Safari 14+, Sept 2020). No format change needed. A future optimization would be generating responsive `srcset` size variants (400w, 800w) to reduce mobile bandwidth, but that's a pipeline change separate from format.

---

### 22. ~~`favicon.svg` and `og-image.png` have no cache rules~~ — `[FIXED]`

Added to `web/public/_headers`: `/favicon.svg` with `max-age=86400`, `/og-image.png` with `max-age=604800, immutable`.

---

## MEDIUM — Database & Server

### 23. ~~Gacha loader fires 2 queries to the same `currency` row~~ — `[FIXED]`

Merged `getFossils` and `lastDailyClaim` into a single `select({ fossils, lastDailyClaim })` query in `web/src/routes/_app/gacha.tsx`. Loader now fires 2 parallel queries instead of 3.

---

### 24. Missing database indexes — `[Medium]`

| Table | Missing Index | Affected Query | Confidence |
|-------|--------------|----------------|------------|
| `battleTeam` | `slot` alone | `findArenaOpponents` | Medium — didn't verify the query directly |
| `userCreature` | `(userId, creatureId)` | `existingCounts` in gacha | Medium |
| `tradeOffer` | `offeredCreatureId` | `isCreatureInTrade` | High — verified the query |
| `tradeProposal` | `proposerCreatureId` | `isCreatureInTrade` | High — verified the query |

**Caveat:** With a small user base, missing indexes have negligible impact. These matter as scale grows.

---

### 25. Multiple `select()` without field restriction — `[High]`

Agent reported specific locations. The pattern is common in Drizzle codebases. The `user` table having auth tokens fetched unnecessarily is the biggest concern (data over the wire + potential security surface).

---

### 26. `searchUsers` uses unindexed `LIKE '%query%'` — `[High]`

Leading wildcard prevents index use. Impact scales with user table size.

---

## MEDIUM — Frontend Rendering

### 27. Hero canvas loop runs when tab is hidden — `[High]`

Canvas `requestAnimationFrame` loops without a `visibilitychange` guard is a well-known pattern issue. Did not read the Hero file directly but the agent cited specific line numbers.

---

### 28. `PullButton` subscribes to the entire Zustand store — `[Verified]`

**`web/src/components/gacha/PullButton.tsx:19`**

`const store = useAppStore()` — then only uses `store.setIsPulling`, `store.clearPullResults`, and `store.setPullResults` (action methods). The component re-renders whenever `pullResults` changes in the store, but it doesn't read `pullResults` in its render output.

**Caveat:** In practice, `PullButton` is a single small component on one page. The unnecessary re-renders during a pull sequence are masked by the pull animation. Low real-world impact.

---

### 29. `CreatureCard` not memoized — `[High]`

**Caveat:** React 19's compiler (if enabled) handles this automatically. Check if the React compiler is active in the Vite config — if it is, manual `React.memo` is unnecessary and potentially counterproductive.

---

### 30. Collection search has no debounce — `[High]`

The encyclopedia grid debounces at 350ms but the collection grid doesn't. Since collection filtering is client-side only (no server call), the cost is `Array.filter` on each keypress. Only noticeable with large collections.

---

### 31. Hero resize handler has no debounce — `[High]`

Standard canvas performance pattern. Low real-world impact (users rarely drag-resize).

---

### 32. `Math.random()` in Hero render — `[High]`

Stars get new random positions on re-render. The Hero only re-renders when `session` changes (auth hydration), so this happens at most once per page load. Low real-world impact.

---

### 33. `transition: all` on Hero era cards — `[High]`

A minor CSS optimization. Real-world impact is negligible on modern browsers.

---

## LOW

| # | Finding | Location | Confidence |
|---|---------|----------|------------|
| 34 | `router.invalidate()` flushes all loader caches after every pull | `gacha.tsx:133,205` | High |
| 35 | `JSON.parse(funFacts)` in render without `useMemo` | `CreatureModal.tsx:97` | High |
| 36 | `allCreatures` spread recreated every render | `EncyclopediaGrid.tsx:115` | High |
| 37 | Particle `useMemo([], [])` could be module constants | `PullAnimation.tsx` | High |
| 38 | No `defaultPendingMs`/`defaultPendingMinMs` on router | `router.tsx` | Verified |
| 39 | Battle-specific CSS keyframes in global `styles.css` | `styles.css` | High |
| 40 | No Wrangler `minify: true` for server bundle | `wrangler.jsonc` | Medium |
| 41 | Redundant `X-Frame-Options` with CSP `frame-ancestors` | `__root.tsx` | High |
| 42 | 6 admin `count(*)` queries could be 1 with CTEs | `admin/index.tsx` | High |

---

## Findings Removed or Corrected

| # | Original Claim | Correction |
|---|---------------|------------|
| 20 | Bangers and Permanent Marker fonts unused | **WRONG** — both used in `BattleTransition.tsx` |
| 2 | Memoize `createAuth` at module level | **Fix is risky** — `env` is request-scoped in CF Workers |
| 1 | D1 enforces FKs without PRAGMA | **Uncertain** — SQLite default is OFF, D1 docs say ON, needs testing |
| 15 | `verbatimModuleSyntax` affects bundle size | **Overstated** — esbuild ignores this setting |

---

## Revised Top 10 Quickest Wins

1. **Add `defaultPreload: 'intent'`** `[Verified]` — 1 line, instant navigation feel
2. **Return fossil count from `deductFossils`** `[Verified]` — saves 1 query per pull
3. **Parallelize `isCreatureInTrade`** `[Verified]` — `Promise.all`, saves sequential D1 trips
4. **Merge gacha currency queries** `[Verified]` — combine 2 SELECTs into 1
5. **Add CDN preconnect** `[High]` — 1 line, faster image loads
6. **Remove `next-themes`** `[Verified]` — dead dependency
7. **Move `shadcn` to devDeps** `[High]` — test build after
8. **Add cache headers to static pages** `[High]` — 3 lines across 3 route files
9. **Debounce collection search** `[High]` — match encyclopedia's 350ms pattern
10. **Test PRAGMA necessity, remove if safe** `[Medium]` — saves 1 D1 round-trip per request
