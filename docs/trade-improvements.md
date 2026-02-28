# Trade System Improvements

## Completed (Tier 2)

### 1. 5 Open Trade Cap Per User
- **File:** `src/routes/api/trade.ts` (create action)
- Users can have at most 5 active trades (open + pending) as offerer
- No limit on accepting/offering on other users' trades
- Returns descriptive error message surfaced via toast

### 2. 7-Day Trade Expiry with Auto-Clean on Read
- **Files:** `src/routes/api/trade.ts` (sets `expiresAt`), `src/routes/_app/trade.tsx` (`expireStaleTradesIfAny`)
- `expiresAt` set to `now + 7 days` on trade creation
- On every trade page load, stale trades (open/pending with `expiresAt < now`) are atomically expired
- Expired trades have creatures unlocked and status set to `'expired'`
- No scheduled worker needed for basic cleanup — happens lazily on read

### 3. Cursor-Based Pagination on Open Trades
- **Files:** `src/routes/_app/trade.tsx` (server functions), `src/components/trade/TradeList.tsx` (UI)
- Page size: 20, ordered newest-first (`desc(createdAt)`)
- Initial page loaded via route loader (SSR), subsequent pages via `loadMoreOpenTrades` server function
- "Load more" button at the bottom of the open trades grid
- Pagination state resets when loader data refreshes (after mutations)

### 4. Pending Trade Hydration via JOINs
- **File:** `src/routes/_app/trade.tsx`
- Replaced the N+1 hydration pattern (fetch IDs, then batch fetch creature/user details) with a single JOIN query using Drizzle table aliases
- `offererUser`, `receiverUser`, `offeredCreature`, `receiverCreature` all resolved in one query

### 5. Toast Error Feedback
- **Files:** `src/components/ui/sonner.tsx`, `src/routes/__root.tsx`, `src/components/trade/TradeList.tsx`
- Installed `sonner` via `npx shadcn@latest add sonner`
- `<Toaster />` mounted in root document layout
- `tradeAction` helper now parses error responses and calls `toast.error()` with the server's error message
- Network errors also surfaced via toast

### 6. Trade History Indexes
- **Files:** `src/lib/db/schema.ts`, `drizzle/0004_red_xorn.sql`
- Added `th_giver_id_idx` on `trade_history.giver_id`
- Added `th_receiver_id_idx` on `trade_history.receiver_id`
- Migration generated via `pnpm db:generate`
- Apply with `pnpm db:migrate:local` / `pnpm db:migrate:prod`

---

## TODO (Tier 3 — Future Work)

### Scheduled Worker for Trade Expiry Cleanup
- Current auto-clean on read only triggers when someone visits the trade page
- A Cloudflare Scheduled Worker (cron trigger) or Durable Object alarm should run periodically (e.g. daily) to expire stale trades and unlock creatures
- This ensures creatures don't stay locked if no one visits the trade page for days
- Implementation: create a `src/scheduled.ts` worker with a cron handler that runs the same `expireStaleTradesIfAny` logic, wire it in `wrangler.jsonc` with `[triggers] crons = ["0 0 * * *"]`

### Wishlist Feature
- Schema already exists: `wishlist` table with `user_id` + `creature_id` (unique index)
- Needs API endpoints for add/remove wishlist entries
- Trade marketplace could filter/highlight trades offering wishlisted creatures
- Notification when a trade is created offering a wishlisted creature

### Clean Up `'expired'` Trade Status
- `TradeStatus` type in `src/lib/types.ts` already includes `'expired'`
- Schema status column comment updated to include `expired`
- Consider adding a UI indicator for expired trades in the user's trade history on the profile page

### Improve Type Safety in TradeList
- `offeredCreatureRarity` and `receiverCreatureRarity` are typed as `string` in the component interfaces
- Should use the `Rarity` type from `@/lib/types` instead
- Requires updating the server function return types to use `Rarity` instead of the generic `string` that Drizzle infers from the `text()` column
