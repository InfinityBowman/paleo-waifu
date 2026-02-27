# Architecture Audit: paleo-waifu

**Audited:** 2026-02-27
**Scope:** Project structure, data flow, state management, schema design, API design, component architecture, type safety, error handling, code conventions

---

## Executive Summary

This is a well-structured, modern full-stack application with a coherent architecture. The major systems (auth, gacha mechanics, trading, collection) are logically separated and the developer has made several excellent defensive programming choices (atomic DB updates, batch operations for trade swaps, pity counter snapshot-restore on failure). The primary concerns center on type safety shortcuts, missing database constraints, error handling gaps, and a few data flow redundancies.

---

## 1. Project Structure

### 1.1 — Low: Missing `docs/` directory

**Location:** Repository root

No architectural documentation, ADRs, or API docs beyond `CLAUDE.md`.

**Recommendation:** Populate `docs/` with this audit, a data model ERD, and a gacha mechanics spec. Document the trade state machine.

---

### 1.2 — Low: `wrangler.jsonc` contains placeholder `database_id`

**Location:** `wrangler.jsonc:16`

```jsonc
"database_id": "REPLACE_ME",
```

Would cause immediate failure on `pnpm deploy` for a new contributor.

**Recommendation:** Add a comment directing contributors to run `wrangler d1 create` and paste the ID. Consider a pre-deploy check script.

---

### 1.3 — Low: `drizzle.config.ts` lacks explanatory comment

**Location:** `drizzle.config.ts`

Missing documentation that `drizzle-kit generate` produces SQL files only and `wrangler d1 migrations apply` is always the deployment mechanism.

---

## 2. Data Flow

The data flow follows a clean, linear pattern:

```
D1 → Drizzle ORM → Server functions / API routes → Route loaders → React components → Zustand (ephemeral)
```

### 2.1 — Medium: `startOfDay` calculation duplicated

**Location:** `src/lib/gacha.ts:85-86`, `src/routes/_app/gacha.tsx:35-40`

The "start of day" UTC calculation exists in both `claimDaily()` and `getGachaData()`. If the definition of "day reset" changes, it must be updated in two places.

**Recommendation:** Extract `isBeforeStartOfDay(timestamp)` into a shared utility in `src/lib/gacha.ts`.

---

### 2.2 — Medium: Encyclopedia loads all columns without pagination

**Location:** `src/routes/_public/encyclopedia.tsx:10`

`db.select().from(creature).all()` fetches all columns including `description` and `funFacts` — not needed by the grid view.

**Recommendation:** Use column projection for the list view. Load full details lazily on modal open.

---

### 2.3 — Medium: Trade page hydrates pending trades with N+1-style logic

**Location:** `src/routes/_app/trade.tsx:77-142`

The initial open trades query uses `innerJoin` to hydrate creature data, but the pending trades query fetches raw IDs then re-hydrates — an inconsistency.

**Recommendation:** Refactor pending trades query to use joins like the open trades query. Eliminates ~50 lines and the secondary fetch.

---

### 2.4 — Low: `defaultPreloadStaleTime: 0` causes full re-fetch on every navigation

**Location:** `src/router.tsx:8`

Defensive setting preventing stale data — acceptable for a game. But encyclopedia creature data is essentially static.

**Recommendation:** Keep default, but consider per-route `staleTime` overrides on encyclopedia.

---

## 3. State Management

### 3.1 — High: Fossil count has dual source of truth

**Location:** `src/store/appStore.ts`, `src/routes/_app/gacha.tsx:53-67`

```typescript
const storeFossils = useAppStore((s) => s.fossils)
useEffect(() => { setFossils(initialFossils) }, [initialFossils, setFossils])
const displayFossils = storeFossils ?? initialFossils
```

The "seed Zustand from loader, prefer Zustand for display" pattern creates divergence risk. If fossils change outside the gacha page (e.g., future trade costs), the store will be stale.

**Recommendation:** Remove `fossils` from Zustand. Use `useLoaderData()` directly and `router.invalidate()` after mutations. Keep Zustand only for ephemeral UI state (`isPulling`, `pullResults`).

---

### 3.2 — Medium: `pullResults` persist across route navigations

**Location:** `src/store/appStore.ts:22-26`

The `pullResults` array is never cleared on route change. Returning to the gacha page after navigating away shows the old pull animation.

**Recommendation:** Clear `pullResults` in the gacha route's `onLeave` lifecycle hook, or document as intentional.

---

### 3.3 — Low: No devtools integration

**Location:** `src/store/appStore.ts`

No `zustand/middleware` devtools — debugging store state requires manual console.log.

**Recommendation:** Add `devtools` middleware gated behind `import.meta.env.DEV`.

---

## 4. Schema Design

### 4.1 — High: `creature.rarity` is unvalidated text

**Location:** `src/lib/db/schema.ts:92`

