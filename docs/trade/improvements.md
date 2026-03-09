# Trade System Improvements

Planned improvements and known issues. For how the system works, see [mechanics.md](./mechanics.md).

---

## High Impact

### Marketplace Filtering & Search

The marketplace is a flat chronological list with no way to narrow results. As the player base grows this becomes unusable. Add filters for creature name/species, rarity tier, and era/period. Consider a filter bar with dropdowns or toggle chips above the trade grid.

### Trade History UI

`trade_history` tracks all completed trades but the data is never shown to users. Profile page only shows a count. Add a full trade history view with both creatures exchanged, the other user, and timestamp. Could be a tab on the profile page or a dedicated sub-route.

### Wishlist Integration

Schema exists (`wishlist` table with `userId + creatureId` unique index) but is completely disconnected from the trade flow — only used in admin analytics. Needs:
- API endpoints for add/remove wishlist entries
- UI to manage wishlist (profile or collection page)
- Marketplace integration: highlight trades offering wishlisted creatures, filter to wishlist matches, "someone wants your creature" prompts

### Notifications

No way to know when someone proposes on your trade or when the offerer confirms. Users must manually check the trade page. Options: in-app notification badge/dropdown, Discord webhook integration, or at minimum a red dot on the nav trade link for pending actions.

---

## Medium Impact

### Direct User-to-User Trades

All trades currently go through the open marketplace. No way to send a trade offer to a specific user. The `receiverId` column already exists on `trade_offer` — just needs API/UI support. Could add a "Send Trade" button on another user's profile or collection.

### Scheduled Worker for Expiry Cleanup

Current lazy expiry only triggers when someone visits the trade page. Creatures can stay locked for days if nobody visits. A Cloudflare Cron Trigger running daily would fix this — wire `expireStaleTradesIfAny` into a `scheduled` handler in `wrangler.jsonc`.

### Wanted Creature Display

The `wantedCreatureId` field is supported in the API (validated on propose) but invisible to users. The creation form doesn't let you specify what creature you want in return, and trade cards don't show the constraint. Surfacing this helps traders find compatible offers and reduces rejected proposals.

---

## Quality of Life

### Confirmation Dialog for Trade Creation

Creating a trade locks your creature with no "are you sure?" step. Confirming a proposal already has an AlertDialog — creation should too.

### Locked Creature Indicator in Collection

`isLocked` data is fetched in the collection loader but `CreatureCard` doesn't render any visual indicator. Users may be confused why a creature is missing from the trade picker. Show a lock icon or badge on locked creatures in the collection grid.

### Better Empty State

When there are no open trades, the message is bare. Add guidance explaining what trades are and prompt users to create the first one.

### Type Safety in TradeList

`offeredCreatureRarity` and `receiverCreatureRarity` are typed as `string` — should use the `Rarity` type from `@/lib/types`. Requires updating server function return types.

---

## Known Issues

### Trade Cap Race Condition

The 5-trade cap check is not atomic with the creature lock. Two concurrent `create` requests could both lock different creatures and both pass the cap check before either insert completes. Unlikely with current traffic but a real race.

### `pending` Status Never Used

`trade_offer` defines a `pending` status value but no code ever sets it. Offers go directly from `open` to `accepted`/`cancelled`/`expired`. The enum value could be removed from the schema.
