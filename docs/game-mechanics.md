# Game Mechanics Spec

Paleo Waifu is a prehistoric creature gacha game. Players pull creatures from banners using Fossils (in-game currency), build collections, and trade with other players.

---

## Currency: Fossils

Fossils are the sole in-game currency. They are earned passively and spent on pulls.

| Source         | Amount | Notes                                          |
| -------------- | ------ | ---------------------------------------------- |
| New user bonus | +20    | Awarded on first gacha page visit (idempotent) |
| Daily login    | +3     | Once per UTC day, manual claim via button      |

| Cost        | Amount     |
| ----------- | ---------- |
| Single pull | 1 Fossil   |
| 10-pull     | 10 Fossils |

Fossil balance cannot go negative — the deduction query includes a `WHERE fossils >= cost` guard. If insufficient, the pull fails with HTTP 402.

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

1. Player selects a banner and chooses single or 10-pull
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

Players can offer creatures for trade on a public marketplace. Trades are creature-for-creature with no fossil exchange. A trade goes through a multi-step confirmation flow to prevent accidental swaps.

### Trade States

```
(create) → open → (accept) → pending → (confirm) → accepted
                                      → (reject)  → open
                                      → (withdraw) → open
           open → (cancel) → cancelled
           open/pending → (expiry sweep) → expired
```

Terminal states: `accepted`, `cancelled`, `expired`

### Actions

| Action   | Actor    | From             | To          | Description                                                      |
| -------- | -------- | ---------------- | ----------- | ---------------------------------------------------------------- |
| Create   | Offerer  | —                | `open`      | Offer a creature; optionally specify a wanted species            |
| Cancel   | Offerer  | `open`/`pending` | `cancelled` | Withdraw the offer entirely                                      |
| Accept   | Receiver | `open`           | `pending`   | Propose a creature to swap; must match `wantedCreatureId` if set |
| Confirm  | Offerer  | `pending`        | `accepted`  | Finalize the swap; creatures change ownership atomically         |
| Reject   | Offerer  | `pending`        | `open`      | Decline the proposed swap; offer returns to marketplace          |
| Withdraw | Receiver | `pending`        | `open`      | Retract the proposed swap                                        |

### Creature Locking

When a creature is involved in a trade, it is **locked** (`isLocked = true`):

- Locked on **create** (offerer's creature)
- Locked on **accept** (receiver's creature)
- Unlocked on **cancel**, **reject**, **withdraw**, **confirm**, or **expiry**

A locked creature cannot be:

- Offered in a new trade
- Proposed against another trade
- Shown in the "available creatures" list on the trade page

### Constraints

- **5-trade cap**: A user can have at most 5 open or pending trades at a time. Enforced after locking to prevent race conditions.
- **No self-trades**: The offerer cannot accept their own trade (`offerer_id != userId` guard).
- **Wanted species**: If `wantedCreatureId` is set, the receiver's creature must match that species.
- **Ownership verification at confirm**: Both creatures' ownership and lock status are re-verified before the swap executes. If either check fails, the trade is cancelled.
- **Expiration**: Trades expire after **7 days** from creation.

### Atomic Swap

The confirm step executes a single `db.batch()` that atomically:

1. Sets trade status to `accepted`
2. Reassigns the offerer's creature to the receiver
3. Reassigns the receiver's creature to the offerer
4. Unlocks both creatures
5. Inserts a `trade_history` audit record

### Expiration

Expiration is **lazy** — stale trades are cleaned up on each trade page load, not via a scheduled job. The sweep:

1. Finds all `open`/`pending` trades where `expiresAt < now()`
2. Sets their status to `expired`
3. Unlocks all associated creatures

### Pagination

Open trades are paginated at 20 per page using cursor-based pagination on `createdAt`.

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

## Unimplemented Features

These exist in the database schema but have no application code:

- **Wishlist**: `wishlist` table with `(userId, creatureId)` unique pairs. No API or UI.
- **Favorite toggle**: `isFavorite` column is read but never written by any endpoint.