```typescript
rarity: text('rarity').notNull(), // common | uncommon | rare | epic | legendary
```

No `CHECK` constraint at the database level. Invalid rarity strings would pass silently and cause runtime errors in components that cast `rarity as Rarity`.

**Recommendation:** Use Drizzle's enum support:
```typescript
rarity: text('rarity', { enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'] }).notNull(),
```

---

### 4.2 — High: `tradeOffer.status` is unvalidated text with type mismatch

**Location:** `src/lib/db/schema.ts:193`

The `TradeStatus` type in `src/lib/types.ts` includes `'expired'`, but no code path ever sets `status = 'expired'`. The schema comment does not list `'expired'`.

**Recommendation:** Either implement expiry logic or remove `'expired'` from the TypeScript type. Apply an enum constraint.

---

### 4.3 — Medium: `isNew` unreliable in multi-pull batches

**Location:** `src/lib/db/schema.ts:126-144`, `src/lib/gacha.ts:312-322`

The `user_creature` table allows duplicates (intentional — users can own multiple copies). But during a 10-pull, if the same creature appears twice, both occurrences report `isNew = true` because inserts happen before either count query resolves.

**Recommendation:** Document the multi-copy design. Pass a set of already-seen `creatureId`s through the batch loop.

---

### 4.4 — Medium: `tradeHistory` ownership semantics undocumented

**Location:** `src/lib/db/schema.ts:218-221`

After a trade, `userId` on `userCreature` rows is updated. Trade history records creature instance IDs, but querying "what did user X receive?" requires checking the current `userId` which may have changed in subsequent trades.

**Recommendation:** Add a schema comment explaining this trade-off.

---

### 4.5 — Low: `bannerPool` missing composite unique index

**Location:** `src/lib/db/schema.ts:116-124`

Nothing prevents the same creature from being added to a banner pool multiple times, which would double its weighted probability.

**Recommendation:** Add `uniqueIndex` on `(bannerId, creatureId)`.

---

### 4.6 — Low: `currency` table missing `createdAt`

**Location:** `src/lib/db/schema.ts:146-157`

Has `updatedAt` but no `createdAt`. Cannot determine when a user first received their starter bonus.

---

### 4.7 — Low: Auth table `updatedAt` only set on INSERT

**Location:** `src/lib/db/schema.ts:22-24`

SQLite has no `ON UPDATE` trigger in Drizzle's ORM layer. `updatedAt` on auth tables never updates after initial insert. For game tables like `currency`, verify all update paths set `updatedAt` explicitly — `gacha.ts` does this correctly.

---

## 5. API Design

### 5.1 — High: Action-dispatch pattern instead of RESTful endpoints

**Location:** `src/routes/api/gacha.ts`, `src/routes/api/trade.ts`

Both API routes use a single POST endpoint with an `action` field. Drawbacks:

1. Not RESTful — HTTP semantics (405, 201/204) not leveraged
2. Same URL for all actions — impossible to rate-limit by operation or filter logs
3. Request body type cast unsafely

**Recommendation:** For this project's scale, the pattern is acceptable given TanStack's file-based routing. Add runtime validation (Zod). Long-term, consider separate route files per action.

---

### 5.2 — High: No input validation on request bodies

**Location:** `src/routes/api/gacha.ts:34`, `src/routes/api/trade.ts:28`

Request bodies are cast with TypeScript `as` assertions. Malformed JSON produces unhandled 500 errors.

**Recommendation:** Wrap `request.json()` in try/catch. Add Zod validation:

```typescript
const schema = z.object({ action: z.string(), bannerId: z.string().optional() })
const body = schema.safeParse(await request.json())
if (!body.success) return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 })
```

---

### 5.3 — Medium: `createAuth(env)` called on every request

**Location:** 5+ call sites across the codebase

Constructs a full better-auth instance per request. Inherent to Workers isolation model — the current approach is correct.

**Recommendation:** Add a comment explaining why memoization is not applicable.

---

### 5.4 — Medium: R2 image key not sanitized

**Location:** `src/routes/api/images/$.ts:8-10`

No path traversal validation on the derived R2 key.

**Recommendation:** Validate against a whitelist pattern:
```typescript
if (!key || !/^[a-zA-Z0-9_\-./]+$/.test(key) || key.includes('..')) {
  return new Response('Not found', { status: 404 })
}
```

---

### 5.5 — Low: HTTP 402 for "Insufficient fossils"

**Location:** `src/routes/api/gacha.ts:88`

HTTP 402 ("Payment Required") is technically reserved. Use 409 (Conflict) or 422 (Unprocessable Entity) instead.

---

## 6. Component Architecture

### 6.1 — Medium: `DiscordIcon` SVG duplicated

**Location:** `src/components/layout/Nav.tsx:45-51`, `src/components/landing/Hero.tsx:17-23`

