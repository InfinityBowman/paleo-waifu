# Performance Audit: paleo-waifu

**Audited:** 2026-02-27
**Last updated:** 2026-02-28
**Scope:** Database queries, SSR/hydration, bundle size, image loading, rendering performance, caching strategy, Cloudflare Workers limits

---

## Resolved

| ID  | Original Impact | Issue                                                         | Resolution                                                                                                                                                                         |
| --- | --------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-A | Critical        | Up to 90 sequential D1 round-trips for a 10-pull              | `executePullBatch` collapses to ~7 queries: parallel pool+pity fetch, in-memory pull loop, single batch write (`gacha.ts`)                                                         |
| 7-A | Critical        | Worker timeout / subrequest limit on 10-pull                  | Same as 1-A — ~7 queries total, well under limits                                                                                                                                  |
| 5-A | Critical        | Encyclopedia renders all 393 creatures without virtualization | Server-side cursor pagination (PAGE_SIZE=30) + infinite scroll; `useMemo` for column distribution (`EncyclopediaGrid.tsx`)                                                         |
| 1-B | High            | Extra SELECT for rate-up rarity in every `selectCreature`     | Rate-up rarity derived from pre-fetched pool data — no extra DB query (`gacha.ts:187-188`)                                                                                         |
| 1-C | High            | Missing database indexes                                      | Added: `creature_rarity_idx`, `creature_name_idx`, `creature_era_idx`, `bp_banner_id_idx`, `uc_user_id_idx`, `trade_offer_status/offerer/receiver_idx`, `th_giver/receiver_id_idx` |
| 1-D | High            | Pending trade hydration used N+1 queries                      | Single JOIN query with Drizzle table aliases (`trade.tsx:104-142`)                                                                                                                 |
| 1-E | Medium          | Profile page raw SQL OR without indexes                       | Indexes added on `trade_history.giver_id` and `trade_history.receiver_id`                                                                                                          |
| 1-F | Medium          | Post-insert COUNT for `isNew`                                 | `executePullBatch` checks `isNew` BEFORE inserting + tracks `seenInBatch` for multi-pull dedup (`gacha.ts:342-385`)                                                                |
| 2-A | High            | `defaultPreloadStaleTime: 0` re-fetches on every navigation   | Set to `30_000` (`router.tsx:8`)                                                                                                                                                   |
| 2-B | High            | Encyclopedia `SELECT *` fetches all columns for 393 creatures | Column projection (8 grid columns only) + lazy detail loading via `getCreatureDetails` server function (`encyclopedia.tsx`)                                                        |
| 2-C | Medium          | Double session fetch per auth'd page load                     | Child route loaders now read `context.session` from `_app.tsx` `beforeLoad` — no second `ensureSession()` call                                                                     |
| 5-B | High            | CollectionGrid filter arrays not memoized                     | `useMemo` for `eras` and `filtered`, `useDeferredValue` for search (`CollectionGrid.tsx:41-62`)                                                                                    |
| 7-B | High            | R2 image streaming through Workers wastes CPU/memory          | Image proxy now returns 301 redirect to CDN — Worker does no streaming (`api/images/$.ts:22-28`)                                                                                   |
| 7-D | Low             | Pity snapshot extra round-trip per multi-pull                 | Replaced with atomic increment + post-correction pattern in `executePullBatch` (`gacha.ts:236-376`)                                                                                |

---

## Open

### 2-D — Medium: Redundant `getFossils` query after `deductFossils`

**Location:** `src/routes/api/gacha.ts:103`

`deductFossils` returns the post-deduct balance via `RETURNING` but only uses it for the boolean success check. After pulls succeed, `getFossils` is called again — one extra D1 round-trip per pull request.

**Recommended Fix:** Return the balance from `deductFossils` through the call chain.

---

### 3-A — Medium: `shadcn` in runtime dependencies

**Location:** `package.json:40`

`shadcn` is a CLI code-generation tool but is listed in `dependencies` rather than `devDependencies`.

