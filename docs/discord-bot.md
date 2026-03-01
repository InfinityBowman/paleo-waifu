# Discord Bot for PaleoWaifu

## Context

PaleoWaifu is a prehistoric creature gacha game with a TanStack Start web UI on Cloudflare Workers + D1. Users already authenticate via Discord OAuth, so Discord IDs are stored in the `account` table. A Discord bot would let players pull creatures, check balances, browse their collection, and look up creatures directly from Discord — without opening the web app.

## Architecture

Two components:

1. **Slash Command Worker** — Cloudflare Worker in `bot/` at the repo root. Uses the **Discord Interactions API** (webhook-based slash commands). Shares the same D1 database and directly imports the existing Drizzle schema + gacha logic from the main app via path alias.
2. **Gateway Listener** — Lightweight Node.js process running on a homelab server. Connects to the Discord Gateway via WebSocket to receive `MESSAGE_CREATE` events for the XP/leveling system. Writes XP updates to D1 via an authenticated API endpoint on the bot Worker.

### Why this split works well

- The `account` table already maps Discord user IDs to app user IDs (`providerId = 'discord'`, `accountId = discordUserId`)
- `executePullBatch`, `claimDaily`, `deductFossils`, `getFossils`, `ensureUserCurrency` from `src/lib/gacha.ts` accept a `Database` arg — fully reusable with zero duplication
- `createDb(d1: D1Database)` from `src/lib/db/client.ts` works identically in the bot Worker
- Pull results already include CDN image URLs (via `toCdnUrl` called inside `executePullBatch`)
- Slash commands stay on Workers (fast, zero maintenance) while the Gateway listener handles the one feature that needs a persistent connection
- If the homelab goes down, only XP tracking stops — slash commands continue working independently

## Directory Structure

```
bot/
  src/
    index.ts              # Worker entry: signature verification + interaction router
    commands/
      pull.ts             # /pull and /pull10 (deferred)
      daily.ts            # /daily (deferred)
      balance.ts          # /balance (immediate, ephemeral)
      pity.ts             # /pity (immediate, ephemeral)
      level.ts            # /level [@user?] (immediate, ephemeral)
      collection.ts       # /collection [page] [rarity] (deferred)
      creature.ts         # /creature <name> (deferred, autocomplete)
      encyclopedia.ts     # /encyclopedia [search] [rarity] [era] [page] (deferred)
    lib/
      discord.ts          # Types, response helpers, signature verification (Ed25519)
      auth.ts             # Discord ID -> app user ID lookup via account table
      embeds.ts           # Creature embed builders with rarity colors
      constants.ts        # Rarity hex colors, emoji mappings, CDN base URL
      xp.ts               # XP constants, level thresholds, reward definitions
  register.ts             # Standalone script to register slash commands with Discord API
  wrangler.jsonc           # Bot worker config with shared D1 binding
  tsconfig.json            # Path alias @/ -> ../src/ for schema/gacha imports
  package.json             # Minimal: drizzle-orm, nanoid (no React, no TanStack)

gateway/
  src/
    index.ts              # Gateway WebSocket connection, heartbeat, MESSAGE_CREATE handler
    xp.ts                 # XP award logic, cooldown checks, level-up detection
  Dockerfile              # For running on homelab (Node.js Alpine)
  docker-compose.yml      # Service definition with env vars
  package.json            # discord.js (or raw Gateway), node-fetch
  .env.example            # BOT_TOKEN, XP_API_URL, XP_API_SECRET
```

## Slash Commands

| Command         | Options                            | Response Type        | Description                                               |
| --------------- | ---------------------------------- | -------------------- | --------------------------------------------------------- |
| `/pull`         | —                                  | Deferred + embed     | Single pull (1 Fossil), shows creature card with image    |
| `/pull10`       | —                                  | Deferred + embed     | 10-pull (10 Fossils), shows list with best creature image |
| `/daily`        | —                                  | Deferred + embed     | Claim daily 3 Fossils                                     |
| `/balance`      | —                                  | Immediate, ephemeral | Show fossil count                                         |
| `/pity`         | —                                  | Immediate, ephemeral | Show pity counters for active banner                      |
| `/collection`   | `page?` `rarity?`                  | Deferred + embed     | Paginated collection (10 per page)                        |
| `/creature`     | `name` (autocomplete)              | Deferred + embed     | Full creature details with image, stats, fun facts        |
| `/encyclopedia` | `search?` `rarity?` `era?` `page?` | Deferred + embed     | Browse all creatures (10 per page)                        |
| `/level`        | `user?`                            | Immediate, ephemeral | Show XP, level, progress bar, and next reward             |

