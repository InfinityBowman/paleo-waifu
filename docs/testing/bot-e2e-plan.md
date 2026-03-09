# Discord Bot E2E Testing Plan

## Approach

**`wrangler dev` + Vitest** — spin up the actual Worker locally with a real D1 database, send real HTTP requests with properly signed payloads. Matches the existing web test pattern (`web/tests/production/`).

## Directory Structure

```
bot/tests/
  vitest.config.ts
  setup.ts                     # Global: start worker, apply migrations, generate keypair
  helpers/
    crypto.ts                  # Ed25519 signing with @noble/ed25519
    interaction-builder.ts     # Build Discord interaction payloads
    db-seed.ts                 # Seed/reset D1 via better-sqlite3
    worker-client.ts           # HTTP client with auto-signing
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
    rating.test.ts
    battles.test.ts
    battle.test.ts
  components/
    battle-accept.test.ts      # Button handlers
    battle-decline.test.ts
  api/
    xp.test.ts                 # Bearer token auth flow
```

## Key Design Decisions

### Signature Verification

Generate a test Ed25519 keypair using `@noble/ed25519`, pass the public key to the worker via `--var DISCORD_PUBLIC_KEY:<hex>`. All test requests get properly signed. No mocking `crypto.subtle`, no bypass flags.

### Deferred Commands

Verify two things:

1. Immediate response is type 5 (`DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE`)
2. Database state changed correctly (poll D1 with retry loop, ~5s timeout)

The Discord REST API calls (`editDeferredResponse`) will fail silently in test (fake token, real discord.com) but they already have error handling. This gives ~90% confidence without mocking external APIs.

### DB Access for Assertions/Seeding

Use `better-sqlite3` to read/write the local D1 SQLite file in `.wrangler/state/`. Each test file resets relevant tables in `beforeEach`.

### Worker Lifecycle

Start once in `globalSetup`, shared across all test files. Avoids 3-10s boot per file.

## Dependencies

Add to `bot/package.json` devDependencies:

```json
{
  "vitest": "^4.0.18",
  "@noble/ed25519": "^2.2.3",
  "better-sqlite3": "^11.0.0",
  "@types/better-sqlite3": "^7.6.11"
}
```

## Scripts

Add to `bot/package.json`:

```json
{
  "test": "vitest run --config tests/vitest.config.ts",
  "test:watch": "vitest --config tests/vitest.config.ts"
}
```

Add to root `package.json`:

```json
{
  "bot:test": "cd bot && pnpm test",
  "bot:test:watch": "cd bot && pnpm test:watch"
}
```

## Test Infrastructure Details

### Vitest Configuration

`bot/tests/vitest.config.ts`:

- Long timeout (30s test, 60s hooks) — worker takes a moment to boot
- Path aliases matching bot's tsconfig (`@/*` → `../web/src/*`)
- `globalSetup` for worker lifecycle
- `pool: 'forks'` to avoid shared state between test files

### Global Setup (`bot/tests/setup.ts`)

1. Generate Ed25519 keypair (one-time, shared across all tests)
2. Start `wrangler dev` with `--var DISCORD_PUBLIC_KEY:<test-public-key-hex>`, `--var DISCORD_APPLICATION_ID:test-app-id`, `--var DISCORD_BOT_TOKEN:test-token`, `--var XP_API_SECRET:test-xp-secret`
3. Apply all D1 migrations from `web/drizzle/` via `wrangler d1 execute --local`
4. Wait for worker to be ready (HTTP health check)
5. Provide teardown that kills the process

### Crypto Helper (`bot/tests/helpers/crypto.ts`)

```ts
import * as ed from '@noble/ed25519'

const privateKey = ed.utils.randomPrivateKey()
const publicKey = await ed.getPublicKeyAsync(privateKey)
const publicKeyHex = Buffer.from(publicKey).toString('hex')

// To sign a request:
const message = new TextEncoder().encode(timestamp + body)
const signature = await ed.signAsync(message, privateKey)
const signatureHex = Buffer.from(signature).toString('hex')
```

### Interaction Payload Builder (`bot/tests/helpers/interaction-builder.ts`)

Builders for the three interaction types:

- `buildPingInteraction()` — type 1 PING
- `buildCommandInteraction(name, options?)` — type 2 slash command with user/options
- `buildComponentInteraction(customId, options?)` — type 3 button/select menu

Each creates a complete `Interaction` object with reasonable defaults (`id`, `token`, `application_id`, `member.user`).

### Worker Client (`bot/tests/helpers/worker-client.ts`)

Wraps HTTP requests with automatic signing:

- `sendInteraction(interaction)` — POST to worker root with signed headers
- `sendXpRequest(discordUserId)` — POST to `/api/xp` with bearer token

