# Performance Audit: paleo-waifu

**Audited:** 2026-02-27
**Scope:** Database queries, SSR/hydration, bundle size, image loading, rendering performance, caching strategy, Cloudflare Workers limits

---

## 1. Database Queries

### 1-A — Critical: Sequential per-pull D1 queries — up to 90 round-trips for a 10-pull

**Location:** `src/lib/gacha.ts:224-344`

Each call to `executePull` makes 8-9 sequential D1 round-trips:

1. `SELECT` banner
2. `INSERT` pity counter
3. `UPDATE` pity counter + `RETURNING`
4. `UPDATE` pity counter reset if rare+ (conditional)
5. `SELECT` banner pool + join (inside `selectCreature`)
6. `SELECT` rate-up creature rarity (inside `selectCreature`, when `rateUpId` set)
7. `INSERT` userCreature
8. `SELECT` count of existing user creatures for `isNew`
9. `SELECT` full creature data

For a 10-pull, `executePull` is called 10 times in a serial `for` loop (`src/routes/api/gacha.ts:107-109`). That is up to **90 sequential D1 round-trips in a single request** — estimated 300-500ms in query latency alone.

**Recommended optimization:**

- Hoist banner lookup and pity counter read/init out of `executePull` — do them once before the loop
- Batch all 10 `INSERT INTO user_creature` rows into a single multi-row insert
- Replace per-pull `isNew` COUNT with a single `SELECT creature_id, COUNT(*) GROUP BY creature_id WHERE creature_id IN (...)` after all pulls complete
- Cache creature lookup in memory within the request (same creature may be pulled multiple times)

---

### 1-B — High: Extra SELECT for rate-up rarity inside every `selectCreature`

**Location:** `src/lib/gacha.ts:191-194`

When `rateUpId` is set, the code fetches the rate-up creature's rarity from the database. But the banner pool query already joins on `creature` — the rarity is available via `pool.find(p => p.creatureId === rateUpId)?.rarity`.

**Recommended optimization:** Derive rate-up rarity from the already-fetched pool data. Eliminates one D1 round-trip per pull.

---

### 1-C — High: Missing database indexes

**Location:** `src/lib/db/schema.ts`

Frequently queried columns with no index:

- `banner_pool.banner_id` — queried on every pull
- `creature.rarity` — queried in fallback path and pool join
- `session.userId` — used by better-auth session validation
- `trade_offer.receiver_id` — queried in `withdraw` and `accept` actions

**Recommended optimization:**

```sql
CREATE INDEX bp_banner_id_idx ON banner_pool (banner_id);
CREATE INDEX creature_rarity_idx ON creature (rarity);
CREATE INDEX session_user_id_idx ON session (userId);
CREATE INDEX trade_offer_receiver_idx ON trade_offer (receiver_id);
```

---

### 1-D — High: Two-phase query pattern for pending trades — ✅ RESOLVED

**Location:** `src/routes/_app/trade.tsx`

**Status:** Fixed (2026-02-28). Pending trades now use a single query with Drizzle table aliases (`offererUser`, `receiverUser`, `offeredCreature`, `receiverCreature`) for JOIN-based hydration, matching the open trades pattern. The secondary `Promise.all` hydration pass has been eliminated.

---

### 1-E — Medium: Profile page raw SQL OR without indexes — ✅ PARTIALLY RESOLVED

**Location:** `src/routes/_app/profile.tsx:17-49`, `src/lib/db/schema.ts`

**Status:** Indexes added (2026-02-28). `th_giver_id_idx` on `trade_history.giver_id` and `th_receiver_id_idx` on `trade_history.receiver_id` added via migration `drizzle/0004_red_xorn.sql`. The raw SQL `OR` could still be replaced with Drizzle's `or(eq(...), eq(...))` for consistency.

---

### 1-F — Medium: Post-insert COUNT for `isNew` — extra round-trip

**Location:** `src/lib/gacha.ts:311-322`

After inserting the new `userCreature` row, a `COUNT(*)` query checks if it's new. Could check before the insert instead.

---

## 2. SSR & Hydration

