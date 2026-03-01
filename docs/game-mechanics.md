# Game Mechanics Spec

Paleo Waifu is a prehistoric creature gacha game. Players pull creatures from banners using Fossils (in-game currency), build collections, and trade with other players. The game is playable through both the web app and a Discord bot — both share the same database, so progress is unified across both interfaces.

---

## Currency: Fossils

Fossils are the sole in-game currency. They are earned passively and spent on pulls.

| Source         | Amount | Notes                                                      |
| -------------- | ------ | ---------------------------------------------------------- |
| New user bonus | +10    | Awarded on first gacha page visit (idempotent)             |
| Daily login    | +3     | Once per UTC day, via web button or `/daily` slash command |

| Cost        | Amount     |
| ----------- | ---------- |
| Single pull | 1 Fossil   |
| 10-pull     | 10 Fossils |

Fossil balance cannot go negative — the deduction query includes a `WHERE fossils >= cost` guard. If insufficient, the pull fails with HTTP 402 (web) or an ephemeral error message (Discord).

---

## Gacha System

### Rarity Tiers

| Rarity    | Base Rate | Color        |
| --------- | --------- | ------------ |
| Common    | 50%       | Neutral/Gray |
| Uncommon  | 30%       | Green        |
| Rare      | 15%       | Blue         |
| Epic      | 4%        | Purple       |
| Legendary | 1%        | Amber/Gold   |

Base rates sum to exactly 100% and are used directly as probabilities under normal conditions.

### Pull Flow

1. Player selects a banner and chooses single or 10-pull (web) or uses `/pull` / `/pull10` (Discord)
2. Fossils are deducted atomically (fails if insufficient)
3. For each pull in the batch:
   a. Rarity is determined (see Pity System below)
   b. A creature is selected from the banner's pool for that rarity (see Rate-Up below)
   c. A `user_creature` row is inserted
4. Pity counters are updated
5. Results are returned with `isNew` flags

All pulls use a CSPRNG (`crypto.getRandomValues`) for randomness.

### Pity System

Pity is tracked **per-banner, per-user** with two independent counters:

- `pullsSinceRare` — resets on any rare, epic, or legendary pull
- `pullsSinceLegendary` — resets only on a legendary pull

#### Hard Pity

At **90 pulls** without a legendary (`pullsSinceLegendary >= 90`), the next pull is a **guaranteed legendary**. No RNG involved.

#### Soft Pity

Soft pity activates at **50 pulls** and uses an exponential doubling formula:

**Legendary soft pity** (when `pullsSinceLegendary >= 50`):

```
extraPulls = pullsSinceLegendary - 50
legendaryRate = 0.01 × 2^(extraPulls + 1)
```

| Pull # | Legendary Rate         |
| ------ | ---------------------- |
| 1–49   | 1% (base)              |
| 50     | 2%                     |
| 51     | 4%                     |
| 52     | 8%                     |
| 53     | 16%                    |
| 54     | 32%                    |
| 55     | 64%                    |
| 56+    | Effectively guaranteed |

**Rare/Epic soft pity** (when `pullsSinceRare >= 50`):

Same doubling formula applied to both rare (15%) and epic (4%) rates simultaneously using the shared `pullsSinceRare` counter.

When soft pity inflates rates above 100% total, all rates are normalized proportionally. Common and uncommon rates shrink to accommodate the boosted upper tiers.

#### Multi-Pull Pity Handling

For 10-pulls, pity is handled atomically: the counter is pre-incremented by the full batch count, then each pull is simulated sequentially in memory with proper counter resets. A final DB write corrects the counters to reflect all resets that occurred within the batch.

### Rate-Up

Banners can designate a single **rate-up creature** via `rateUpId`.

When the rarity roll matches the rate-up creature's rarity:

- **50% chance** (`RATE_UP_SHARE = 0.5`) to select the rate-up creature
- **50% chance** to select uniformly at random from all other creatures of that rarity in the banner pool

