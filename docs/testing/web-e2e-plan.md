# Web App E2E Testing

## Approach

**`wrangler dev` + Vitest** — spin up the actual TanStack Start web app locally with a real D1 database, send real HTTP requests with session cookies. Replicates the bot E2E pattern but adapted for better-auth sessions instead of Discord interaction signing.

All authenticated requests use a signed `better-auth.session_token` cookie, created by inserting a session row directly into D1 and signing the token with HMAC-SHA256 (same pattern as `web/src/routes/api/dev/switch-user.ts`).

## Directory Structure

```
web/
  vitest.config.ts                   # Default config (production tests only, excludes e2e/)
  vitest.e2e.config.ts               # Separate config for E2E tests
  src/routes/api/test.ts             # Test-only DB endpoints (gated behind import.meta.env.DEV)
  tests/
    e2e/
      setup.ts                       # Global: start vite dev, apply migrations
      helpers/
        auth.ts                      # Session creation + cookie signing
        db-seed.ts                   # Seed/reset D1 via /api/test endpoint
        client.ts                    # HTTP client with auto-cookie attachment
        poll.ts                      # Poll DB state for async assertions
      auth/
        guards.test.ts               # Protected route redirects + role guards
        csrf.test.ts                 # Origin header validation
      gacha/
        pull.test.ts                 # Single pull, multi pull, insufficient fossils
        daily.test.ts                # Daily claim, double-claim rejection
      trade/
        create.test.ts               # Create trade, lock creature, 5-trade cap
        propose.test.ts              # Propose, self-propose rejection, species constraint
        confirm.test.ts              # Accept trade, creature swap, losing proposals cancelled
        cancel-withdraw.test.ts      # Cancel trade, withdraw proposal, unlock creatures
      battle/
        team.test.ts                 # Set/delete offense + defense teams
        arena.test.ts                # Arena attack flow, self-attack guard
        friendly.test.ts             # Friendly battle flow
      collection/
        favorite.test.ts             # Toggle favorite
      admin/
        admin.test.ts                # Fossil adjustment, ban/unban, role management
```

## Key Design Decisions

### Session Authentication

Insert a session row directly into D1 and sign the token using HMAC-SHA256, matching better-auth's cookie format. No browser OAuth flow needed.

The signing logic already exists in `web/src/routes/api/dev/switch-user.ts`:

```typescript
// 1. Insert session row
await execute(`INSERT INTO session (id, token, userId, expiresAt, ipAddress, userAgent)
  VALUES (?, ?, ?, ?, '127.0.0.1', 'e2e-test')`, [sessionId, token, userId, expiresAt])

// 2. Sign token with HMAC-SHA256
async function signCookieValue(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  const base64Sig = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return encodeURIComponent(`${value}.${base64Sig}`)
}

// 3. Attach as cookie header
const cookie = `better-auth.session_token=${signedToken}`
```

The auth helper creates sessions for test users and returns the cookie string. All authenticated requests include this cookie.

### CSRF Handling

The web app's `checkCsrfOrigin()` compares the `Origin` header against the request URL's origin. For same-origin requests (no `Origin` header), it passes through. The test client sets `Origin: http://localhost:<port>` to match the local wrangler dev server.

### DB Access via Test-Only Worker Endpoints

Same pattern as the bot — expose `/api/test/query`, `/api/test/execute`, and `/api/test/batch` endpoints gated behind a `TEST_MODE` env var. These use miniflare's single D1 connection and eliminate WAL lock contention.

Add these endpoints as a new route file: `web/src/routes/api/test.ts`

```typescript
// Only available when TEST_MODE=true (never set in production)
export const Route = createFileRoute('/api/test')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!process.env.TEST_MODE) return new Response('Not Found', { status: 404 })
        // ... query/execute/batch handlers (same as bot/src/index.ts)
      },
    },
  },
})
```

### Worker Lifecycle

Start once in `globalSetup`, shared across all test files. The web app takes longer to boot than the bot (~5-15s) because TanStack Start builds on first request.

## Dependencies

`web/package.json` devDependencies (already present):