### 2-A — High: `defaultPreloadStaleTime: 0` re-runs all loaders on every navigation

**Location:** `src/router.tsx:7-8`

```ts
defaultPreloadStaleTime: 0,
```

This means preloaded data is immediately stale. Navigating back to `/encyclopedia` re-triggers `getCreatures()` — a full-table scan of 393 rows — even though creature data never changes between page loads.

**Recommended optimization:** Set `defaultPreloadStaleTime` to `30_000` (30 seconds) or longer. For `/encyclopedia`, 5 minutes or more is appropriate. Consider per-route `staleTime` overrides.

---

### 2-B — High: Encyclopedia loader fetches ALL columns for ALL creatures

**Location:** `src/routes/_public/encyclopedia.tsx:10`

```ts
return db.select().from(creature).all()
```

Fetches `description` (multi-sentence text), `funFacts` (JSON array), and other columns not needed by the grid. Estimated 150-300KB payload for 393 creatures.

**Recommended optimization:** Project only grid-required columns: `id`, `name`, `scientificName`, `era`, `diet`, `rarity`, `imageUrl`, `imageAspectRatio`. Load full creature details lazily on modal open via a server function.

---

### 2-C — Medium: Double session fetch on every auth'd page load

**Location:** `src/routes/_app.tsx:6-11`, `src/lib/auth-server.ts`

The `_app` layout's `beforeLoad` calls `getSession()`, then each child route loader calls `ensureSession()` again — two full session lookups per protected page load.

**Recommended optimization:** Pass the resolved session from `_app.tsx`'s `beforeLoad` into the route context. Child route loaders read `context.session` instead of calling `ensureSession()` again.

---

### 2-D — Medium: Redundant `getFossils` query after `deductFossils`

**Location:** `src/routes/api/gacha.ts:141`, `src/lib/gacha.ts:48-63`

After all pulls succeed, `getFossils` is called to return the updated balance. But `deductFossils` already returns the post-deduct balance via `RETURNING` — the value is just discarded.

**Recommended optimization:** Return the balance from `deductFossils` through the call chain instead of querying again.

---

## 3. Bundle Size

### 3-A — Medium: Verify tree-shaking of lucide-react and shadcn

**Location:** `package.json`

`lucide-react` ships individual ESM modules per icon (tree-shakeable). `shadcn` is listed as a runtime dependency but is a CLI tool — should be in `devDependencies`.

**Recommended optimization:** Verify tree-shaking with `pnpm build` and inspect output. Move `shadcn` to `devDependencies`.

---

### 3-B — Medium: Font display strategy not confirmed

**Location:** `package.json:22-23`

Both `@fontsource-variable/fredoka` and `@fontsource-variable/geist` are runtime dependencies. If both load synchronously without `font-display: swap`, they block render.

**Recommended optimization:** Confirm `font-display: swap` in `src/styles.css`. Preload fonts with `<link rel="preload" as="font">` in `__root.tsx`.

---

## 4. Image Loading

### 4-A — High: R2 image proxy has no ETag/304 support

**Location:** `src/routes/api/images/$.ts:1-31`

The proxy sets `Cache-Control: public, max-age=31536000, immutable` but does not set `ETag` or `Last-Modified` response headers, and does not check incoming `If-None-Match` headers. The `R2Object` exposes `object.etag` and `object.uploaded` — these should be used.

More significantly, every image fetch flows through the Worker's 128MB memory limit and CPU time, competing with other requests.

**Recommended optimization:**

- Add `ETag` and `Last-Modified` response headers. Handle `If-None-Match` → `304 Not Modified`.
- Consider enabling R2 public bucket / custom domain to serve images directly from R2's CDN without routing through the Worker at all.

---

### 4-B — High: Images lack `width`/`height` attributes — CLS

**Location:** `src/components/encyclopedia/EncyclopediaGrid.tsx:124-130`

Images lack explicit `width` and `height` attributes. The `imageAspectRatio` style on the container helps, but `width`/`height` on the `<img>` itself gives the browser an intrinsic aspect ratio before CSS loads.

**Recommended optimization:** Add `width` and `height` attributes. Add `decoding="async"`.

---

