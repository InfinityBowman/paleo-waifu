# Discord Bot E2E Testing

## Approach

**`wrangler dev` + Vitest** — spin up the actual Worker locally with a real D1 database, send real HTTP requests with properly signed payloads. All DB access (seeding, assertions, resets) goes through test-only HTTP endpoints on the worker, ensuring a single D1 connection and eliminating WAL lock contention.

## Directory Structure

```
bot/tests/
  vitest.config.ts
  setup.ts                     # Global: start worker, apply migrations, generate keypair
  helpers/
    crypto.ts                  # Ed25519 signing with @noble/ed25519
    interaction-builder.ts     # Build Discord interaction payloads
    db-seed.ts                 # Seed/reset D1 via worker's /api/test/* endpoints
    worker-client.ts           # HTTP client with auto-signing
    poll.ts                    # Poll DB state for deferred command assertions
  auth/
    signature.test.ts          # Invalid sig, missing headers, PING/PONG
    user-resolution.test.ts    # Unlinked/banned users
  commands/
    help.test.ts               # Immediate response
    balance.test.ts            # Auth-required immediate
    daily.test.ts              # Deferred + DB mutation
    pull.test.ts               # Deferred, fossils deducted, creatures created
    pity.test.ts
    level.test.ts
    leaderboard.test.ts
  api/
    xp.test.ts                 # Bearer token auth flow
```

## Key Design Decisions

### Signature Verification

Generate a test Ed25519 keypair using `@noble/ed25519`, pass the public key to the worker via `--var DISCORD_PUBLIC_KEY:<hex>`. All test requests get properly signed. No mocking `crypto.subtle`, no bypass flags.

### Deferred Commands

Verify two things:

1. Immediate response is type 5 (`DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE`)
2. Database state changed correctly (poll via `/api/test/query` with retry loop, ~5-10s timeout)

The Discord REST API calls (`editDeferredResponse`) will fail silently in test (fake app ID) but they already have error handling. This gives ~90% confidence without mocking external APIs.

### DB Access via Test-Only Worker Endpoints

The worker exposes three endpoints gated behind `TEST_MODE` env var (never set in production):

- `POST /api/test/query` — `{ sql, params? }` → `{ rows: [...] }` (SELECT)
- `POST /api/test/execute` — `{ sql, params? }` → `{ success: true }` (INSERT/UPDATE/DELETE)
- `POST /api/test/batch` — `{ statements: [{ sql, params? }, ...] }` → `{ success: true }` (atomic batch)

All seeding, resets, and query assertions go through these endpoints, which use miniflare's single D1 connection. This eliminates the WAL lock contention that occurs when a separate process (like `better-sqlite3`) accesses the same SQLite file.

### Worker Lifecycle

Start once in `globalSetup`, shared across all test files. Avoids 3-10s boot per file.

## Dependencies

`bot/package.json` devDependencies:

```json
{
  "vitest": "^4.0.18",
  "@noble/ed25519": "^3.0.0"
}
```

## Scripts

`bot/package.json`:

```json
{
  "test": "vitest run --config tests/vitest.config.ts",
  "test:watch": "vitest --config tests/vitest.config.ts"
}
```

## Test Infrastructure Details

### Vitest Configuration

`bot/tests/vitest.config.ts`:

- Long timeout (30s test, 60s hooks) — worker takes a moment to boot
- Path aliases matching bot's tsconfig (`@/*` → `../web/src/*`)
- `globalSetup` for worker lifecycle
- `pool: 'forks'` with `fileParallelism: false` to avoid shared state between test files

### Global Setup (`bot/tests/setup.ts`)

1. Generate Ed25519 keypair (one-time, shared across all tests)
2. Start `wrangler dev` with `--var DISCORD_PUBLIC_KEY:<hex>`, `--var DISCORD_APPLICATION_ID:test-app-id`, `--var DISCORD_BOT_TOKEN:test-token`, `--var XP_API_SECRET:test-xp-secret`, `--var TEST_MODE:true`
3. Apply all D1 migrations from `web/drizzle/` via `wrangler d1 execute --local`
4. Wait for worker to be ready (HTTP health check — worker responds 405 to GET)
5. Provide teardown that kills the process

### Crypto Helper (`bot/tests/helpers/crypto.ts`)

Generates a keypair in `globalSetup` and shares it to forked test processes via env vars (`__TEST_PRIVATE_KEY_HEX`, `__TEST_PUBLIC_KEY_HEX`). Each test file calls `loadKeypairFromEnv()` in `beforeEach` to recover the keys.

### Interaction Payload Builder (`bot/tests/helpers/interaction-builder.ts`)

Builders for the three interaction types:

- `buildPingInteraction()` — type 1 PING
- `buildCommandInteraction(name, options?)` — type 2 slash command with user/options
- `buildComponentInteraction(customId, options?)` — type 3 button/select menu (supports explicit `componentType`)

