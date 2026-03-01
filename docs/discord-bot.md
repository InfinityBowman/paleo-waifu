# Discord Bot for PaleoWaifu

## Context

PaleoWaifu is a prehistoric creature gacha game with a TanStack Start web UI on Cloudflare Workers + D1. Users already authenticate via Discord OAuth, so Discord IDs are stored in the `account` table. A Discord bot would let players pull creatures, check balances, browse their collection, and look up creatures directly from Discord — without opening the web app.

## Architecture

**Separate Cloudflare Worker** in a `bot/` directory at the repo root. Uses the **Discord Interactions API** (webhook-based slash commands) — no persistent WebSocket connection needed. Shares the same D1 database and directly imports the existing Drizzle schema + gacha logic from the main app via path alias.

### Why this works well

- The `account` table already maps Discord user IDs to app user IDs (`providerId = 'discord'`, `accountId = discordUserId`)
- `executePullBatch`, `claimDaily`, `deductFossils`, `getFossils`, `ensureUserCurrency` from `src/lib/gacha.ts` accept a `Database` arg — fully reusable with zero duplication
- `createDb(d1: D1Database)` from `src/lib/db/client.ts` works identically in the bot Worker
- Pull results already include CDN image URLs (via `toCdnUrl` called inside `executePullBatch`)

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
      collection.ts       # /collection [page] [rarity] (deferred)
      creature.ts         # /creature <name> (deferred, autocomplete)
      encyclopedia.ts     # /encyclopedia [search] [rarity] [era] [page] (deferred)
    lib/
      discord.ts          # Types, response helpers, signature verification (Ed25519)
      auth.ts             # Discord ID -> app user ID lookup via account table
      embeds.ts           # Creature embed builders with rarity colors
      constants.ts        # Rarity hex colors, emoji mappings, CDN base URL
  register.ts             # Standalone script to register slash commands with Discord API
  wrangler.jsonc           # Bot worker config with shared D1 binding
  tsconfig.json            # Path alias @/ -> ../src/ for schema/gacha imports
  package.json             # Minimal: drizzle-orm, nanoid (no React, no TanStack)
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
5. Run `pnpm bot:register` to register slash commands
6. Generate OAuth2 invite link with `applications.commands` scope to add bot to servers

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

### Phase 4: Polish

- Verify embed colors match web app visually
- Error handling edge cases (D1 cold starts, Discord rate limits)
- Add `bot:dev`, `bot:deploy`, `bot:register`, `bot:typecheck` scripts to root `package.json`

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

## Critical Files to Reference

- `src/lib/gacha.ts` — All game logic the bot reuses
- `src/lib/db/schema.ts` — Database schema
- `src/lib/db/client.ts` — `createDb()` factory
- `src/lib/types.ts` — Constants and types
- `src/lib/utils.ts` — `toCdnUrl()` (used inside gacha.ts)
- `wrangler.jsonc` — D1 database IDs to mirror in bot config