### 4-C — Medium: CollectionGrid does not use `loading="lazy"`

**Location:** `src/components/collection/CollectionGrid.tsx:115`

Unlike EncyclopediaGrid, collection images load eagerly. A user with 500+ pulls would trigger hundreds of simultaneous image requests.

**Recommended optimization:** Add `loading="lazy"` and `decoding="async"`.

---

### 4-D — Medium: Gacha card reveal images don't preload

**Location:** `src/components/gacha/CardReveal.tsx:69-79`

Image URLs are not rendered in the DOM until each card's reveal timer fires. In a 10-pull, the last card's image doesn't start loading until 1350ms after the response.

**Recommended optimization:** Preload all pull result images as soon as `pullResults` lands in the store using `new Image()`.

---

## 5. Rendering Performance

### 5-A — Critical: Encyclopedia grid renders all 393 creatures with no virtualization

**Location:** `src/components/encyclopedia/EncyclopediaGrid.tsx:103-159`

393 items rendered in a single pass using CSS `columns` masonry layout — roughly 2,000+ DOM nodes. The search filter runs on every render without memoization. Every `setSearch` state update recomputes `eras`, `diets`, and `filtered` arrays.

**Recommended optimization:**

- Add `useMemo` for `eras`, `diets`, and `filtered`
- Add `useDeferredValue` for the `search` state
- Consider `@tanstack/react-virtual` (may require switching from CSS columns to CSS grid for row-based virtualization)

---

### 5-B — High: CollectionGrid has no virtualization or memoization

**Location:** `src/components/collection/CollectionGrid.tsx:41-50`

Same pattern as EncyclopediaGrid — `eras` and `filtered` computed inline every render with no memoization.

**Recommended optimization:** Wrap in `useMemo`. Consider virtualization once collection size grows.

---

### 5-C — Medium: CreatureModal not lazy-loaded

**Location:** `src/components/encyclopedia/EncyclopediaGrid.tsx:6`, `src/components/collection/CollectionGrid.tsx:3`

`CreatureModal` (including Radix Dialog) is always bundled with the grid, even though most users never open it on a given page load.

**Recommended optimization:** Use `React.lazy()` + `Suspense` to code-split the modal.

---

### 5-D — Low: PullButton subscribes to entire Zustand store

**Location:** `src/components/gacha/PullButton.tsx:10`

```ts
const store = useAppStore()
```

Any store mutation re-renders PullButton even when only `pullResults` changed.

**Recommended optimization:** Use granular selectors: `const fossils = useAppStore((s) => s.fossils)`.

---

## 6. Caching Strategy

### 6-A — High: No HTTP caching on any API or SSR response

**Location:** All route handlers

None of the API endpoints set caching headers. SSR responses for `/encyclopedia` (effectively static data) have no `Cache-Control` header.

**Recommended optimization:**

- Mutation endpoints: `Cache-Control: no-store`
- Encyclopedia SSR: `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400`
- Image proxy: use `caches.default` to cache within the edge PoP

---

### 6-B — Medium: `createAuth(env)` re-instantiated on every request

**Location:** `src/lib/auth.ts:6`

Constructs a full `betterAuth` instance including Drizzle adapter on each invocation.

**Recommended optimization:** Cache the instance at module level using a `WeakMap<Env, ReturnType<typeof betterAuth>>`. Workers reuses modules within the same isolate.

---

### 6-C — Low: No caching for banner data

**Location:** `src/routes/_app/gacha.tsx:25-27`

Active banners are fetched on every page load but change very infrequently. Good candidate for `caches.default` with a 60-second TTL.

---

## 7. Cloudflare Workers Limits

### 7-A — Critical: 10-pull gacha can hit Workers subrequest and timeout limits

**Location:** `src/routes/api/gacha.ts:104-110`, `src/lib/gacha.ts:224-344`

Cloudflare D1 has ~50-100 concurrent subrequest limit per Worker invocation. A single 10-pull makes up to 90 sequential D1 calls. If any call is slow, total wall-clock time could exceed 30 seconds (Worker timeout).

**Recommended optimization:** Collapse 90 sequential queries into ~5-10 batched queries using strategies in Finding 1-A.