```json
{
  "vitest": "^4.0.18"
}
```

No additional dependencies needed — the signing uses `crypto.subtle` (available in Node 18+).

## Scripts

Add to `web/package.json`:

```json
{
  "test:e2e": "vitest run --config vitest.e2e.config.ts",
  "test:e2e:watch": "vitest --config vitest.e2e.config.ts"
}
```

And delegate from root `package.json`:

```json
{
  "test:e2e": "cd web && pnpm test:e2e"
}
```

## Test Infrastructure Details

### Vitest Configuration

`web/tests/vitest.e2e.config.ts`:

- Separate from existing `vitest.config.ts` (production tests stay unchanged)
- `globalSetup` for wrangler dev lifecycle
- Long timeout (30s test, 60s hooks)
- `pool: 'forks'` with `fileParallelism: false` (shared D1 state)
- Path aliases matching web's tsconfig (`@/*` → `src/*`)

### Global Setup (`web/tests/e2e/setup.ts`)

1. Start `wrangler dev` on random port with `--var TEST_MODE:true`, `--var AUTH_SECRET:test-secret-for-e2e`
2. Apply all D1 migrations from `web/drizzle/` via `wrangler d1 execute --local`
3. Wait for worker to be ready (poll until HTTP response on `/`)
4. Export `__TEST_WORKER_URL` and `__TEST_AUTH_SECRET` env vars for test processes
5. Provide teardown that kills the process

### Auth Helper (`web/tests/e2e/helpers/auth.ts`)

Creates authenticated sessions for test users:

- `createSession(userId)` → returns `{ cookie: string, token: string, sessionId: string }`
- `signCookieValue(value, secret)` → HMAC-SHA256 signing matching better-auth format
- Reads `AUTH_SECRET` from `__TEST_AUTH_SECRET` env var

### HTTP Client (`web/tests/e2e/helpers/client.ts`)

Wraps `fetch` with session cookie and CSRF headers:

- `authenticatedFetch(path, options?)` — includes session cookie + Origin header
- `unauthenticatedFetch(path, options?)` — no cookie, for auth guard tests
- `postJson(path, body, options?)` — convenience for POST with JSON body + cookie + Origin
- Base URL from `__TEST_WORKER_URL` env var

### Database Seeding (`web/tests/e2e/helpers/db-seed.ts`)

Same pattern as bot tests, adapted for web app needs:

**Test Constants:**
```typescript
TEST_USER_ID = 'e2e-user-001'              // Primary test user (100 fossils)
TEST_USER_ID_2 = 'e2e-user-002'            // Secondary user (50 fossils, for trades/battles)
TEST_ADMIN_ID = 'e2e-admin-001'            // Admin user
TEST_CREATURE_ID = 'e2e-creature-001'      // Legendary
TEST_CREATURE_ID_2 = 'e2e-creature-002'    // Common
TEST_CREATURE_ID_3 = 'e2e-creature-003'    // Uncommon
TEST_CREATURE_ID_4 = 'e2e-creature-004'    // Rare
TEST_CREATURE_ID_5 = 'e2e-creature-005'    // Epic
TEST_CREATURE_ID_6 = 'e2e-creature-006'    // Common (extra for trade/team tests)
TEST_BANNER_ID = 'e2e-banner-001'
```

**Functions:**
- `seedTestData()` — creates users, creatures, banners, banner pools, currency, user_creatures, XP
- `resetTestData()` — truncates all game tables between tests
- `queryOne<T>(sql, ...params)` — single row query via `/api/test/query`
- `queryAll<T>(sql, ...params)` — multi-row query
- `execute(sql, ...params)` — write statement via `/api/test/execute`

**Seed Data:**
- 3 users: primary (100 fossils), secondary (50 fossils), admin (role: 'admin')
- 6 creatures across all rarities
- 1 active banner with all creatures in pool
- 6 user_creatures: 3 owned by user-001, 3 owned by user-002 (for trade + battle tests)
- XP records for level calculation tests

### Poll Helper (`web/tests/e2e/helpers/poll.ts`)