If the rarity roll lands on a different rarity than the rate-up creature's, selection is purely random from the pool. Rate-up only applies when the rolled rarity matches.

### Banners

A banner defines a themed pool of pullable creatures:

- **`isActive`** — only active banners appear on the gacha page
- **`rateUpId`** — optional featured creature (gets 50% of its rarity's share)
- **`startsAt` / `endsAt`** — display dates (only `isActive` is checked during pulls)
- **`bannerPool`** — many-to-many join table defining which creatures are in the banner, across all rarities

The gacha page displays the first active banner. Players can only pull from the currently displayed banner.

### "Is New" Detection

A creature is flagged as `isNew` if:

1. The player has never owned that species before (no existing `user_creature` rows for that `creatureId`)
2. AND it hasn't already appeared earlier in the same batch (prevents the second copy in a 10-pull from being marked new)

---

## Trading System

### Overview

Players can offer creatures for trade on a public marketplace. Trades are creature-for-creature with no fossil exchange. The system uses a **proposal-based flow** — multiple users can propose on a single trade, and the offerer picks the winning proposal.

### Data Model

Two tables drive the trade system:

- **`trade_offer`** — The listing. An offerer puts up a creature; the trade stays `open` while proposals come in.
- **`trade_proposal`** — Individual offers on a trade. Each proposal locks the proposer's creature and waits for the offerer to accept or for the proposer to withdraw. One pending proposal per user per trade (unique index on `tradeId + proposerId`).

### Trade Offer States

```
(create) → open → (confirm a proposal) → accepted
           open → (cancel)              → cancelled
           open → (expiry sweep)        → expired
```

Terminal states: `accepted`, `cancelled`, `expired`

### Proposal States

```
(propose) → pending → (confirm / trade accepted)  → accepted   (winning proposal)
            pending → (confirm / trade accepted)   → cancelled  (losing proposals)
            pending → (withdraw)                   → withdrawn
            pending → (trade cancelled / expired)  → cancelled
```

Terminal states: `accepted`, `withdrawn`, `cancelled`

### Actions

| Action   | Actor    | From   | To                | Description                                                                        |
| -------- | -------- | ------ | ----------------- | ---------------------------------------------------------------------------------- |
| Create   | Offerer  | —      | trade `open`      | Offer a creature; optionally specify a wanted species. Locks the offerer's creature |
| Cancel   | Offerer  | `open` | trade `cancelled` | Withdraw the listing; cancels all pending proposals and unlocks all creatures       |
| Propose  | Proposer | `open` | proposal `pending` | Propose a creature to swap; locks the proposer's creature. One proposal per user per trade |
| Confirm  | Offerer  | `open` | trade `accepted`  | Accept a specific proposal; executes the swap atomically, cancels all other proposals |
| Withdraw | Proposer | —      | proposal `withdrawn` | Retract own proposal; unlocks the proposer's creature                            |

### Creature Locking

When a creature is involved in a trade, it is **locked** (`isLocked = true`):

- Locked on **create** (offerer's creature)
- Locked on **propose** (proposer's creature)
- Unlocked on **cancel**, **withdraw**, **confirm**, or **expiry**

A locked creature cannot be:

- Offered in a new trade
- Proposed against another trade
- Shown in the "available creatures" picker on the trade page

### Constraints

- **5-trade cap**: A user can have at most 5 open trades as offerer. Enforced after locking to prevent race conditions; lock is rolled back if cap is exceeded.
- **No self-proposals**: The offerer cannot propose on their own trade.
- **One proposal per user per trade**: Enforced by unique index on `(tradeId, proposerId)` and an application-level check for pending status.
- **Wanted species**: If `wantedCreatureId` is set, the proposer's creature must match that species. Validated on propose; lock is rolled back on mismatch.
- **Ownership verification at confirm**: Both the offerer's and proposer's creature ownership and lock status are re-verified before the swap executes. If either check fails, the proposal is cancelled.
- **Expiration**: Trades expire after **7 days** from creation.

### Atomic Swap

The confirm step executes a single `db.batch()` that atomically:

1. Sets trade status to `accepted` with the winning proposer as receiver
2. Sets the winning proposal status to `accepted`
3. Reassigns the offerer's creature to the proposer
4. Reassigns the proposer's creature to the offerer
5. Unlocks both creatures
6. Inserts a `trade_history` audit record
7. Cancels all other pending proposals on the same trade
8. Unlocks all losing proposals' creatures

### Expiration

Expiration is **lazy** — stale trades are cleaned up on each trade page load, not via a scheduled job. The sweep:

1. Finds all `open` trades where `expiresAt < now()`
2. Sets their status to `expired`
3. Cancels all pending proposals on those trades
4. Unlocks all associated creatures (both offerer and proposer creatures)

### Pagination

Open trades are paginated at 20 per page using cursor-based pagination on `createdAt`.

### UI

The trade page is organized into two tabs:

- **Marketplace** — Browse all open trades, make proposals, cancel your own listings. Includes "Load more" pagination.
- **My Offers** — Incoming proposals on your trades (with accept buttons) and your outgoing proposals on others' trades (with withdraw buttons). Badge on the tab shows the total count when non-zero.

---

## Collection

### Ownership Model

Each pull creates a new `user_creature` row, even for duplicates. A player can own multiple copies of the same species — each copy is a distinct row with its own `id` (nanoid).

### Display

The collection page shows all owned creatures with:

- Name, scientific name, rarity, era, diet
- Image (loaded from CDN)
- Favorite indicator (gold star)
- Client-side filtering by search, rarity, era

### Favorites (Stub)

`isFavorite` exists in the schema and is displayed as a star icon, but there is no API endpoint to toggle it. Read-only in the current implementation.

### Profile Stats

| Stat             | Calculation                                                     |
| ---------------- | --------------------------------------------------------------- |
| Total Pulls      | `COUNT(*)` from `user_creature`                                 |
| Unique Species   | `COUNT(DISTINCT creature_id)` from `user_creature`              |
| Total Species    | `COUNT(*)` from `creature`                                      |
| Completion %     | `ROUND(unique / total × 100)`                                   |
| Trades Completed | `COUNT(*)` from `trade_history` where user is giver or receiver |

---

## Encyclopedia

### Overview

A public (no auth required) browsable catalog of all creatures in the game.

### Pagination

Server-side cursor-based keyset pagination, 30 creatures per page. Infinite scroll via IntersectionObserver auto-loads the next page as the user scrolls.

### Filtering

Server-side filtering via URL search params:

- **Search**: Name or scientific name (LIKE query, case-insensitive)
- **Era**: Exact match dropdown (options from `SELECT DISTINCT`)
- **Diet**: Exact match dropdown (options from `SELECT DISTINCT`)

### Sorting

Three sort modes, all ascending:

- **Name** (default): Alphabetical by creature name
- **Rarity**: Common → Uncommon → Rare → Epic → Legendary
- **Era**: Alphabetical by era

Cursor stability is ensured via composite cursors (`{sortValue, id}`) to handle ties.

### Detail Modal

Clicking a creature opens a modal with full details (description, period, size, weight, fun facts). Detail data is lazy-loaded via a separate server function, with a 200ms hover prefetch for instant modal opens.

---

## Creature Data Model

| Field              | Type  | Notes                                       |
| ------------------ | ----- | ------------------------------------------- |
| `id`               | text  | nanoid primary key                          |
| `name`             | text  | Display name                                |
| `scientificName`   | text  | Latin binomial                              |
| `era`              | text  | e.g., "Mesozoic"                            |
| `period`           | text? | e.g., "Jurassic"                            |
| `diet`             | text  | e.g., "Carnivore"                           |
| `sizeMeters`       | real? | Body length in meters                       |
| `weightKg`         | real? | Weight in kilograms                         |
| `rarity`           | text  | common / uncommon / rare / epic / legendary |
| `description`      | text  | Flavor text                                 |
| `funFacts`         | text? | JSON array of strings                       |
| `imageUrl`         | text? | Path rewritten to CDN URL server-side       |
| `imageAspectRatio` | real? | Pre-computed for layout stability           |

---

## Discord Bot

A Cloudflare Worker-based Discord bot provides access to core gameplay via slash commands. It shares the same D1 database as the web app — pulls, fossils, and pity counters are unified across both interfaces. Users are linked via their Discord OAuth account (the `account` table maps Discord IDs to app user IDs).

### Available Commands

| Command    | Type                 | Description                                       |
| ---------- | -------------------- | ------------------------------------------------- |
| `/pull`    | Deferred + embed     | Single pull (1 Fossil), shows creature card       |
| `/pull10`  | Deferred + embed     | 10-pull (10 Fossils), shows list with best image  |
| `/daily`   | Deferred + embed     | Claim daily 3 Fossils                             |
| `/balance` | Immediate, ephemeral | Show fossil count                                 |
| `/pity`    | Immediate, ephemeral | Show pity counters for active banner              |
| `/level`   | Immediate, ephemeral | Show XP, level, and progress bar (optional @user) |
| `/help`    | Immediate, ephemeral | List available commands                           |

### Interaction Model

- **Immediate commands** (`/balance`, `/pity`, `/level`, `/help`) return a response directly within Discord's 3-second window
- **Deferred commands** (`/pull`, `/pull10`, `/daily`) return a "thinking..." state immediately, then use `ctx.waitUntil()` to run DB operations and PATCH the final response via Discord REST API
- **Ephemeral** responses are only visible to the invoking user

### XP API Endpoint

The bot Worker exposes a `POST /api/xp` endpoint for the Gateway Listener. This route is authenticated via a shared secret (`Authorization: Bearer <XP_API_SECRET>`) rather than Discord's Ed25519 signature verification.

- **Request**: `{ discordUserId: string }`
- **Response**: `{ xp: number, level: number, leveledUp: boolean }`
- Awards 15–25 random XP per call
- Level is computed atomically in the database upsert: `level = floor(sqrt(xp / 100))`
- Returns 404 for unlinked Discord users

### Account Linking

Users must have signed into the web app via Discord OAuth at least once. The bot looks up `account` rows where `providerId = 'discord'` and `accountId` matches the slash command user's Discord ID. Unlinked users receive an ephemeral message directing them to sign in on the web app.

### Shared Code

The bot imports game logic directly from the main app via a `@/` path alias — no code duplication:

- `src/lib/gacha.ts` — `executePullBatch`, `claimDaily`, `deductFossils`, `getFossils`, `ensureUserCurrency`, `refundFossils`
- `src/lib/db/schema.ts` — All table definitions
- `src/lib/db/client.ts` — `createDb()` factory
- `src/lib/types.ts` — Constants (`PULL_COST_SINGLE`, `PULL_COST_MULTI`, etc.)
- `src/lib/xp-config.ts` — Level math (`xpForLevel`, `levelFromXp`, `xpToNextLevel`) and XP constants

---

## XP & Leveling System

### Overview

Players earn XP by chatting in Discord. XP accumulates into levels, providing a passive progression path alongside the gacha. The system is designed to reward natural conversation without enabling spam grinding.

### Architecture

```
Discord Gateway ──MESSAGE_CREATE──▶ Gateway Listener (homelab Docker container)
                                        │
                                        ▼
                                   Eligibility check (in-memory)
                                        │
                                        ▼ (if eligible)
                                   POST /api/xp ──▶ Bot Worker (Cloudflare)
                                                        │
                                                        ▼
                                                   D1: upsert user_xp
                                                   D1: recalculate level
                                                        │
                                        ◀── { xp, level, leveledUp } ──┘
                                        │
                                        ▼ (if leveledUp)
                                   Send level-up embed to channel
```

The Gateway Listener is a standalone Node.js process (discord.js) running on a homelab server. It connects to Discord's Gateway WebSocket, listens for `MESSAGE_CREATE` events, and calls the bot Worker's XP endpoint for eligible messages. The bot Worker handles all database writes. If the homelab goes down, only XP tracking stops — slash commands continue working independently.

### XP Rules

| Rule                    | Value               | Notes                                                     |
| ----------------------- | ------------------- | --------------------------------------------------------- |
| XP per eligible message | 15–25 (random)      | Randomized to feel less mechanical                        |
| Cooldown                | 60 seconds per user | In-memory on the Gateway Listener; prevents spam grinding |
| Minimum message length  | 5 characters        | Filters reactions, single emoji, etc.                     |
| Bot messages            | Ignored             | `message.author.bot` check                                |
| DMs                     | Ignored             | Only guild (server) messages count                        |
| Unlinked users          | Ignored             | Discord ID must exist in `account` table                  |

### Level Curve

Quadratic scaling — early levels come fast, later ones take real engagement.

```
XP required for level N = 100 × N²
Level from XP = floor(sqrt(xp / 100))
```

| Level | Total XP | Approx. messages to reach |
| ----- | -------- | ------------------------- |
| 1     | 100      | ~5                        |
| 2     | 400      | ~20                       |
| 3     | 900      | ~45                       |
| 5     | 2,500    | ~125                      |
| 10    | 10,000   | ~500                      |
| 15    | 22,500   | ~1,125                    |
| 20    | 40,000   | ~2,000                    |

### Cooldown Behavior

- Cooldown is set **before** the API call to prevent concurrent messages from both earning XP during a slow network round-trip
- On **network error**: cooldown is cleared so the user isn't penalized for a transient failure
- On **404** (unlinked user): cooldown is kept to avoid hammering the API
- On **5xx/429** (server error): cooldown is cleared so users don't silently lose XP
- On **restart**: all cooldowns reset (in-memory only). A few extra XP awards on restart is acceptable.

### Database

The `user_xp` table tracks per-user XP and level:

| Field       | Type    | Notes                               |
| ----------- | ------- | ----------------------------------- |
| `id`        | text    | nanoid primary key                  |
| `userId`    | text    | Unique FK to `user`, cascade delete |
| `xp`        | integer | Cumulative XP (default 0)           |
| `level`     | integer | Current level (default 0)           |
| `updatedAt` | integer | Unix timestamp                      |

Level is computed atomically in the database upsert (`CAST(SQRT((xp + delta) / 100.0) AS INTEGER)`), not in application code. This prevents race conditions from concurrent XP awards.

### CI/CD

The Gateway Listener is deployed via a fully automated pipeline:

1. Push changes to `gateway/` on main → GitHub Actions builds Docker image → pushes to `ghcr.io/infinitybowman/paleo-waifu-gateway:latest`
2. Repository dispatch triggers the homelab to pull the new image and restart the container
3. The homelab service (`services/paleo-gateway/`) runs the pre-built image with env vars for bot token, API URL, and shared secret

---

## Unimplemented Features

These exist in the database schema or docs but have no application code:

- **Wishlist**: `wishlist` table with `(userId, creatureId)` unique pairs. No API or UI.
- **Favorite toggle**: `isFavorite` column is read but never written by any endpoint.
- **Bot: `/collection`**, **`/creature`**, **`/encyclopedia`** — planned slash commands for browsing creatures via Discord. Not registered or implemented.
- **Level rewards** — the leveling system tracks XP and levels but does not yet grant rewards (fossils, guaranteed rarity pulls, exclusive creatures). The `user_xp` table has columns reserved for future reward tracking. See `docs/discord-bot.md` for the planned reward table.
