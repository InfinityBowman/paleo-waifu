# Security Audit: paleo-waifu

**Audited:** 2026-02-27
**Scope:** Full codebase — authentication, API endpoints, database, client-side rendering, Cloudflare Workers configuration, game logic integrity

---

## HIGH

### HIGH-01: No Rate Limiting on Any API Endpoint

**Files:** `src/routes/api/gacha.ts`, `src/routes/api/trade.ts`, `src/routes/api/auth/$.ts`

**Description:** There is zero rate limiting on any endpoint. Attack surfaces include:

- **Gacha endpoint:** Thousands of `claim_daily` requests per second. While the database guard (`lastDailyClaim < startOfDay`) prevents duplicate claims, a TOCTOU race exists under high concurrency between the read and conditional update.
- **Auth endpoint:** No brute-force or abuse protection on Discord OAuth callback and sign-in endpoints.
- **Trade endpoint:** No limit on how many open trades a user can create, allowing denial of service against the trade market.

**Recommended Fix:** Use Cloudflare's built-in rate limiting (WAF rules or `RateLimit` API in Workers) or implement a Durable Object-based token bucket. Also add a DB-level constraint: `MAX_OPEN_TRADES_PER_USER = 5`.

---

### HIGH-02: No Input Validation Schema — Type Assertions Bypass Safety

**Files:** `src/routes/api/gacha.ts:34`, `src/routes/api/trade.ts:28`, `src/routes/api/dev/switch-user.ts:29`

**Description:** All API endpoints cast the parsed JSON body directly to a TypeScript type without any runtime validation:

```typescript
const body = (await request.json()) as {
  action: string
  bannerId?: string
}
```

An attacker can send: `action` values of arbitrary length, unexpected types (`{ "action": null }`), or non-existent IDs. SQLite FK constraints are disabled by default unless `PRAGMA foreign_keys = ON` is explicitly set per connection — Drizzle/D1 does not do this automatically.

**Recommended Fix:** Add Zod runtime validation:

```typescript
const GachaBodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('claim_daily') }),
  z.object({
    action: z.enum(['pull', 'pull_multi']),
    bannerId: z.string().min(1).max(50),
  }),
])
```

---

### HIGH-03: D1 Foreign Key Constraints Are Not Enforced

**File:** `src/lib/db/client.ts`

**Description:** SQLite (and therefore D1) does not enforce foreign key constraints unless `PRAGMA foreign_keys = ON` is executed for each connection. The `createDb` function does not set this pragma. This means referential integrity is not enforced — invalid IDs can be stored in foreign key columns without error.

**Recommended Fix:**

```typescript
export function createDb(d1: D1Database): Database {
  d1.prepare('PRAGMA foreign_keys = ON')
    .run()
    .catch(() => {})
  return drizzle(d1, { schema })
}
```

---

### HIGH-04: Gacha Pull Race Condition — Pity Snapshot Not Atomic

**Files:** `src/routes/api/gacha.ts:82-90`, `src/lib/gacha.ts:48-63`

**Description:** The `deductFossils` conditional `UPDATE ... WHERE fossils >= amount` is race-safe due to D1 write serialization. However, the pity snapshot/restore pattern in `gacha.ts` lines 93-138 is not fully atomic. If a pull fails after deduction but before the pity snapshot is taken, both the fossils and pity state will be inconsistent.

**Recommended Fix:** Wrap the entire pull sequence (deduct + execute pulls) in a D1 batch. Consider adding an idempotency key (client-generated UUID per pull request) stored in a `pull_log` table.

---

### HIGH-05: User Avatar Image URL Unvalidated

**Files:** `src/components/layout/Nav.tsx:104-106`, `src/routes/_app/profile.tsx:78`

**Description:** The user's `image` field from Discord OAuth is rendered as `<img src={session.user.image}>` without any validation, sanitization, or Content Security Policy restriction. If the `image` field were compromised, it could be a tracking pixel or SSRF vector.

**Recommended Fix:**

1. Add a Content Security Policy header restricting `img-src` to known CDN domains.
2. Validate image URLs before rendering against an allowlist of `cdn.discordapp.com`, `media.discordapp.net`.

---

## MEDIUM

### MED-01: No Security Response Headers

**File:** `wrangler.jsonc`

**Description:** The application sets no security-relevant HTTP response headers: no `Content-Security-Policy`, no `X-Frame-Options: DENY`, no `X-Content-Type-Options: nosniff`, no `Referrer-Policy`, no `Permissions-Policy`. The app can be embedded in iframes on any domain (clickjacking), and MIME-type sniffing is possible on `/api/images/$` responses.