Reuse the same `pollUntil()` pattern from the bot tests. Used for any async side-effects (though the web API endpoints are mostly synchronous, unlike the bot's deferred responses).

## Test Coverage

### Auth Guards (1 file, ~8 tests)

| Test | What it asserts |
| --- | --- |
| `/gacha` redirects unauthenticated → `/` | Layout guard works |
| `/collection` redirects unauthenticated → `/` | Layout guard works |
| `/trade` redirects unauthenticated → `/` | Layout guard works |
| `/profile` redirects unauthenticated → `/` | Layout guard works |
| `/battle` redirects unauthenticated → `/` | Layout guard works |
| `/battle/some-id` redirects unauthenticated → `/` | Layout guard works |
| `/admin` redirects unauthenticated → `/` | Layout guard works |
| `/admin` redirects non-admin authenticated → `/` | Role guard works |

### CSRF (1 file, ~3 tests)

| Test | What it asserts |
| --- | --- |
| POST with mismatched Origin → 403 | `checkCsrfOrigin` rejects cross-origin |
| POST with no Origin → passes through | Missing Origin is allowed |
| POST with matching Origin → passes through | Same-origin accepted |

### Gacha API (2 files, ~10 tests)

| Test | Action | What it asserts |
| --- | --- | --- |
| Single pull → 200 | `pull` | Deducts 1 fossil, creates user_creature, updates pity |
| Multi pull → 200 | `pull_multi` | Deducts 10 fossils, creates 10 user_creatures |
| Pull with 0 fossils → 402 | `pull` | Returns `Insufficient fossils` error |
| Pull on inactive banner → 400 | `pull` | Returns `Banner not found or inactive` |
| Pull unauthenticated → 401 | `pull` | Auth check fires before logic |
| Daily claim → 200 | `claim_daily` | Awards 3 fossils, sets last_daily_claim |
| Double daily claim → error | `claim_daily` | Rejects second claim same day |
| Daily claim unauthenticated → 401 | `claim_daily` | Auth check fires |
| Invalid action → 400 | unknown | Zod discriminated union rejects |
| Invalid JSON → 400 | malformed | JSON parse error handled |

### Trade API (4 files, ~18 tests)

| Test | Action | What it asserts |
| --- | --- | --- |
| Create trade → 200 | `create` | Locks creature, creates trade_offer |
| Create with locked creature → 400 | `create` | Already-traded creature rejected |
| Create 6th trade → 400 | `create` | 5-trade cap enforced |
| Create with creature on battle team → 400 | `create` | Battle team guard works |
| Cancel own trade → 200 | `cancel` | Unlocks creature, cancels proposals |
| Cancel other's trade → 404 | `cancel` | Ownership check works |
| Propose on trade → 200 | `propose` | Locks proposer creature, creates proposal |
| Propose on own trade → 409 | `propose` | Self-propose blocked |
| Propose with wrong species → 400 | `propose` | wantedCreatureId constraint enforced |
| Duplicate proposal → 409 | `propose` | One proposal per user per trade |
| Confirm proposal → 200 | `confirm` | Creatures swap owners, both unlocked, trade_history created |
| Confirm non-existent proposal → 404 | `confirm` | Proposal validation |
| Confirm other's trade → 404 | `confirm` | Ownership check |
| Withdraw proposal → 200 | `withdraw` | Unlocks proposer creature |
| Withdraw other's proposal → 404 | `withdraw` | Ownership check |
| All actions unauthenticated → 401 | * | Auth check fires before logic |
| Losing proposals cancelled on confirm | `confirm` | All non-winning proposals cancelled + creatures unlocked |
| Proposals cancelled on trade cancel | `cancel` | All pending proposals cancelled + creatures unlocked |

### Battle API (3 files, ~14 tests)

| Test | Action | What it asserts |
| --- | --- | --- |
| Set offense team → 200 | `set_team` | Creates battleTeam row with 3 members |
| Set defense team → 200 | `set_team` | Creates battleTeam row with 3 members |
| Set team with duplicates → 400 | `set_team` | Unique creature check |
| Set team with locked creature → 400 | `set_team` | Trade-locked guard |
| Set team with non-owned creature → 400 | `set_team` | Ownership check |
| Set team with duplicate species → 400 | `set_team` | Species uniqueness check |
| Delete team → 200 | `delete_team` | Removes battleTeam row |
| Delete non-existent team → 404 | `delete_team` | Graceful handling |
| Arena attack → 200 | `arena_attack` | Battle executes, rating updated, battle_log created |
| Arena self-attack → 400 | `arena_attack` | Self-targeting blocked |
| Arena without offense team → 400 | `arena_attack` | Team check fires |
| Arena against player with no defense → 400 | `arena_attack` | Defender team check |
| Friendly battle → 200 | `friendly_attack` | Battle executes, no rating change, battle_log created |
| Friendly self-battle → 400 | `friendly_attack` | Self-targeting blocked |

### Collection API (1 file, ~4 tests)

| Test | Action | What it asserts |
| --- | --- | --- |
| Toggle favorite → 200 | `toggleFavorite` | `isFavorite` flips |
| Toggle again → 200 | `toggleFavorite` | `isFavorite` flips back |
| Favorite other's creature → 404 | `toggleFavorite` | Ownership check |
| Unauthenticated → 401 | `toggleFavorite` | Auth check fires |

### Admin API (1 file, ~8 tests)

| Test | Action | What it asserts |
| --- | --- | --- |
| Adjust fossils → 200 | `adjust_fossils` | Currency changes correctly |
| Adjust fossils negative → 200 | `adjust_fossils` | Floors at 0 |
| Ban user → 200 | `ban_user` | User marked banned |
| Unban user → 200 | `unban_user` | User unmarked |
| Set role → 200 | `set_role` | User role updated |
| Non-admin → 403 | * | Role check fires before logic |
| Unauthenticated → 401 | * | Auth check fires before role check |
| Invalid action → 400 | unknown | Zod validation |

## Implementation Order

1. **Infrastructure** — Test-only `/api/test` endpoint, vitest config, global setup, helpers (auth, client, db-seed, poll)
2. **Auth guards + CSRF** — Extends existing production tests but running against local server
3. **Gacha** — Pull and daily claim (validates core game loop)
4. **Collection** — Toggle favorite (simple, validates auth + ownership patterns)
5. **Trade** — Full lifecycle (create → propose → confirm/cancel/withdraw)
6. **Battle** — Team management + arena/friendly attacks
7. **Admin** — Role-gated operations

## Potential Challenges

| Challenge | Mitigation |
| --- | --- |
| TanStack Start cold boot (~5-15s) | `globalSetup` starts once for entire suite, pre-warm with GET `/` |
| D1 state isolation between tests | `beforeEach` resets relevant tables via `/api/test/batch`, re-seeds base data |
| Cookie signing must match better-auth | Reuse exact HMAC-SHA256 logic from `dev/switch-user.ts` |
| CSRF requires matching Origin | Test client sets `Origin: http://localhost:<port>` automatically |
| `@/` path alias in test helpers | Vitest config alias `@/ → src/` |
| Web app needs env vars (AUTH_SECRET, etc.) | Pass via `--var` flags to `wrangler dev`, use dummy values |
| TanStack Start route compilation | First request triggers build; pre-warm in setup before tests run |

## Relationship to Existing Tests

The existing **production integration tests** (`web/tests/production/`) remain unchanged. They test the live deployed site with unauthenticated HTTP requests — verifying headers, SEO, SSR content, and auth redirects.

The new **E2E tests** (`web/tests/e2e/`) test the full authenticated API surface against a local wrangler dev instance with seeded test data. They complement rather than replace the production tests.

| Suite | Target | Auth | DB Mutations | Scope |
| --- | --- | --- | --- | --- |
| Production (`tests/production/`) | Live site | None | None | HTTP behavior, SSR, headers |
| E2E (`tests/e2e/`) | Local wrangler dev | Session cookies | Full CRUD | API correctness, game logic |
| Bot E2E (`bot/tests/`) | Local bot worker | Discord signing | Full CRUD | Bot commands, Discord interactions |
