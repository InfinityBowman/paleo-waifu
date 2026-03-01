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

### 7. Proposal-Based Trade Flow

- **Files:** `src/routes/api/trade.ts`, `src/routes/_app/trade.tsx`, `src/lib/db/schema.ts`
- Replaced the old accept/confirm/reject flow with a proposal-based system using a separate `trade_proposal` table
- Multiple users can propose on a single open trade simultaneously
- Offerer's creature is locked on create; proposer's creature is locked on propose
- Offerer picks a winning proposal via confirm — executes the atomic swap and auto-cancels + unlocks all losing proposals
- One pending proposal per user per trade (unique index on `tradeId + proposerId`)
- Proposers can withdraw their own proposals at any time

### 8. Tabbed Trade UI

- **File:** `src/components/trade/TradeList.tsx`
- Trade page split into two tabs: **Marketplace** (browse + propose) and **My Offers** (incoming + outgoing proposals)
- Badge on My Offers tab shows combined count of incoming + outgoing proposals
- Glass-morphism tab styling matching the app's dark ethereal aesthetic
- New Trade button sits outside tabs, always accessible

---

## TODO — High Impact

### Marketplace Filtering & Search

- The marketplace is a flat chronological list with no way to narrow results
- Add filters for: creature name/species, rarity tier, era/period
- As the player base grows, an unfiltered list becomes unusable
- Consider a filter bar above the trade grid with dropdowns or toggle chips
- **Files:** `src/components/trade/TradeList.tsx` (UI), `src/routes/_app/trade.tsx` (server function query)

### Trade History UI

- `trade_history` table tracks all completed trades but the data is never displayed to users
- Profile page only shows a count — add a full trade history view with details (who, what, when)
- Could be a tab/section on the profile page or a dedicated sub-route
- Shows both creatures exchanged, the other user, and timestamp
- Adds a sense of progression and helps build trust between traders
- **Files:** `src/routes/_app/profile.tsx` or new route, `src/lib/db/schema.ts` (trade_history)

### Wishlist Integration

- Schema already exists: `wishlist` table with `user_id` + `creature_id` (unique index)
- Needs API endpoints for add/remove wishlist entries
- Needs UI to manage wishlist (likely on profile or collection page)
- Connect wishlists to the trade marketplace:
  - Highlight/badge trades offering a creature you've wishlisted
  - Filter trades to show only wishlist matches
  - "Someone wants a creature you have!" prompts
- Big engagement driver — connects supply and demand

### Notifications

- No way to know when someone proposes on your trade, or when the offerer confirms/rejects
- Users must manually check the trade page to see updates
- Options: in-app notification badge/dropdown, or integrate with Discord webhooks
- At minimum, a notification indicator on the nav trade link (e.g. red dot for pending actions)

---

## TODO — Medium Impact

### Direct User-to-User Trades

- Currently all trades go through the open marketplace
- No way to send a trade offer to a specific friend/user
- Could add a "Send Trade" button on another user's profile or collection
- Would create a trade with a specific `receiverId` set from the start (only visible to that user)
- **Schema:** `receiverId` already exists on `trade_offer` — just needs API/UI support

### Scheduled Worker for Trade Expiry Cleanup

- Current auto-clean on read only triggers when someone visits the trade page
- Creatures can stay locked for days if no one visits
- A Cloudflare Cron Trigger or Durable Object alarm should run periodically (e.g. daily)
- Implementation: create a `src/scheduled.ts` worker with a cron handler that runs `expireStaleTradesIfAny`, wire it in `wrangler.jsonc` with `[triggers] crons = ["0 0 * * *"]`

### Wanted Creature Display in UI

- The `wantedCreatureId` field is supported in the API but invisible to users
- The creation form doesn't let you specify what creature you want in return
- Open trade cards don't show the wanted creature constraint
- Add a "Looking for" selector in the creation form and display it on trade cards
- Helps traders find compatible offers and reduces rejected proposals
- **Files:** `src/components/trade/TradeList.tsx` (creation form + trade cards), `src/routes/api/trade.ts` (already supports it)

### Trade History on Profile Page

- Profile shows trade count but no detail
- Add a collapsible or paginated list of past trades under the stats section
- Each entry: creature given, creature received, trade partner, date
- **File:** `src/routes/_app/profile.tsx`

---

## TODO — Quality of Life

### Confirmation Dialog for Trade Creation

- Creating a trade lists your creature with no "are you sure?" dialog
- Accepting a trade already has a confirmation dialog — creation should too
- Prevents accidental trades, especially on mobile
- **File:** `src/components/trade/TradeList.tsx`

### Better Empty State

- When there are no open trades, the message is bare
- Add guidance: explain what trades are, prompt users to create the first one
- Could include an illustration or link to the collection page
- **File:** `src/components/trade/TradeList.tsx`

### Improve Type Safety in TradeList

- `offeredCreatureRarity` and `receiverCreatureRarity` are typed as `string`
- Should use the `Rarity` type from `@/lib/types` instead
- Requires updating server function return types
- **File:** `src/components/trade/TradeList.tsx`, `src/routes/_app/trade.tsx`

### Clean Up Expired Trade Status Display

- `TradeStatus` type already includes `'expired'`
- No UI indicator for expired trades anywhere
- Consider showing expired trades in user's trade history with a distinct visual treatment
