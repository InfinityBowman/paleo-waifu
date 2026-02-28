# Remediation Plan

**Created:** 2026-02-27
**Last updated:** 2026-02-28
**Source:** `audit-security.md`, `audit-performance.md`, `audit-architecture.md`
**Prioritized by:** severity x ease of implementation

---

## Completed

All Tier 1 items and several Tier 2/3 items have been resolved.

| #   | Issue                                                      | Audits                  | Status |
| --- | ---------------------------------------------------------- | ----------------------- | ------ |
| 1   | Enable FK constraints — `PRAGMA foreign_keys = ON`         | Sec HIGH-03             | Done   |
| 2   | R2 path traversal guard                                    | Sec MED-02, Arch 5.4    | Done   |
| 3   | Replace `Math.random()` with `crypto.getRandomValues()`    | Sec MED-04              | Done   |
| 4   | Add security response headers (CSP, X-Frame-Options, etc.) | Sec MED-01, HIGH-05     | Done   |
| 5   | Add missing DB indexes                                     | Perf 1-C                | Done   |
| 6   | Set `defaultPreloadStaleTime: 30_000`                      | Perf 2-A, Arch 2.4      | Done   |
| 7   | Centralize `env` cast into `getCfEnv()` helper             | Arch 7.1                | Done   |
| 8   | Add Zod input validation on gacha + trade endpoints        | Sec HIGH-02, Arch 5.2   | Done   |
| 9   | Add React Error Boundaries + route `errorComponent`        | Arch 8.1                | Done   |
| 10  | CSRF Origin header check on gacha + trade endpoints        | Sec MED-07              | Done   |
| 11  | Batch gacha D1 queries — collapse to ~7 round-trips        | Perf 1-A, 7-A           | Done   |
| 12  | Rate limiting (Cloudflare WAF)                             | Sec HIGH-01             | Done   |
| 13  | Trade expiry + per-user trade cap                          | Sec MED-03, Perf LOW-04 | Done   |
| 14  | Fix fossil dual source of truth — remove from Zustand      | Arch 3.1                | Done   |
| 15  | Encyclopedia column projection + pagination                | Perf 2-B, Arch 2.2      | Done   |
| 16  | Fix pending trade N+1 hydration                            | Perf 1-D, Arch 2.3      | Done   |
| 17  | CollectionGrid memoization (`useMemo`/`useDeferredValue`)  | Perf 5-B                | Done   |
| 18  | Encyclopedia server-side pagination + infinite scroll      | Perf 5-A                | Done   |
| 19  | Image proxy → CDN redirect (no R2 streaming)               | Perf 7-B                | Done   |
| 20  | Remove rate-up rarity extra SELECT                         | Perf 1-B                | Done   |
| 21  | Fix `isNew` dedup in multi-pull batches                    | Arch 4.3, 8.4           | Done   |
| 22  | Fix double session fetch — pass via route context          | Perf 2-C                | Done   |
| 23  | Add trade_history indexes                                  | Perf 1-E                | Done   |
| 24  | Fix isNew count — check before insert                      | Perf 1-F                | Done   |
| 25  | Trade pending query — use joins                            | Perf 1-D                | Done   |
| 26  | Fix silent catch blocks — add toast/error feedback         | Arch 8.2                | Done   |
| 27  | Add `prettier.config.js`                                   | Arch 9.1                | Done   |

---

## Tier 1: Next Up — High Impact, Moderate Effort

| #   | Issue                                                    | Audits   | Effort    |
| --- | -------------------------------------------------------- | -------- | --------- |
| 28  | Add `width`/`height` + `decoding="async"` to grid images | Perf 4-B | ~5 lines  |
| 29  | Add `loading="lazy"` to CollectionGrid images            | Perf 4-C | 2 attrs   |
| 30  | Preload gacha card reveal images                         | Perf 4-D | ~10 lines |
| 31  | Rarity enum constraint in schema                         | Arch 4.1 | Migration |
| 32  | Batch trade confirm cleanup path                         | Arch 8.3 | ~10 lines |
| 33  | Add HTTP caching headers to encyclopedia/API responses   | Perf 6-A | ~15 lines |

---

## Tier 2: Polish & Optimization

| #   | Issue                                                 | Audits        | Effort    |
| --- | ----------------------------------------------------- | ------------- | --------- |
| 34  | Return fossil balance from `deductFossils` call chain | Perf 2-D      | ~10 lines |
| 35  | Extract `startOfDay` into shared utility              | Arch 2.1      | ~5 lines  |
| 36  | Clear `pullResults` on route leave                    | Arch 3.2      | ~5 lines  |
| 37  | Cache Drizzle/auth instances per isolate              | Perf 6-B, 7-C | ~15 lines |
| 38  | Lazy-load CreatureModal with `React.lazy()`           | Perf 5-C      | ~10 lines |
| 39  | Granular Zustand selectors for PullButton             | Perf 5-D      | ~3 lines  |
| 40  | Move `shadcn` to devDependencies                      | Perf 3-A      | 1 line    |
| 41  | Add pity count data to PityCounter                    | Arch 6.3      | ~15 lines |
| 42  | Fix `pnpm format` no-op                               | Arch 9.2      | 1 line    |

---

## Tier 3: Low Priority / Deferred

| #   | Issue                                         | Audits     | Notes                            |
| --- | --------------------------------------------- | ---------- | -------------------------------- |
| 43  | Pseudonymous display names                    | Sec MED-05 | Feature, not a fix               |
| 44  | Dev cookie `Secure` flag                      | Sec MED-06 | Dev-only, well-gated             |
| 45  | Discord tokens in plaintext                   | Sec LOW-02 | better-auth limitation           |
| 46  | Session cookie 5-min stale window             | Sec LOW-05 | Only matters if banning is added |
| 47  | `bannerPool` composite unique index           | Arch 4.5   | Seed-time concern only           |
| 48  | `currency` missing `createdAt`                | Arch 4.6   | Minor data gap                   |
| 49  | Deduplicate DiscordIcon SVG                   | Arch 6.1   | Extract component                |
| 50  | Extract shared `CreatureCard` component       | Arch 6.2   | Code quality                     |
| 51  | Derive CollectionGrid types from query result | Arch 6.4   | Type safety                      |
| 52  | Trade interfaces use `string` not `Rarity`    | Arch 6.5   | Type safety                      |
| 53  | Runtime rarity validation helper              | Arch 7.2   | Defensive                        |
| 54  | Use `countDistinct()` in profile              | Arch 7.3   | Code quality                     |
| 55  | `funFacts` use `mode: 'json'` in schema       | Arch 7.4   | Code quality                     |
| 56  | Extract gacha helpers from route file         | Arch 9.3   | Code organization                |
| 57  | Extract `NAV_LINKS` constant in Nav           | Arch 9.4   | Code quality                     |
| 58  | HTTP 402 → 409 for insufficient fossils       | Arch 5.5   | Cosmetic                         |
| 59  | Cache banner data with `caches.default`       | Perf 6-C   | Low impact                       |
| 60  | `tradeHistory` ownership semantics comment    | Arch 4.4   | Documentation                    |
| 61  | Confirm font `font-display: swap`             | Perf 3-B   | Verify only                      |