## Key Implementation Details

### Interaction Flow

1. Discord POSTs to the bot Worker URL
2. Worker verifies Ed25519 signature via Web Crypto API (`crypto.subtle.verify`)
3. Routes to command handler based on `interaction.data.name`
4. **Immediate commands** (`/balance`, `/pity`): Return response directly (type 4)
5. **Deferred commands** (`/pull`, `/collection`, etc.): Return type 5 immediately, use `ctx.waitUntil()` to run DB operations, then PATCH the followup via Discord REST API

### Account Linking

- Look up `account` table: `WHERE providerId = 'discord' AND accountId = <discordUserId>`
- If no match, respond with ephemeral message linking to `https://paleo-waifu.jacobmaynard.dev` to sign in

### Rich Embeds

- Creature images from existing CDN URLs (`cdn.jacobmaynard.dev`)
- Rarity colors as hex integers (approximate OKLCH -> hex conversions):
  - Common: `0x9EA3B8`, Uncommon: `0x4BC9A0`, Rare: `0x5A8BE8`, Epic: `0xB563E8`, Legendary: `0xE8C95A`
- Single pull: Full embed with creature image, rarity, era, description
- 10-pull: List format with rarity emojis, best pull as thumbnail
- NEW badge for first-time creature pulls

### Shared Code (imported from main app via `@/` alias)

- `src/lib/gacha.ts` — `executePullBatch`, `claimDaily`, `deductFossils`, `getFossils`, `ensureUserCurrency`, `refundFossils`, `PullResult`
- `src/lib/db/schema.ts` — All table definitions (creature, banner, account, userCreature, currency, pityCounter, etc.)
- `src/lib/db/client.ts` — `createDb`, `Database` type
- `src/lib/types.ts` — `Rarity`, cost constants, pity thresholds, base rates

### Tree-shaking Note

`gacha.ts` imports `toCdnUrl` from `utils.ts`, which also exports `cn()` (depends on `clsx` + `tailwind-merge`). Wrangler's esbuild should tree-shake the unused `cn()` export. If not, either add `clsx`/`tailwind-merge` to bot's `package.json` (tiny packages) or extract `toCdnUrl` into its own file.

## Message XP & Leveling System

### Overview

Players earn XP by chatting in Discord. XP accumulates into levels, and each level threshold unlocks a reward (Fossils, guaranteed rarity pulls, or exclusive creatures). This encourages community engagement and gives players a passive progression path alongside the gacha.

### Architecture

```
Discord Gateway ──MESSAGE_CREATE──▶ Gateway Listener (homelab)
                                        │
                                        ▼
                                   Cooldown check (in-memory)
                                        │
                                        ▼ (if eligible)
                                   POST /api/xp ──▶ Bot Worker (Cloudflare)
                                                        │
                                                        ▼
                                                   D1: update user_xp
                                                   D1: check level-up
                                                   D1: grant rewards if leveled
```

The Gateway listener runs on the homelab as a Docker container. It connects to Discord's Gateway, listens for `MESSAGE_CREATE`, checks an in-memory cooldown map, and POSTs eligible XP events to an authenticated endpoint on the bot Worker. The Worker handles all DB writes.

### XP Rules

| Rule                    | Value               | Notes                                                             |
| ----------------------- | ------------------- | ----------------------------------------------------------------- |
| XP per eligible message | 15–25 (random)      | Randomized to feel less mechanical                                |
| Cooldown                | 60 seconds per user | Prevents spam grinding; tracked in-memory on the Gateway listener |
| Minimum message length  | 5 characters        | Filters out reactions, single emoji, etc.                         |
| Bot messages            | Ignored             | `message.author.bot` check                                        |
| DMs                     | Ignored             | Only guild (server) messages count                                |
| Unlinked users          | Ignored             | Discord ID must exist in `account` table                          |