Identical component defined in two files.

**Recommendation:** Extract to `src/components/ui/DiscordIcon.tsx`.

---

### 6.2 — Medium: CollectionGrid and EncyclopediaGrid share ~60% duplicated code

**Location:** `src/components/collection/CollectionGrid.tsx`, `src/components/encyclopedia/EncyclopediaGrid.tsx`

Both implement: search input, rarity/era filter selects, client-side `.filter()`, card grid with rarity-colored borders.

**Recommendation:** Extract a shared `CreatureFilterBar` component and a `CreatureCard` component with a `variant` prop.

---

### 6.3 — Medium: PityCounter shows thresholds only, not actual pity count

**Location:** `src/components/gacha/PityCounter.tsx`

Despite being named `PityCounter`, this component only shows the thresholds (50/90). The user's actual pity count (`pullsSinceLegendary`, `pullsSinceRare`) is never loaded.

**Recommendation:** Add pity counter data to `getGachaData` loader and pass it to the component.

---

### 6.4 — Low: CollectionGrid interface manually maintained

**Location:** `src/components/collection/CollectionGrid.tsx:17-29`

The `CollectionItem` interface is separate from the Drizzle query. The query selects `pulledAt` but the interface does not include it.

**Recommendation:** Derive type from query result or use `InferSelectModel`.

---

### 6.5 — Low: Trade interfaces use `string` instead of `Rarity`

**Location:** `src/components/trade/TradeList.tsx:32-35`

Rarity properties typed as `string` instead of the `Rarity` union, requiring unsafe casts at consumption sites.

---

## 7. Type Safety

### 7.1 — High: Pervasive `env as unknown as Env` double cast

**Location:** 12 occurrences across the codebase

Every server function casts through `unknown` to the local `Env` interface. If a binding is renamed in `wrangler.jsonc` but not in `src/env.d.ts`, TypeScript won't catch it.

**Recommendation:** Centralize the cast in one helper:
```typescript
import { env as cfWorkerEnv } from 'cloudflare:workers'
export function getCfEnv(): Env {
  return cfWorkerEnv as unknown as Env
}
```

---

### 7.2 — Medium: `rarity` cast without runtime validation

**Location:** `src/lib/gacha.ts:337`

```typescript
rarity: creatureData.rarity as Rarity,
```

No runtime check that the value is one of five valid values.

**Recommendation:** Add a runtime assertion helper:
```typescript
function assertRarity(value: string): Rarity {
  if (!RARITIES.includes(value as Rarity)) throw new Error(`Invalid rarity: ${value}`)
  return value as Rarity
}
```

---

### 7.3 — Medium: `sql<number>` manual cast instead of `countDistinct()`

**Location:** `src/routes/_app/profile.tsx:35-38`

Uses `sql<number>\`count(distinct ...)\`` with a downstream type assertion. Drizzle's `countDistinct()` is properly typed.

**Recommendation:** Use `countDistinct(userCreature.creatureId)` from `drizzle-orm`.

---

### 7.4 — Low: `funFacts` stored as raw JSON string

**Location:** `src/lib/db/schema.ts:94`, `src/components/collection/CreatureModal.tsx:49-58`

JSON parsing with try/catch fallback happens in the UI layer.

**Recommendation:** Use `text('fun_facts', { mode: 'json' }).$type<Array<string>>()` in the schema.

---

## 8. Error Handling

### 8.1 — Critical: No React Error Boundaries

**Location:** All route components

No Error Boundaries anywhere. If any component throws during rendering, the entire React tree unmounts — blank white screen with no recovery. TanStack Router supports `errorComponent` at the route level but none are defined.

**Recommendation:**
```typescript
// src/routes/__root.tsx
export const Route = createRootRoute({
  errorComponent: ({ error }) => (
    <div>
      <h1>Something went wrong</h1>
      <p>{error.message}</p>
      <Link to="/">Go home</Link>
    </div>
  ),
})
```

Add `pendingComponent` to routes with server function loaders for skeleton loading states.

---

### 8.2 — High: Silent catch blocks swallow errors

**Location:**
- `src/routes/_app/gacha.tsx:82`: `} catch { // Silently fail }`
- `src/components/trade/TradeList.tsx:101-103`: `} catch { // Network error }`

Daily claim and trade action errors are silently swallowed with no user feedback.

**Recommendation:** Add `error` state variables and display errors near the relevant UI elements.

---

### 8.3 — Medium: Trade confirm cleanup path not batched

**Location:** `src/routes/api/trade.ts:305-323`

The integrity violation cleanup (cancel trade + unlock creatures) uses three sequential `await` calls. If the Worker is interrupted, creatures could remain locked.

**Recommendation:** Wrap in `db.batch()` like the success path.

---

### 8.4 — Medium: `isNew` check has TOCTOU race

