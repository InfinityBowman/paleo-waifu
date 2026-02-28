# Security Audit: paleo-waifu

**Audited:** 2026-02-27
**Last updated:** 2026-02-28
**Scope:** Full codebase — authentication, API endpoints, database, client-side rendering, Cloudflare Workers configuration, game logic integrity

---

## Resolved

All HIGH-severity and most MEDIUM-severity items have been addressed.

| ID      | Original Severity | Issue                                    | Resolution                                                                                                                              |
| ------- | ----------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| HIGH-01 | High              | No rate limiting on any endpoint         | Cloudflare WAF rate limit: 20 req/10s per IP on all `/api/` paths (`terraform/main.tf`)                                                 |
| HIGH-02 | High              | No runtime input validation              | Zod `discriminatedUnion` on gacha and trade endpoints (`api/gacha.ts:22`, `api/trade.ts:13`)                                            |
| HIGH-03 | High              | D1 FK constraints disabled by default    | `PRAGMA foreign_keys = ON` in `createDb` (`lib/db/client.ts:8`)                                                                         |
| HIGH-04 | High              | Pity snapshot/restore not fully atomic   | Batched pulls via `executePullBatch` — atomic increment + batch write (`lib/gacha.ts:236-376`)                                          |
| HIGH-05 | High              | Unvalidated user avatar URL              | CSP restricts `img-src` to `self`, `cdn.jacobmaynard.dev`, Discord CDN (`lib/utils.ts:26`)                                              |
| MED-01  | Medium            | No security response headers             | Full header set (CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) via `withSecurityHeaders()` (`lib/utils.ts:20-44`) |
| MED-02  | Medium            | R2 image proxy path traversal            | Key validation blocks `..`, null bytes, double slashes, leading `/`; regex whitelist (`api/images/$.ts:11-19`)                          |
| MED-03  | Medium            | Trade expiry stored but never enforced   | 7-day expiry set on creation, lazy cleanup on read, 5-trade per-user cap (`api/trade.ts:135-162`)                                       |
| MED-04  | Medium            | `Math.random()` for gacha rolls          | Replaced with `crypto.getRandomValues()` via `secureRandom()` (`lib/gacha.ts:22-26`)                                                    |
| MED-07  | Medium            | No CSRF protection beyond `SameSite=Lax` | `checkCsrfOrigin()` Origin header validation on gacha and trade endpoints (`lib/utils.ts:49-63`)                                        |

---

## Open

### MED-05: Open Trade List Exposes All User Names/Avatars Globally

**Severity:** Medium
**File:** `src/routes/_app/trade.tsx:14-35`

**Description:** All trader names and Discord avatar URLs are exposed to any authenticated user. A user's game activity is linkable to their Discord identity.

**Recommended Fix:** Give users display names separate from their Discord names (opt-in pseudonymity).

---

### MED-06: Dev Account Switcher Cookie Missing `Secure` Flag

**Severity:** Medium
**File:** `src/routes/api/dev/switch-user.ts:90`

**Description:** The manually constructed session cookie lacks the `Secure` flag. Gated behind `import.meta.env.DEV`, so only reachable in local development. Risk is minimal unless the DEV flag is ever misconfigured in a staging environment.

**Recommended Fix:** `const cookieOpts = \`Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${import.meta.env.DEV ? '' : '; Secure'}\``

---

### LOW-01: Creature Descriptions Contain Scraped HTML — Rendered Safely

**Severity:** Low
**Files:** `src/components/collection/CreatureModal.tsx:144`, `src/components/encyclopedia/EncyclopediaGrid.tsx`

**Description:** Creature `description` and `funFacts` fields come from a Python scraping pipeline and may contain HTML fragments. React escapes all content (not rendered via `dangerouslySetInnerHTML`), so this is **not a XSS vector**. The `imageUrl` from scraped data is also protected by CSP `img-src` restrictions.

**Remaining:** Audit the Python pipeline to ensure image URLs are validated at ingest time.

---

### LOW-02: Discord Tokens Stored in Plaintext

**Severity:** Low
**File:** `src/lib/db/schema.ts:51-52`

**Description:** The better-auth `account` table stores Discord `accessToken` and `refreshToken` in plaintext in D1. This is an inherent limitation of better-auth's schema design.

**Mitigation:** Only the `identify` Discord OAuth scope is requested, limiting token utility if leaked.

---

### LOW-03: `wrangler.jsonc` Has Placeholder `database_id`

**Severity:** Low
**File:** `wrangler.jsonc:14`

**Description:** `"database_id": "REPLACE_ME"` is committed to the repo. Not a vulnerability, but creates deployment confusion for contributors.

---

### LOW-04: Trade Open-Listings Query Has No Pagination

**Severity:** Low
**File:** `src/routes/_app/trade.tsx:15-35`

**Description:** All open trades are fetched without pagination. Combined with the 5-trade per-user cap this is bounded, but at scale (thousands of users) could cause slow page loads and high D1 read consumption.

**Recommended Fix:** Add `LIMIT 50 OFFSET n` cursor pagination.

---

### LOW-05: Session Cookie Cache Allows 5-Minute Stale Window

**Severity:** Low
**File:** `src/lib/auth.ts:30-33`

**Description:** better-auth's cookie cache stores session validation for 5 minutes. A revoked session continues working for up to 5 minutes. Low severity now; becomes higher if account banning or moderation is added.

---

## Info (No Action Required)

| ID      | Location                     | Notes                                                                         |
| ------- | ---------------------------- | ----------------------------------------------------------------------------- |
| INFO-01 | `api/dev/switch-user.ts`     | Dev switcher gating is well-implemented (compile-time + runtime + validation) |
| INFO-02 | `routes/_app/profile.tsx:51` | Email correctly stripped from profile response                                |
| INFO-03 | All DB queries               | Full SQL injection protection via Drizzle ORM parameterized queries           |

---

## Summary

| Severity | Total | Resolved | Open |
| -------- | ----- | -------- | ---- |
| High     | 5     | 5        | 0    |
| Medium   | 7     | 5        | 2    |
| Low      | 5     | 0        | 5    |
| Info     | 3     | —        | —    |