### Database Seeding (`bot/tests/helpers/db-seed.ts`)

Seeds the local D1 SQLite file directly via `better-sqlite3`. Provides:

- Test user constants (`TEST_DISCORD_USER_ID`, `TEST_APP_USER_ID`, etc.)
- `seedTestData()` — creates users, accounts, creatures, banners, currency
- `resetTestData()` — truncates game tables between tests (preserves schema)

## What to Test

### Immediate Commands

| Command | Auth | What to Assert |
|---------|------|----------------|
| `/help` | No | Response type 4, ephemeral flag, content includes all commands |
| `/balance` | Yes | Correct fossil count; unlinked user gets UNLINKED_MESSAGE |
| `/pity` | Yes | Correct pity values; no active banner handled |
| `/level` | Yes | Correct level/XP in embed; `user` option targets other user |
| `/leaderboard-xp` | No | Correct ranking in embed |
| `/leaderboard-collection` | No | Correct ranking in embed |
| `/rating` | Yes | Correct tier/rating/record |
| `/battles` | Yes | Pending and resolved challenges shown |

### Deferred Commands

| Command | What to Assert |
|---------|----------------|
| `/daily` | Type 5 response; DB: `lastDailyClaim` updated, fossils +3; double-claim blocked |
| `/pull` | Type 5 response; DB: fossils deducted, `user_creature` created, `pity_counter` updated |
| `/pull10` | Same as `/pull` but 10 creatures, 10 fossils deducted |
| `/battle @user` | Type 5 response; DB: `battle_challenge` created with status `'pending'` |

### Component Interactions

| Component | What to Assert |
|-----------|----------------|
| `battle_accept:{id}` | Type 5 response; wrong user rejected; preset select shown |
| `battle_decline:{id}` | Type 7 (UPDATE_MESSAGE); DB: challenge status → `'declined'` |
| `battle_defender_preset:{id}` | Type 6 (DEFERRED_UPDATE); DB: challenge resolved, ratings updated |

### XP API

| Scenario | What to Assert |
|----------|----------------|
| Valid token + linked user | XP awarded, 200 response |
| Invalid token | 401 response |
| Unlinked Discord ID | 404 response |
| Level-up boundary | Level incremented in DB |

## Implementation Phases

### Phase 1: Foundation

1. `bot/tests/helpers/crypto.ts`
2. `bot/tests/helpers/interaction-builder.ts`
3. `bot/tests/helpers/worker-client.ts`
4. `bot/tests/setup.ts`
5. `bot/tests/vitest.config.ts`

### Phase 2: Core Tests

6. `bot/tests/auth/signature.test.ts`
7. `bot/tests/auth/user-resolution.test.ts`
8. `bot/tests/commands/help.test.ts`
9. `bot/tests/commands/balance.test.ts`
10. `bot/tests/api/xp.test.ts`

### Phase 3: Database-Heavy Tests

11. `bot/tests/helpers/db-seed.ts`
12. `bot/tests/commands/daily.test.ts`
13. `bot/tests/commands/pity.test.ts`
14. `bot/tests/commands/level.test.ts`
15. `bot/tests/commands/leaderboard.test.ts`
16. `bot/tests/commands/pull.test.ts`

### Phase 4: Battle System Tests

17. `bot/tests/commands/rating.test.ts`
18. `bot/tests/commands/battles.test.ts`
19. `bot/tests/commands/battle.test.ts`
20. `bot/tests/components/battle-accept.test.ts`
21. `bot/tests/components/battle-decline.test.ts`

## Potential Challenges

| Challenge | Mitigation |
|-----------|------------|
| Worker startup time (3-10s) | `globalSetup` starts once for entire suite |
| D1 state isolation between tests | `beforeEach` resets relevant tables, re-seeds base data |
| `waitUntil` timing for deferred commands | Poll DB with retry loop (200ms interval, 5s timeout) |
| `@/` path alias resolution | Vitest config alias + wrangler handles bundling for the worker |
| D1 SQLite file location | Discover `.wrangler/state/v3/d1/<binding-id>/db.sqlite` at setup time |
| Ed25519 in Node.js | `@noble/ed25519` works reliably across all Node versions |

## Future Enhancement

Extract Discord API base URL into an env var (`DISCORD_API_BASE`) in `bot/src/lib/discord.ts`, defaulting to `https://discord.com/api/v10`. In tests, override to `http://localhost:<port>` where a mock server captures deferred response payloads. This lets you assert on the actual embed content sent back to Discord. Functions to refactor:

- `sendFollowup()`
- `editChannelMessage()`
- `editDeferredResponse()`
