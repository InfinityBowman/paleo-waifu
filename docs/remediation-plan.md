# Remediation Plan

**Created:** 2026-02-27
**Source:** `audit-security.md`, `audit-performance.md`, `audit-architecture.md`
**Prioritized by:** severity × ease of implementation

---

## Tier 1: Quick Wins, High Impact ✅ COMPLETED

All 7 Tier 1 items completed on 2026-02-27.

| #   | Issue                                                                    | Audits               | Effort                  | Status |
| --- | ------------------------------------------------------------------------ | -------------------- | ----------------------- | ------ |
| 1   | **Enable FK constraints** — add `PRAGMA foreign_keys = ON` in `createDb` | Sec HIGH-03          | ~1 line                 | Done   |
| 2   | **R2 path traversal guard** — validate key in image proxy                | Sec MED-02, Arch 5.4 | ~5 lines                | Done   |
| 3   | **Replace `Math.random()` with `crypto.getRandomValues()`**              | Sec MED-04           | ~10 lines               | Done   |
| 4   | **Add security response headers** (CSP, X-Frame-Options, etc.)           | Sec MED-01, HIGH-05  | ~15 lines               | Done   |
| 5   | **Add missing DB indexes**                                               | Perf 1-C             | Migration only          | Done   |
| 6   | **Set `defaultPreloadStaleTime: 30_000`**                                | Perf 2-A, Arch 2.4   | 1 line                  | Done   |
| 7   | **Centralize `env` cast** into a `getCfEnv()` helper                     | Arch 7.1             | 1 helper + find/replace | Done   |

---

## Tier 2: Moderate Effort, High Impact

Core security and correctness. Schedule these next.

| #   | Issue                                                                   | Audits                | Effort             | Rationale                                                             |
| --- | ----------------------------------------------------------------------- | --------------------- | ------------------ | --------------------------------------------------------------------- |
| 8   | **Add Zod input validation** on gacha + trade endpoints                 | Sec HIGH-02, Arch 5.2 | ~50 lines          | Prevents malformed input from hitting DB; blocks entire class of bugs |
| 9   | **Add React Error Boundaries** + route `errorComponent`                 | Arch 8.1              | ~30 lines          | Prevents blank white screen on any render error                       |
| 10  | **Add `useMemo`/`useDeferredValue`** to Encyclopedia + Collection grids | Perf 5-A, 5-B         | ~20 lines per grid | 393 items re-filtered on every keystroke; quick memoization fix       |
| 11  | **Fix silent catch blocks** — add error state + UI feedback             | Arch 8.2              | ~20 lines each     | Users currently get zero feedback on daily claim/trade failures       |
| 12  | **Encyclopedia column projection** — select only grid columns           | Perf 2-B, Arch 2.2    | ~15 lines          | Cuts SSR payload from ~300KB to ~50KB                                 |
| 13  | **Remove rate-up rarity extra SELECT**                                  | Perf 1-B              | ~5 lines           | Free D1 round-trip elimination per pull; data already in memory       |
| 14  | **CSRF Origin header check** on gacha + trade endpoints                 | Sec MED-07            | ~10 lines          | `SameSite=Lax` alone doesn't cover top-level POST                     |

---

## Tier 3: Significant Effort, High Impact

Bigger refactors that address critical production risks.

| #   | Issue                                                       | Audits             | Effort            | Rationale                                                      |
| --- | ----------------------------------------------------------- | ------------------ | ----------------- | -------------------------------------------------------------- |
| 15  | **Batch gacha D1 queries** — collapse 90 round-trips to ~10 | Perf 1-A, 7-A      | Large refactor    | The single biggest production risk: Worker timeout on 10-pull  |
| 16  | **Add rate limiting** (Cloudflare WAF or DO token bucket)   | Sec HIGH-01        | Infra config      | Required before public launch, but needs Cloudflare-side setup |
| 17  | **Implement trade expiry** + per-user trade cap             | Sec MED-03, Low-04 | ~40 lines + cron  | ✅ COMPLETED (2026-02-28) — 5-trade cap, 7-day expiry with lazy cleanup on read |
| 18  | **Fix fossil dual source of truth** — remove from Zustand   | Arch 3.1           | Moderate refactor | Eliminates stale state divergence risk                         |
| 19  | **R2 public bucket / ETag support** on image proxy          | Perf 4-A, 7-B      | Infra + code      | Offloads image traffic from Worker CPU/memory entirely         |
| 20  | **Double session fetch** — pass session via route context   | Perf 2-C           | ~20 lines         | Saves one DB round-trip per auth'd page load                   |

---

## Tier 4: Polish & Hardening

Lower severity, do as time allows.

| #   | Issue                                                          | Audits             | Effort            |
| --- | -------------------------------------------------------------- | ------------------ | ----------------- |
| 21  | Add `loading="lazy"` + `decoding="async"` to collection images | Perf 4-C           | 2 attrs           |
| 22  | Add `width`/`height` to `<img>` tags (CLS fix)                 | Perf 4-B           | ~5 lines          |
| 23  | Preload gacha card reveal images                               | Perf 4-D           | ~10 lines         |
| 24  | Rarity enum constraint in schema                               | Arch 4.1, 4.2      | Migration         |
| 25  | Trade pending query — use joins like open trades               | Perf 1-D, Arch 2.3 | ✅ COMPLETED (2026-02-28) |
| 26  | Deduplicate DiscordIcon SVG                                    | Arch 6.1           | Extract component |
| 27  | Fix `pnpm format` no-op                                        | Arch 9.2           | 1 line            |
| 28  | Granular Zustand selectors for PullButton                      | Perf 5-D           | ~3 lines          |
| 29  | Clear `pullResults` on route leave                             | Arch 3.2           | ~5 lines          |
| 30  | Cache Drizzle/auth instances per isolate                       | Perf 6-B, 7-C      | ~15 lines         |

---

## Tier 5: Low Priority / Deferred

Nice-to-haves or inherent limitations.

| #   | Issue                              | Audits     | Notes                            |
| --- | ---------------------------------- | ---------- | -------------------------------- |
| 31  | Pseudonymous display names         | Sec MED-05 | Feature, not a fix               |
| 32  | Dev cookie `Secure` flag           | Sec MED-06 | Dev-only, well-gated             |
| 33  | Discord tokens in plaintext        | Sec LOW-02 | better-auth limitation           |
| 34  | Session cookie 5-min stale window  | Sec LOW-05 | Only matters if banning is added |
| 35  | Extract shared `CreatureFilterBar` | Arch 6.2   | Code quality, not urgent         |
| 36  | PityCounter show actual count      | Arch 6.3   | Feature enhancement              |
