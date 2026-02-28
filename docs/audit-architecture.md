# Architecture Audit: paleo-waifu

**Audited:** 2026-02-27
**Last updated:** 2026-02-28
**Scope:** Project structure, data flow, state management, schema design, API design, component architecture, type safety, error handling, code conventions

---

## Executive Summary

This is a well-structured, modern full-stack application with a coherent architecture. The major systems (auth, gacha mechanics, trading, collection) are logically separated and the developer has made several excellent defensive programming choices (atomic DB updates, batch operations for trade swaps, pity counter snapshot-restore on failure). Since the initial audit, most high-priority items (input validation, env centralization, error boundaries, batched gacha pulls, isNew dedup) have been resolved.

---

## Resolved

| ID  | Original Priority | Issue                                                    | Resolution                                                                                                          |
| --- | ----------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1.1 | Low               | Missing `docs/` directory                                | `docs/` now contains security, performance, and architecture audits plus remediation plan                           |
| 2.2 | Medium            | Encyclopedia loads all columns without pagination        | Column projection (8 grid columns) + cursor-based pagination (PAGE_SIZE=30) + lazy `getCreatureDetails` modal       |
| 2.3 | Medium            | Trade page N+1 hydration for pending trades              | Single JOIN query with Drizzle table aliases (`trade.tsx:104-142`)                                                  |
| 2.4 | Low               | `defaultPreloadStaleTime: 0` causes full re-fetch        | Set to `30_000` (`router.tsx:8`)                                                                                    |
| 3.1 | High              | Fossil count dual source of truth (Zustand + loader)     | Fossils removed from Zustand; gacha page uses `useState(initialFossils)` with `router.invalidate()` after mutations |
| 4.2 | High (partial)    | `tradeOffer.status` type mismatch — `'expired'` unused   | `'expired'` status now set by `expireStaleTradesIfAny`; all five statuses actively used                             |
| 4.3 | Medium            | `isNew` unreliable in multi-pull batches                 | `executePullBatch` checks counts BEFORE insert + tracks `seenInBatch` map for dedup (`gacha.ts:379-385`)            |
| 5.2 | High              | No runtime validation on request bodies                  | Zod `discriminatedUnion` on gacha and trade endpoints (`gacha.ts:22`, `trade.ts:13`)                                |
| 5.4 | Medium            | R2 image key not sanitized                               | Key validation with regex whitelist, `..` block, null byte check (`api/images/$.ts:11-19`)                          |
| 7.1 | High              | Pervasive `env as unknown as Env` double-cast (12 sites) | Centralized `getCfEnv()` helper (`lib/env.ts`)                                                                      |
| 8.1 | Critical          | No React Error Boundaries                                | Root `errorComponent` with retry and home link + `notFoundComponent` (`__root.tsx:34-35`)                           |
| 8.2 | High              | Silent catch blocks swallow errors                       | Trade actions show toast errors (`TradeList.tsx:129-132`); gacha daily claim logs to console (`gacha.tsx:80`)       |
| 8.4 | Medium            | `isNew` check has TOCTOU race                            | Count checked before insert in batched flow (`gacha.ts:342-359`)                                                    |

---

## Open

### 2.1 — Medium: `startOfDay` calculation duplicated

**Location:** `src/lib/gacha.ts:92`, `src/routes/_app/gacha.tsx:35`

The UTC day-boundary calculation `now - (now % 86400)` exists in both `claimDaily()` and `getGachaData()`.

**Recommended Fix:** Extract `getStartOfDayUnix()` into `src/lib/gacha.ts`.

---

### 3.2 — Medium: `pullResults` persist across route navigations

**Location:** `src/store/appStore.ts:14-22`

The `pullResults` array is never cleared on route change. Returning to the gacha page after navigating away shows the previous pull animation.

**Recommended Fix:** Clear `pullResults` in the gacha route's `onLeave` lifecycle hook, or document as intentional.

---

### 3.3 — Low: No devtools integration

**Location:** `src/store/appStore.ts`

No `zustand/middleware` devtools — debugging store state requires manual console.log.

---

### 4.1 — High: `creature.rarity` is unvalidated text

**Location:** `src/lib/db/schema.ts:94`

```typescript
rarity: text('rarity').notNull(), // common | uncommon | rare | epic | legendary
```

No `CHECK` constraint at the database level. Invalid rarity strings pass silently.

**Recommended Fix:** Use Drizzle's enum support:

```typescript
rarity: text('rarity', { enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'] }).notNull(),
```

---

### 4.4 — Medium: `tradeHistory` ownership semantics undocumented

**Location:** `src/lib/db/schema.ts:218-221`

After a trade, `userId` on `userCreature` rows is updated. Trade history records creature instance IDs, but querying "what did user X receive?" requires checking the current `userId` which may have changed in subsequent trades.

**Recommended Fix:** Add a schema comment explaining this trade-off.

---

### 4.5 — Low: `bannerPool` missing composite unique index

**Location:** `src/lib/db/schema.ts:124-136`

Nothing prevents the same creature from being added to a banner pool multiple times, doubling its weighted probability.

**Recommended Fix:** Add `uniqueIndex` on `(bannerId, creatureId)`.

---

### 4.6 — Low: `currency` table missing `createdAt`

**Location:** `src/lib/db/schema.ts:158-169`

Has `updatedAt` but no `createdAt`. Cannot determine when a user first received their starter bonus.

---

### 4.7 — Low: Auth table `updatedAt` only set on INSERT

**Location:** `src/lib/db/schema.ts:22-24`