**Recommended Fix:** Move to `devDependencies`.

---

### 3-B — Medium: Font display strategy not confirmed

**Location:** `package.json:25-26`

Both `@fontsource-variable/fredoka` and `@fontsource-variable/geist` are runtime dependencies. If both load synchronously without `font-display: swap`, they block render.

**Recommended Fix:** Confirm `font-display: swap` in `styles.css`. Consider font preloading.

---

### 4-B — High: Images lack `width`/`height` attributes — CLS

**Location:** `src/components/encyclopedia/EncyclopediaGrid.tsx:365`, `src/components/collection/CollectionGrid.tsx:130`

Images lack explicit `width` and `height` attributes. `imageAspectRatio` on the container and `aspect-3/4` classes help, but `width`/`height` on `<img>` gives the browser intrinsic aspect ratio before CSS loads.

**Recommended Fix:** Add `width` and `height` attributes. Add `decoding="async"`.

---

### 4-C — Medium: CollectionGrid does not use `loading="lazy"`

**Location:** `src/components/collection/CollectionGrid.tsx:130`

Collection images load eagerly. A user with hundreds of creatures triggers many simultaneous image requests.

**Recommended Fix:** Add `loading="lazy"` and `decoding="async"`.

---

### 4-D — Medium: Gacha card reveal images don't preload

**Location:** `src/components/gacha/CardReveal.tsx:69-79`

Image URLs are not rendered until each card's reveal timer fires. In a 10-pull, the last card's image starts loading ~1350ms after the response.

**Recommended Fix:** Preload all pull result images immediately using `new Image()` when `pullResults` lands in the store.

---

### 5-C — Medium: CreatureModal not lazy-loaded

**Location:** `src/components/encyclopedia/EncyclopediaGrid.tsx:7`, `src/components/collection/CollectionGrid.tsx:3`

`CreatureModal` (including Radix Dialog) is bundled with both grid components, even though most users never open it per page load.

**Recommended Fix:** Use `React.lazy()` + `Suspense` to code-split the modal.

---

### 5-D — Low: PullButton subscribes to entire Zustand store

**Location:** `src/components/gacha/PullButton.tsx:19`

```ts
const store = useAppStore()
```

Any store mutation re-renders PullButton even when irrelevant state changed.

**Recommended Fix:** Use granular selectors: `const { setIsPulling, clearPullResults, setPullResults } = useAppStore(s => ({ ... }))`.

---

### 6-A — High: No HTTP caching on any API or SSR response

**Location:** All route handlers

No `Cache-Control` headers on any response. Encyclopedia data (effectively static) gets no browser or edge caching.

**Recommended Fix:**

- Mutation endpoints: `Cache-Control: no-store`
- Encyclopedia SSR: `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400`

---

### 6-B — Medium: `createAuth(env)` re-instantiated on every request

**Location:** `src/lib/auth.ts`

Constructs a full `betterAuth` instance including Drizzle adapter per invocation.

**Recommended Fix:** Cache the instance at module level using a `WeakMap<Env, ReturnType<typeof betterAuth>>`.

---

### 6-C — Low: No caching for banner data

**Location:** `src/routes/_app/gacha.tsx:25`

Active banners fetched on every page load but change very infrequently.

**Recommended Fix:** Use `caches.default` with 60-second TTL.

---

### 7-C — Medium: `createDb(env.DB)` called on every server function

**Location:** `src/lib/db/client.ts:7`

The `drizzle()` constructor processes the full schema on every request.

**Recommended Fix:** Cache the Drizzle instance using a module-level `WeakMap<D1Database, Database>`.

---

## Summary

| Impact   | Total | Resolved | Open |
| -------- | ----- | -------- | ---- |
| Critical | 3     | 3        | 0    |
| High     | 8     | 6        | 2    |
| Medium   | 10    | 4        | 6    |
| Low      | 3     | 2        | 1    |
