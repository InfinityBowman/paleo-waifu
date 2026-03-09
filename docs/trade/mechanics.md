# Trade System Mechanics

How the creature trading system works. For planned improvements, see [improvements.md](./improvements.md).

---

## Overview

Creature-for-creature marketplace. Users post a creature for trade, other users make proposals offering one of their creatures, and the original poster picks a winner. No currency involved.

## Schema

Four tables power trades (all in `packages/shared/src/db/schema.ts`):

- **`trade_offer`** - One row per marketplace listing. Tracks offerer, offered creature, optional wanted creature species, status, and expiry.
- **`trade_proposal`** - One row per counter-offer on a listing. Tracks proposer, proposed creature, and status. Unique index on `(tradeId, proposerId)` enforces one proposal per user per trade.
- **`trade_history`** - Immutable audit log. Written once on confirm with both sides of the swap.
- **`wishlist`** - `(userId, creatureId)` pairs. Schema exists but is not yet integrated with the trade flow (only used in admin analytics).

Creature locking uses the `isLocked` boolean on `user_creature`.

## Trade Lifecycle

### 1. Create Trade

1. Offerer selects an unlocked creature from their collection
2. Server locks the creature atomically (`UPDATE WHERE isLocked = false RETURNING id`)
3. Server checks the 5-trade cap (max 5 open trades per user). If exceeded, unlocks the creature and returns error.
4. Inserts `trade_offer` with `status = 'open'` and `expiresAt = now + 7 days`

### 2. Make Proposal

1. Another user selects one of their unlocked creatures
2. Server validates the trade is still `open` and the proposer isn't the offerer
3. Server locks the proposer's creature atomically
4. If the trade has a `wantedCreatureId`, validates the proposed creature's species matches. Unlocks and returns error on mismatch.
5. Inserts `trade_proposal` with `status = 'pending'`

### 3. Confirm (Accept a Proposal)

The offerer picks a winning proposal. Executed as a single `db.batch()`:

1. Validates both creatures are still locked and owned
2. Sets `trade_offer.status = 'accepted'`, fills `receiverId` and `receiverCreatureId`
3. Sets winning `trade_proposal.status = 'accepted'`
4. **Transfers ownership**: updates `userId` on both `user_creature` rows and unlocks them
5. Inserts into `trade_history`
6. Cancels all losing proposals and unlocks their creatures

### 4. Cancel

Offerer cancels their listing. Batch operation:
- Sets `trade_offer.status = 'cancelled'`
- Unlocks offerer's creature
- Cancels all pending proposals and unlocks their creatures

### 5. Withdraw

Proposer withdraws their own proposal:
- Sets `trade_proposal.status = 'withdrawn'`
- Unlocks proposer's creature

## Creature Locking

The `isLocked` column on `user_creature` prevents a creature from being used in multiple trades simultaneously.

**Locked when:** trade created (offerer's creature), proposal made (proposer's creature)

**Unlocked when:** trade cancelled, trade expired, proposal withdrawn, trade confirmed (both sides transferred and unlocked), losing proposals auto-cancelled

**Enforcement:** The `UPDATE WHERE isLocked = false` pattern is an optimistic lock — if the creature is already locked, zero rows are returned and the action fails. The creature picker query also filters `WHERE isLocked = false` so locked creatures never appear in the UI.

## Expiry

Lazy expiry with no background job. The function `expireStaleTradesIfAny` runs at the top of every trade page load:

1. Finds all trades where `status = 'open' AND expiresAt < now`
2. Batch: sets them to `expired`, cancels pending proposals, unlocks all creatures

Trades only actually expire when someone visits the trade page. A stale trade with no visitors stays `open` in the DB until the next page load.

## Limits

| Limit | Value | Enforcement |
|-------|-------|-------------|
| Open trades per user | 5 | Checked on create after creature lock |
| Trade expiry | 7 days | `expiresAt` column, lazy cleanup on page load |
| Proposals per user per trade | 1 | Unique index `(tradeId, proposerId)` + pre-check |
| Self-proposals | Blocked | Explicit check in `propose` action |
| Page size | 20 | Cursor-based pagination, keyset on `createdAt` |

## Status Values

**`trade_offer.status`**: `open` | `accepted` | `cancelled` | `expired`
(Note: `pending` is defined in the schema enum but never set by any code)

**`trade_proposal.status`**: `pending` | `accepted` | `withdrawn` | `cancelled`

## UI Structure

Two tabs in the trade page (`TradeList.tsx`):

- **Marketplace** - Browse open trades, create new trades, make proposals. Cursor-based pagination with "Load more". Own trades show Cancel button; others show Make Offer button.
- **My Offers** - Incoming proposals on your trades (with Accept button) and your outgoing proposals (with Withdraw button). Badge shows combined count.

## Key Files

| File | Purpose |
|------|---------|
| `packages/shared/src/db/schema.ts` | Table definitions |
| `web/src/routes/api/trade.ts` | All mutations: create, cancel, propose, confirm, withdraw |
| `web/src/routes/_app/trade.tsx` | Server functions (data loading, expiry), route loader |
| `web/src/components/trade/TradeList.tsx` | Entire trade UI |
| `web/src/components/shared/CreaturePickerModal.tsx` | Creature selector for trades and proposals |