---

### 7-B — High: R2 image streaming through Workers wastes resources

**Location:** `src/routes/api/images/$.ts:15-26`

Each concurrent image request holds an open connection and consumes CPU time for stream piping. With 393 creatures, initial viewport loading creates dozens of concurrent Worker invocations.

**Recommended optimization:** Enable R2 public access with a custom subdomain. Update `imageUrl` in the database to point directly to the R2 public URL.

---

### 7-C — Medium: `createDb(env.DB)` called on every server function

**Location:** `src/lib/db/client.ts:7`

The `drizzle()` constructor processes the full schema on every request.

**Recommended optimization:** Cache the Drizzle instance using a module-level `WeakMap<D1Database, Database>`.

---

### 7-D — Low: Pity snapshot adds extra D1 round-trip per multi-pull

**Location:** `src/routes/api/gacha.ts:93-102`

The pity state is read before the pull loop for rollback purposes. Rollback is only needed if a pull fails — extremely rare once stable.

**Recommended optimization:** Consider removing the snapshot and using a conservative pity reset on failure instead.

---

## Summary Table

| #   | Impact   | Area           | Issue                                                                                                      |
| --- | -------- | -------------- | ---------------------------------------------------------------------------------------------------------- |
| 1-A | Critical | DB Queries     | Up to 90 sequential D1 round-trips for a 10-pull                                                           |
| 7-A | Critical | Workers Limits | 90 sequential D1 calls risks Worker timeout and subrequest limit                                           |
| 5-A | Critical | Rendering      | 393 items rendered without virtualization                                                                  |
| 1-B | High     | DB Queries     | Extra SELECT for rate-up rarity inside every `selectCreature`                                              |
| 1-C | High     | DB Queries     | Missing indexes on `banner_pool.banner_id`, `creature.rarity`, `session.userId`, `trade_offer.receiver_id` |
| 1-D | ✅ Fixed | DB Queries     | Pending trade hydration now uses single JOIN query                                                          |
| 2-A | High     | SSR            | `defaultPreloadStaleTime: 0` re-runs all loaders on every navigation                                       |
| 2-B | High     | SSR            | `SELECT *` fetches 393 full creature rows for grid view                                                    |
| 4-A | High     | Images         | No ETag/304 support; should bypass Worker with R2 public URL                                               |
| 4-B | High     | Images         | `<img>` tags without `width`/`height` causes CLS                                                           |
| 5-B | High     | Rendering      | CollectionGrid filter arrays not memoized                                                                  |
| 6-A | High     | Caching        | No HTTP caching headers on any response                                                                    |
| 7-B | High     | Workers        | Image streaming through Workers wastes CPU/memory                                                          |
| 1-E | ✅ Fixed | DB Queries     | `trade_history` indexes added; raw SQL OR remains (cosmetic)                                               |
| 1-F | Medium   | DB Queries     | Post-insert COUNT for `isNew` — extra round-trip                                                           |
| 2-C | Medium   | SSR            | Double session fetch per auth'd page load                                                                  |
| 2-D | Medium   | SSR            | Redundant `getFossils` query after deduction                                                               |
| 3-A | Medium   | Bundle         | Verify tree-shaking; `shadcn` in runtime deps                                                              |
| 3-B | Medium   | Bundle         | Font display strategy not confirmed                                                                        |
| 4-C | Medium   | Images         | No `loading="lazy"` on collection images                                                                   |
| 4-D | Medium   | Images         | Gacha card images don't preload                                                                            |
| 5-C | Medium   | Rendering      | CreatureModal not lazy-loaded                                                                              |
| 6-B | Medium   | Caching        | `createAuth(env)` re-instantiated per request                                                              |
| 7-C | Medium   | Workers        | `createDb` called per request — Drizzle not cached                                                         |
| 5-D | Low      | Rendering      | PullButton subscribes to entire Zustand store                                                              |
| 6-C | Low      | Caching        | Banner data not cached                                                                                     |
| 7-D | Low      | Workers        | Pity snapshot adds extra D1 round-trip per multi-pull                                                      |