SQLite has no `ON UPDATE` trigger in Drizzle's ORM layer. `updatedAt` on auth tables never updates after initial insert.

---

### 5.1 — Medium: Action-dispatch pattern instead of RESTful endpoints

**Location:** `src/routes/api/gacha.ts`, `src/routes/api/trade.ts`

Both API routes use a single POST endpoint with an `action` field. For this project's scale the pattern is acceptable given TanStack's file-based routing. Zod validation now mitigates the type safety concern.

**Remaining:** Same URL for all actions — impossible to rate-limit or log by operation type.

---

### 5.3 — Low: `createAuth(env)` called on every request

**Location:** 5+ call sites across the codebase

Constructs a full better-auth instance per request. Inherent to Workers isolation model.

**Recommended Fix:** Add a comment explaining why, or cache per-isolate with a `WeakMap`.

---

### 5.5 — Low: HTTP 402 for "Insufficient fossils"

**Location:** `src/routes/api/gacha.ts:90`

HTTP 402 ("Payment Required") is technically reserved. Use 409 (Conflict) or 422 (Unprocessable Entity) instead.

---

### 6.1 — Low: `DiscordIcon` SVG duplicated

**Location:** `src/components/layout/Nav.tsx:45-51`, `src/components/landing/Hero.tsx`

Identical component defined in two files.

**Recommended Fix:** Extract to `src/components/ui/DiscordIcon.tsx`.

---

### 6.2 — Low: CollectionGrid and EncyclopediaGrid share filter UI pattern

**Location:** `src/components/collection/CollectionGrid.tsx`, `src/components/encyclopedia/EncyclopediaGrid.tsx`

Both implement search input + rarity/era filter selects + card grid with rarity-colored borders. The components have diverged significantly (server-side pagination vs client-side filtering), reducing the duplication concern from the original audit.

**Remaining:** A shared `CreatureCard` display component could still reduce ~30 lines.

---

### 6.3 — Medium: PityCounter shows thresholds only, not actual pity count

**Location:** `src/components/gacha/PityCounter.tsx`

The user's actual pity count (`pullsSinceLegendary`, `pullsSinceRare`) is never loaded from the database.

**Recommended Fix:** Add pity counter data to `getGachaData` loader.

---

### 6.4 — Low: CollectionGrid interface manually maintained

**Location:** `src/components/collection/CollectionGrid.tsx:17-29`

The `CollectionItem` interface is separate from the Drizzle query. Could drift.

**Recommended Fix:** Derive type from query result using `InferSelectModel` or `Awaited<ReturnType<...>>`.

---

### 6.5 — Low: Trade interfaces use `string` instead of `Rarity`

**Location:** `src/components/trade/TradeList.tsx`

Rarity properties typed as `string` instead of the `Rarity` union.

---

### 7.2 — Medium: `rarity` cast without runtime validation

**Location:** `src/components/encyclopedia/EncyclopediaGrid.tsx:343`, `src/components/collection/CollectionGrid.tsx:114`

```typescript
const rarity = item.rarity as Rarity
```

No runtime check that the value is one of five valid values.

---

### 7.3 — Low: `sql<number>` manual cast instead of `countDistinct()`

**Location:** `src/routes/_app/profile.tsx:32`

Uses `sql<number>\`count(distinct ...)\``with a downstream type assertion. Drizzle's`countDistinct()` is properly typed.

---

### 7.4 — Low: `funFacts` stored as raw JSON string

**Location:** `src/lib/db/schema.ts:96`

JSON parsing with try/catch fallback happens in the UI layer.

**Recommended Fix:** Use `text('fun_facts', { mode: 'json' }).$type<Array<string>>()` in the schema.

---

### 8.3 — Medium: Trade confirm cleanup path not batched

**Location:** `src/routes/api/trade.ts:349-368`

The integrity violation cleanup (cancel trade + unlock creatures) uses three sequential `await` calls. If the Worker is interrupted, creatures could remain locked.

**Recommended Fix:** Wrap in `db.batch()` like the success path.

---

### 9.2 — Low: `pnpm format` is a no-op

**Location:** `package.json:20`

```json
"format": "prettier",
```

Executes `prettier` with no arguments — prints usage help, formats nothing.

**Recommended Fix:** Update to `"format": "prettier --write ."`.

---

### 9.3 — Low: Schema queries in route file instead of gacha module

**Location:** `src/routes/_app/gacha.tsx:8`

The route file directly queries `banner` and `currency` tables. The `gacha.ts` module exports pull helpers but not `getActiveBanner` or `canClaimDaily`.

---

### 9.4 — Low: Navigation links duplicated between desktop and mobile Nav

**Location:** `src/components/layout/Nav.tsx`

Link list is duplicated verbatim for desktop and mobile layouts.

**Recommended Fix:** Extract into a `NAV_LINKS` constant array.

---

## Info (No Action Required)

| ID  | Location             | Notes                                                             |
| --- | -------------------- | ----------------------------------------------------------------- |
| 1.2 | `wrangler.jsonc:16`  | Placeholder `database_id` — deployment hygiene, not architectural |
| 1.3 | `drizzle.config.ts`  | Missing comment about `wrangler d1 migrations apply` workflow     |
| 9.1 | `prettier.config.js` | Config file now exists                                            |

---

## Summary

| Priority | Total | Resolved | Open |
| -------- | ----- | -------- | ---- |
| Critical | 1     | 1        | 0    |
| High     | 5     | 4        | 1    |
| Medium   | 13    | 5        | 8    |
| Low      | 14    | 3        | 11   |