### Level Curve

Quadratic scaling — early levels come fast, later ones take real engagement.

```
XP required for level N = 100 × N²
```

| Level | Total XP | Approx. messages to reach (from 0) |
| ----- | -------- | ---------------------------------- |
| 1     | 100      | ~5                                 |
| 2     | 400      | ~20                                |
| 3     | 900      | ~45                                |
| 5     | 2,500    | ~125                               |
| 10    | 10,000   | ~500                               |
| 15    | 22,500   | ~1,125                             |
| 20    | 40,000   | ~2,000                             |
| 25    | 62,500   | ~3,125                             |

### Level Rewards

Rewards are defined in a static config (not a DB table) so they can be referenced by both the Worker and the web app.

| Level | Reward                    | Description                           |
| ----- | ------------------------- | ------------------------------------- |
| 1     | +5 Fossils                | Welcome bonus                         |
| 3     | +10 Fossils               | —                                     |
| 5     | Guaranteed Rare pull      | Next pull is rare or higher           |
| 7     | +15 Fossils               | —                                     |
| 10    | Guaranteed Epic pull      | Next pull is epic or higher           |
| 13    | +20 Fossils               | —                                     |
| 15    | Exclusive creature unlock | Creature only obtainable via leveling |
| 18    | +25 Fossils               | —                                     |
| 20    | Guaranteed Legendary pull | Next pull is guaranteed legendary     |
| 25    | Exclusive creature unlock | Second leveling-exclusive creature    |

**Guaranteed rarity pulls** are implemented as a `guaranteedRarity` field on `user_xp`. When set (e.g., `'rare'`), the next pull overrides `calculateRarity()` to return at least that rarity, then clears the field. This requires a small change to `executePullBatch` to check the guarantee before rolling.

**Exclusive creature unlocks** are inserted directly into `user_creature` when the level is reached — no pull needed.

### Database Changes

New table in `src/lib/db/schema.ts`:

```ts
export const userXp = sqliteTable('user_xp', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  xp: integer('xp').default(0).notNull(),
  level: integer('level').default(0).notNull(),
  guaranteedRarity: text('guaranteed_rarity'), // null | 'rare' | 'epic' | 'legendary'
  lastRewardLevel: integer('last_reward_level').default(0).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
})
```

### XP API Endpoint

New route on the bot Worker: `POST /api/xp`

- Authenticated via a shared secret (`XP_API_SECRET`) in the `Authorization` header
- Request body: `{ discordUserId: string }`
- Flow:
  1. Look up app `userId` from `account` table
  2. Upsert `user_xp` row, incrementing XP by a random 15–25
  3. Calculate new level from total XP (`floor(sqrt(xp / 100))`)
  4. If level increased, check reward table and grant any unclaimed rewards
  5. Return `{ xp, level, leveledUp, reward? }` (Gateway can use this to post a level-up message in the channel)

### Gateway Listener Details

- Uses `discord.js` (simplest Gateway client) or raw WebSocket if keeping deps minimal
- Intents needed: `GuildMessages`, `MessageContent`
- In-memory `Map<string, number>` for cooldown timestamps — no persistence needed (losing cooldown state on restart just means a few extra XP awards, which is fine)
- On level-up response from the Worker, sends a congratulatory embed to the channel where the message was sent
- Docker container with auto-restart, env vars for `BOT_TOKEN`, `XP_API_URL`, `XP_API_SECRET`

### `/level` Command

Shows an embed with:

- Current level and total XP
- XP progress bar to next level (e.g., `████████░░ 80%`)
- Next reward and how much XP until it
- Optionally check another user's level via the `user` option

### Web App Integration

- Profile page (`/profile`) shows level, XP, and progress alongside existing stats
- Guaranteed rarity indicator on the gacha page (e.g., "Your next pull is guaranteed Rare!")
- Level rewards visible on a new section of the profile or a dedicated `/rewards` page

## Wrangler Config (bot/wrangler.jsonc)

Same D1 database bindings as the main app:

- Dev: `paleo-waifu-db` (ID: `6ac6d424-2a7c-4087-9f42-0cd1a2ab367a`)
- Prod: `paleo-waifu-db-prod` (ID: `61839285-28e1-4de9-9954-1a77b296c092`)

Secrets (via `wrangler secret put`): `DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN`

## Discord Application Setup (Manual)

1. Create application at https://discord.com/developers/applications
2. Copy Application ID and Public Key
3. Generate Bot Token under Bot settings
4. Set Interactions Endpoint URL to the deployed Worker URL
5. Enable **Message Content Intent** under Bot settings (required for the Gateway listener to read message content for length checks)
6. Run `pnpm bot:register` to register slash commands
7. Generate OAuth2 invite link with `bot` + `applications.commands` scopes to add bot to servers

## Implementation Phases

### Phase 1: Scaffolding

- Create `bot/` with `package.json`, `tsconfig.json`, `wrangler.jsonc`
- Implement `bot/src/lib/discord.ts` (types, Ed25519 verification, response helpers)
- Implement `bot/src/lib/auth.ts` (Discord ID -> user ID lookup)
- Implement `bot/src/lib/constants.ts` (rarity colors, emojis)
- Implement `bot/src/lib/embeds.ts` (creature embed builder)
- Implement `bot/src/index.ts` with PING/PONG handler
- Deploy and verify Discord endpoint verification works

### Phase 2: Core Gameplay Commands

- `/balance` (simplest — validates the full pipeline)
- `/daily` (tests deferred response pattern)
- `/pull` and `/pull10` (reuses `executePullBatch` directly)
- `/pity`
- Write and run `bot/register.ts`

### Phase 3: Collection & Encyclopedia

- `/collection` with pagination and rarity filter
- `/creature` with autocomplete for name search
- `/encyclopedia` with search, rarity, era filters, pagination

### Phase 4: Leveling System

- Add `user_xp` table to schema, generate and apply migration
- Implement `POST /api/xp` endpoint on the bot Worker with shared-secret auth
- Scaffold `gateway/` directory with Docker setup
- Implement Gateway listener: connect, heartbeat, `MESSAGE_CREATE` handler
- Implement cooldown logic and XP API calls in the Gateway listener
- Add `/level` slash command
- Level-up embed messages sent by the Gateway on level-up
- Add leveling-exclusive creatures to the creature seed data
- Modify `executePullBatch` to check `guaranteedRarity` before rolling

### Phase 5: Web Integration & Polish

- Show level/XP on profile page
- Show guaranteed rarity indicator on gacha page
- Verify embed colors match web app visually
- Error handling edge cases (D1 cold starts, Discord rate limits)
- Add `bot:dev`, `bot:deploy`, `bot:register`, `bot:typecheck` scripts to root `package.json`
- Add `gateway:dev`, `gateway:build`, `gateway:docker` scripts

## Verification

- `cd bot && pnpm dev` — local Worker runs
- `cd bot && pnpm typecheck` — no type errors
- Register commands and test in a Discord server:
  - `/balance` returns fossil count (ephemeral)
  - `/daily` claims fossils (shows new balance)
  - `/pull` deducts 1 fossil, shows creature embed with image
  - `/pull10` deducts 10 fossils, shows 10-creature list
  - `/pity` shows pity counters
  - `/collection` shows paginated owned creatures
  - `/creature Triceratops` shows full details with autocomplete
  - Unregistered Discord users see "link your account" message
  - `/level` shows XP, level, progress bar
  - Sending messages in the server earns XP (verify cooldown works — second message within 60s should not earn XP)
  - Hitting a level threshold grants the reward (fossils added, guaranteed rarity set, or creature inserted)
  - Level-up embed appears in the channel on level-up
  - Guaranteed rarity pull works correctly on next `/pull`

## Critical Files to Reference

- `src/lib/gacha.ts` — All game logic the bot reuses
- `src/lib/db/schema.ts` — Database schema
- `src/lib/db/client.ts` — `createDb()` factory
- `src/lib/types.ts` — Constants and types
- `src/lib/utils.ts` — `toCdnUrl()` (used inside gacha.ts)
- `wrangler.jsonc` — D1 database IDs to mirror in bot config