**Recommended Fix:** Configure response headers via a Worker middleware layer with CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.

---

### MED-02: R2 Image Proxy Has No Path Traversal Protection

**File:** `src/routes/api/images/$.ts:8-9`

**Description:** The key extraction `url.pathname.replace('/api/images/', '')` is vulnerable to path traversal (`../internal/config`, null byte injection). Additionally, there is no authentication on this endpoint — the bucket is treated as fully public.

**Recommended Fix:**

```typescript
const key = decodeURIComponent(rawKey)
if (
  !key ||
  key.includes('..') ||
  key.includes('\0') ||
  !/^[\w\-./]+$/.test(key)
) {
  return new Response('Not found', { status: 404 })
}
```

---

### MED-03: Trade Expiry Stored But Never Enforced — ✅ RESOLVED

**Files:** `src/lib/db/schema.ts:197`, `src/routes/api/trade.ts`, `src/routes/_app/trade.tsx`

**Status:** Fixed (2026-02-28)

**Description:** `expiresAt` is now set to 7 days from creation on every new trade. The `expireStaleTradesIfAny` function runs on every trade page load, atomically expiring stale trades and unlocking their creatures. A per-user cap of 5 active trades also prevents unbounded accumulation.

**Remaining:** A scheduled Cloudflare Worker cron trigger (Tier 3) would provide guaranteed cleanup independent of page visits.

---

### MED-04: `Math.random()` Used for Gacha Rolls

**File:** `src/lib/gacha.ts:117,184,197,203,208`

**Description:** All random number generation for gacha pulls uses `Math.random()`, a PRNG — not cryptographically secure. If an attacker can observe enough pull results, they may be able to reconstruct the PRNG state and predict future pulls.

**Recommended Fix:** Replace with `crypto.getRandomValues()`:

```typescript
function secureRandom(): number {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return array[0] / (0xffffffff + 1)
}
```

---

### MED-05: Open Trade List Exposes All User Names/Avatars Globally

**File:** `src/routes/_app/trade.tsx:14-35`

**Description:** All trader names and Discord avatar URLs are exposed to any authenticated user. A user's game activity is linkable to their Discord identity.

**Recommended Fix:** Consider giving users display names separate from their Discord names (opt-in pseudonymity).

---

### MED-06: Dev Account Switcher Cookie Missing `Secure` Flag

**File:** `src/routes/api/dev/switch-user.ts:90`

**Description:** The manually constructed session cookie lacks the `Secure` flag. While gated behind `import.meta.env.DEV`, if the DEV flag is ever incorrectly set in staging, the session cookie would be transmittable over HTTP.

**Recommended Fix:** `const cookieOpts = \`Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${import.meta.env.DEV ? '' : '; Secure'}\``

---

### MED-07: No CSRF Protection on State-Mutating API Endpoints

**Files:** `src/routes/api/gacha.ts`, `src/routes/api/trade.ts`

**Description:** The endpoints rely on cookie-based session authentication with `SameSite=Lax`, which provides partial CSRF protection but does not protect against top-level navigation POST. No explicit CSRF tokens, `Origin` header checks, or `X-Requested-With` requirements exist.

**Recommended Fix:** Add an `Origin` header check to the gacha and trade API handlers.

---

## LOW

### LOW-01: Creature Descriptions Contain Scraped HTML — Rendered Safely

**Files:** `src/components/collection/CreatureModal.tsx:144`, `src/components/encyclopedia/EncyclopediaGrid.tsx`

**Description:** Creature `description` and `funFacts` fields come from a Python scraping pipeline and contain HTML fragments. However, they are rendered as text content inside React JSX (not via `dangerouslySetInnerHTML`), so React escapes all content. **Not currently a XSS vector.** However, `imageUrl` from scraped data is rendered directly as `<img src>`.

**Recommended Fix:** Audit the Python pipeline to ensure image URLs are validated. Add URL validation in image rendering components.

---

### LOW-02: Discord Tokens Stored in Plaintext

**File:** `src/lib/db/schema.ts:51-52`

**Description:** The better-auth `account` table stores Discord `accessToken` and `refreshToken` in plaintext in D1. This is an inherent limitation of better-auth.

**Recommended Fix:** Request minimal Discord OAuth scopes (only `identify`). Consider encrypting sensitive columns at rest if needed.

---

### LOW-03: `wrangler.jsonc` Has Placeholder `database_id`

**File:** `wrangler.jsonc:14`

**Description:** `"database_id": "REPLACE_ME"` is committed to the repo. Not a vulnerability, but creates deployment risk.

---

### LOW-04: Trade Open-Listings Query Has No Pagination