Each creates a complete `Interaction` object with reasonable defaults (`id`, `token`, `application_id`, `member.user`).

### Worker Client (`bot/tests/helpers/worker-client.ts`)

Wraps HTTP requests with automatic signing:

- `sendInteraction(interaction)` — POST to worker root with signed headers
- `sendUnsignedInteraction(interaction)` — POST without signature headers
- `sendBadSignatureInteraction(interaction)` — POST with invalid signature
- `sendXpRequest(discordUserId)` — POST to `/api/xp` with bearer token

### Poll Helper (`bot/tests/helpers/poll.ts`)

`pollUntil(fn, options?)` — polls a condition every 200ms (configurable) until it returns a non-nullish value, or throws after a timeout (default 5s). Used for asserting deferred command side-effects where `ctx.waitUntil()` work completes after the immediate response.

### Database Seeding (`bot/tests/helpers/db-seed.ts`)

Seeds and queries D1 via the worker's `/api/test/*` endpoints. Provides:

- Test user constants (`TEST_DISCORD_USER_ID`, `TEST_APP_USER_ID`, etc.)
- `seedTestData()` — creates users, accounts, creatures, banners, currency, XP via batch
- `resetTestData()` — truncates game tables between tests via batch (preserves schema)
- `queryOne(sql, ...params)` — single row query for assertions
- `queryAll(sql, ...params)` — multi-row query for assertions
- `execute(sql, ...params)` — arbitrary write statement for test setup

## Test Coverage

### Auth (2 files, 7 tests)

| Test                             | What it asserts            |
| -------------------------------- | -------------------------- |
| Reject missing signature headers | 401 response               |
| Reject invalid signature         | 401 response               |
| Accept valid PING                | 200 + PONG (type 1)        |
| Reject non-POST                  | 405 response               |
| Linked user resolves             | Command succeeds           |
| Unlinked user blocked            | UNLINKED_MESSAGE ephemeral |
| Banned user blocked              | BANNED_MESSAGE ephemeral   |

### Immediate Commands (5 files, 13 tests)

| Command                   | Auth | What it asserts                                                                    |
| ------------------------- | ---- | ---------------------------------------------------------------------------------- |
| `/help`                   | No   | Type 4, ephemeral, mentions key commands; works for unlinked users                 |
| `/balance`                | Yes  | Correct fossil count; zero balance for user with no fossils                        |
| `/pity`                   | Yes  | Correct pity for active banner; zero pity for new user; no active banner handled   |
| `/level`                  | Yes  | Own level/XP in embed; `user` option targets other user; error for unlinked target |
| `/leaderboard-xp`         | No   | Correct XP ranking in embed                                                        |
| `/leaderboard-collection` | No   | Correct collection ranking in embed                                                |

### Deferred Commands (2 files, 9 tests)

| Command   | What it asserts                                                                                |
| --------- | ---------------------------------------------------------------------------------------------- |
| `/daily`  | Type 5 response; fossils awarded (poll); double-claim blocked same day                         |
| `/pull`   | Type 5 non-ephemeral; fossils deducted, `user_creature` created, `pity_counter` updated (poll) |
| `/pull10` | Type 5 response; 10 fossils deducted, 10 creatures created; insufficient fossils rejected      |

### XP API (1 file, 4 tests)

| Scenario             | What it asserts                              |
| -------------------- | -------------------------------------------- |
| Invalid bearer token | 401 response                                 |
| Unlinked Discord ID  | 404 response                                 |
| Valid request        | XP awarded, 200 response, XP value increased |
| Missing body field   | 400 response                                 |

## Not Currently Tested

These areas don't have E2E tests yet:

- **Battle commands** (`/battle`, `/battles`, `/rating`) — battle system was rewritten to v2 (arena + friendly), bot commands are currently stubbed to redirect to web app
- **Component interactions** (battle accept/decline/preset) — same reason, old challenge flow removed
- **Discord embed content** — deferred responses fail to reach Discord (fake app ID), so we can't assert on embed content

## Potential Challenges

| Challenge                                | Mitigation                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| Worker startup time (3-10s)              | `globalSetup` starts once for entire suite                                    |
| D1 state isolation between tests         | `beforeEach` resets relevant tables via `/api/test/batch`, re-seeds base data |
| `waitUntil` timing for deferred commands | Poll DB via `/api/test/query` with retry loop (200ms interval, 5-10s timeout) |
| `@/` path alias resolution               | Vitest config alias + wrangler handles bundling for the worker                |
| Ed25519 in Node.js                       | `@noble/ed25519` works reliably across all Node versions                      |

## Future Enhancements

- **Battle system tests** — once bot commands for v2 arena/friendly battles are implemented
- **Mock Discord API** — extract Discord API base URL into an env var, override in tests to capture deferred response payloads and assert on embed content
- **Level-up boundary test** — XP award that crosses a level threshold, verify level incremented