**Location:** `src/lib/gacha.ts:303-322`

The insert and count are sequential but not atomic. Concurrent pulls from two sessions could both report `isNew = true` for the same creature.

**Recommendation:** Check count before insert rather than after.

---

## 9. Code Conventions

### 9.1 — Low: No `prettier.config.js`

`CLAUDE.md` specifies Prettier conventions but no config file exists. Editor integrations may not match.

**Recommendation:** Add `prettier.config.js` with `semi: false, singleQuote: true, trailingComma: 'all'`.

---

### 9.2 — Low: `pnpm format` is a no-op

**Location:** `package.json:17`

```json
"format": "prettier",
```

Executes `prettier` with no arguments — prints usage help, formats nothing.

**Recommendation:** Update to `"format": "prettier --write ."`.

---

### 9.3 — Low: Schema queries in route file instead of gacha module

**Location:** `src/routes/_app/gacha.tsx:8`

The route file directly queries `banner` and `currency` tables. The `gacha.ts` module exports `getFossils` but not `getActiveBanner` or `canClaimDaily`.

**Recommendation:** Extract helpers into `src/lib/gacha.ts` to centralize business rules.

---

### 9.4 — Low: Navigation links duplicated between desktop and mobile Nav

**Location:** `src/components/layout/Nav.tsx:70-91` and `164-201`

The link list is duplicated verbatim. Any route addition requires updating two places.

**Recommendation:** Extract link definitions into a `NAV_LINKS` constant array and map over it in both locations.

---

## Summary Table

| # | Priority | Area | Issue |
|---|----------|------|-------|
| 8.1 | Critical | Error Handling | No React Error Boundaries or TanStack route error components |
| 5.2 | High | API Design | No runtime validation on request bodies |
| 7.1 | High | Type Safety | Pervasive `env as unknown as Env` double-cast (12 occurrences) |
| 4.1 | High | Schema | `creature.rarity` has no DB-level CHECK constraint |
| 4.2 | High | Schema | `tradeOffer.status` has no CHECK constraint; `'expired'` type mismatch |
| 5.1 | High | API Design | Action-dispatch pattern lacks per-operation HTTP semantics |
| 3.1 | High | State | Fossil count dual-source of truth (Zustand + loader) |
| 8.2 | High | Error Handling | Silent catch blocks swallow errors |
| 2.1 | Medium | Data Flow | `startOfDay` logic duplicated |
| 2.2 | Medium | Data Flow | Encyclopedia loads all columns for all creatures |
| 2.3 | Medium | Data Flow | Inconsistent query strategy for pending vs open trades |
| 4.3 | Medium | Schema | `isNew` flag unreliable in multi-pull batches |
| 4.4 | Medium | Schema | `tradeHistory` ownership semantics undocumented |
| 5.3 | Medium | API Design | `createAuth()` recreated per-request (inherent, undocumented) |
| 5.4 | Medium | API Design | R2 image key not sanitized |
| 3.2 | Medium | State | `pullResults` persist across navigations |
| 6.2 | Medium | Components | CollectionGrid and EncyclopediaGrid duplicate ~60% code |
| 6.3 | Medium | Components | PityCounter shows thresholds only, not user's actual pity count |
| 7.2 | Medium | Type Safety | `rarity` cast without runtime validation |
| 7.3 | Medium | Type Safety | `sql<number>` manual cast instead of `countDistinct()` |
| 8.3 | Medium | Error Handling | Trade confirm cleanup not batched |
| 8.4 | Medium | Error Handling | `isNew` check has TOCTOU race |
| 6.1 | Medium | Components | DiscordIcon SVG duplicated |
| 2.4 | Low | Data Flow | `defaultPreloadStaleTime: 0` re-fetches on every nav |
| 4.5 | Low | Schema | `bannerPool` missing unique index on `(bannerId, creatureId)` |
| 4.6 | Low | Schema | `currency` missing `createdAt` |
| 4.7 | Low | Schema | `updatedAt` only set on INSERT for auth tables |
| 5.5 | Low | API Design | HTTP 402 for insufficient fossils |
| 6.4 | Low | Components | CollectionGrid interface manually maintained |
| 6.5 | Low | Components | Trade interfaces use `string` instead of `Rarity` |
| 7.4 | Low | Type Safety | `funFacts` raw JSON string instead of `mode: 'json'` |
| 9.1 | Low | Conventions | No `prettier.config.js` |
| 9.2 | Low | Conventions | `pnpm format` is a no-op |
| 9.3 | Low | Conventions | Schema queries in route file instead of gacha module |
| 9.4 | Low | Conventions | Nav links duplicated between desktop and mobile |
| 1.2 | Low | Structure | `wrangler.jsonc` has `REPLACE_ME` database ID |
| 1.3 | Low | Structure | `drizzle.config.ts` missing explanatory comment |