**File:** `src/routes/_app/trade.tsx:15-35`

**Description:** All open trades are fetched without pagination. Thousands of open trades could cause slow page loads, high D1 read consumption, and potential Worker timeout.

**Recommended Fix:** Add `LIMIT 50 OFFSET n` pagination and a per-user cap of 5 open trades.

---

### LOW-05: Session Cookie Cache Allows 5-Minute Stale Window

**File:** `src/lib/auth.ts:30-33`

**Description:** better-auth's cookie cache stores session validation for 5 minutes. A revoked session continues working for up to 5 minutes. Low severity now; becomes higher if account banning is added.

---

## INFO

### INFO-01: Dev Account Switcher Is Properly Gated

**File:** `src/routes/api/dev/switch-user.ts:12-19`, `src/routes/__root.tsx:60`

Layered defense: Vite's `import.meta.env.DEV` compile-time tree-shaking, a runtime `process.env.NODE_ENV === 'development'` check, and userId validation (`startsWith('dev-user-')`). Well-implemented.

---

### INFO-02: Email Field Stripped from Profile Response

**File:** `src/routes/_app/profile.tsx:51`

The email is correctly stripped from profile data before sending to the client. Good practice.

---

### INFO-03: Drizzle ORM Provides Full SQL Injection Protection

All database queries use Drizzle ORM with parameterized queries. No string-concatenated SQL queries anywhere. SQL injection is not a risk.

---

## Summary Table

| ID      | Severity | Location                                        | Issue                                           |
| ------- | -------- | ----------------------------------------------- | ----------------------------------------------- |
| HIGH-01 | High     | `api/gacha.ts`, `api/trade.ts`, `api/auth/$.ts` | No rate limiting on any endpoint                |
| HIGH-02 | High     | `api/gacha.ts:34`, `api/trade.ts:28`            | No runtime input validation                     |
| HIGH-03 | High     | `lib/db/client.ts`                              | D1 FK constraints disabled by default           |
| HIGH-04 | High     | `api/gacha.ts`, `lib/gacha.ts`                  | Pity snapshot/restore not fully atomic          |
| HIGH-05 | High     | `layout/Nav.tsx`, `profile.tsx`                 | Unvalidated user avatar URL                     |
| MED-01  | Medium   | `wrangler.jsonc`                                | No security response headers                    |
| MED-02  | Medium   | `api/images/$.ts:8-9`                           | Path traversal not sanitized                    |
| MED-03  | ✅ Fixed | `lib/db/schema.ts:197`, `api/trade.ts`          | Trade expiry now enforced (7-day + lazy cleanup)|
| MED-04  | Medium   | `lib/gacha.ts:117`                              | `Math.random()` not cryptographically secure    |
| MED-05  | Medium   | `routes/_app/trade.tsx`                         | All trader names/avatars exposed                |
| MED-06  | Medium   | `api/dev/switch-user.ts:90`                     | Session cookie missing `Secure` flag            |
| MED-07  | Medium   | `api/gacha.ts`, `api/trade.ts`                  | No CSRF protection beyond `SameSite=Lax`        |
| LOW-01  | Low      | `CreatureModal.tsx`, `EncyclopediaGrid.tsx`     | Scraped content safe but image URLs unvalidated |
| LOW-02  | Low      | `lib/db/schema.ts:51-52`                        | Discord tokens stored in plaintext              |
| LOW-03  | Low      | `wrangler.jsonc:14`                             | Placeholder `database_id` committed             |
| LOW-04  | Low      | `routes/_app/trade.tsx:34`                      | No pagination on open trades query              |
| LOW-05  | Low      | `lib/auth.ts:30-33`                             | 5-minute cookie cache delays session revocation |
| INFO-01 | Info     | `api/dev/switch-user.ts`                        | Dev switcher gating is well-implemented         |
| INFO-02 | Info     | `routes/_app/profile.tsx:51`                    | Email correctly stripped from profile response  |
| INFO-03 | Info     | All DB queries                                  | Full SQL injection protection via Drizzle ORM   |

---

## Prioritized Remediation Order

1. **Before any public launch:** Add `PRAGMA foreign_keys = ON` to `createDb`. Add input validation with Zod. Add security response headers. Sanitize R2 key extraction. Replace `Math.random()` with `crypto.getRandomValues()`.
2. **Short term:** Add rate limiting to all API endpoints. Implement trade expiry. Add per-user trade limits. Add pagination to trade list query. Validate image URLs before rendering.
3. **Ongoing:** Consider pseudonymous display names. Review Discord OAuth scopes. Plan session revocation strategy when moderation is added.
