# Battle UI + Discord Bot — Implementation Plan

Finalized decisions for the battles MVP launch with 40 battle-ready creatures.

Depends on the existing battle engine in `packages/shared/src/battle/` and the DB schema (`battleChallenge`, `battleRating`, `creatureBattleStats`, `creatureAbility`).

---

## Decisions Made

### Team Presets (new concept)

Users save team compositions in the web UI. Each preset has 3 creatures with assigned rows (front/back). Stored in a new `battle_team_preset` DB table.

- Web UI: dedicated team builder in the Battle page's Challenge tab
- Discord: `/battle @user` shows a select menu of saved presets (by name). If no presets, links to the web app.
- No auto-assign — users explicitly place creatures in rows when creating a preset.

### Discord Bot UX

- **`/battle @user`** — Deferred response. Shows select menu of challenger's saved team presets. After selection, posts a public challenge embed with Accept/Decline **buttons**.
- **Accept/Decline via buttons** — Handled as `MESSAGE_COMPONENT` interactions. Accept button shows the defender's preset select menu, then resolves the battle. Decline button cancels.
- **`/battles`** — Ephemeral. Shows active incoming/outgoing challenges + recent results.
- **`/rating [@user]`** — Ephemeral. Shows rating, wins/losses, arena tier.
- No `/accept`, `/decline`, or `/team` slash commands needed (buttons replace them).

### Web App UX

- **`/battle`** route with 3 tabs:
  - **Challenge** — Search for opponent, pick/create team preset, send challenge. Inline team picker with synergy preview.
  - **Incoming** — Pending challenges with accept (pick preset) / decline actions.
  - **History** — Past battles with replay links and W/L results.
- **`/battle/$id`** — Simple text-based replay page. Creature cards for both teams at top, HP bars showing final state, "Key Moments" section (KOs, crits, big abilities), full turn log expandable.
- **Team picker** — Dedicated inline component (not modal). 3 slots, click to fill from battle-ready collection. Synergy bonuses update live. Creature filter by name/rarity/role/type.

### Battle Resolution

- Challenger creates challenge → picks team preset → stored as `challengerTeam` JSON
- Defender accepts → picks team preset → stored as `defenderTeam` JSON
- Server runs `simulateBattle()` immediately on accept
- Result (full battle log) stored in `battleChallenge.result`
- Ratings updated: winner +25, loser -20 (floor at 0)
- RNG seed: `Date.now()` at resolution time (deterministic replay from seed)

### Challenge Lifecycle

```
CHALLENGE CREATED (challenger picks preset)
  → PENDING
    → Accepted (defender picks preset) → RESOLVED (battle runs)
    → Declined → DECLINED
    → 24h passes → EXPIRED (lazy check on read)
    → Challenger cancels → CANCELLED
```

Limits:

- Max 3 active outgoing challenges per player
- Max 5 pending incoming challenges per player
- Cannot challenge yourself
- Cannot challenge someone you already have a pending challenge with
- No duplicate creature species on same team (enforced at preset creation)

### Challenge Expiry

Lazy on read — same pattern as trade expiry. When loading challenges, check `createdAt + 24h < now` and flip status to `expired`.

### Rating System

- Starting: 0
- Win: +25, Loss: -20 (floor 0)
- Arena tiers (cosmetic): Bronze (0-499), Silver (500-999), Gold (1000-1499), Diamond (1500-1999), Apex (2000+)

---

## New DB Tables

### `battle_team_preset`

```
id              TEXT PRIMARY KEY
user_id         TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
name            TEXT NOT NULL           -- e.g. "Cretaceous Rush", "Tank Wall"
members         TEXT NOT NULL           -- JSON: [{userCreatureId, creatureId, row}]
created_at      INTEGER DEFAULT (unixepoch())
updated_at      INTEGER DEFAULT (unixepoch())

UNIQUE(user_id, name)
```

---

## Scope: MVP (Launch)

### Web App

- [ ] `/battle` route with 3 tabs (Challenge, Incoming, History)
- [ ] Team preset CRUD (create, edit, delete presets)
- [ ] Inline team picker component with synergy preview
- [ ] Challenge creation flow (search opponent → pick preset → send)
- [ ] Incoming challenges with accept/decline
- [ ] Battle history with W/L and replay links
- [ ] `/battle/$id` replay page (text-based log, creature cards, key moments)
- [ ] Battle stats on profile page (rating, tier badge, W/L record)

### Discord Bot

- [ ] `/battle @user` command with preset selection
- [ ] `MESSAGE_COMPONENT` handler for Accept/Decline buttons
- [ ] Defender preset selection on accept
- [ ] Battle result embed (teams, synergies, key moments, rating changes)
- [ ] `/battles` command (ephemeral history)
- [ ] `/rating` command (ephemeral)
- [ ] Register new commands

### Backend (shared)

- [ ] `battle_team_preset` DB table + migration
- [ ] Challenge creation logic (validation, limits)
- [ ] Challenge accept → battle resolution → rating update pipeline
- [ ] Challenge decline/cancel/expire logic
- [ ] Server functions for all battle operations

---

## Deferred (Post-Launch)

- Animated step-through battle replay (HP bar transitions, damage numbers, effect animations)
- Battle leaderboard tab on `/leaderboard`
- `/team` Discord command to view/manage presets from Discord
- Team preset sharing / import
- Ranked seasons with rating resets
- Expedition / PvE auto-battle
- 5-creature Grand Arena mode
- Spectator embeds
- Fossil stakes / wagering
- ELO-based rating (replace flat +25/-20)

---

## File Map (planned)

```
# New files
packages/shared/src/db/schema.ts        # Add battle_team_preset table
web/drizzle/XXXX_battle_presets.sql      # Migration
web/src/routes/_app/battle.tsx           # Battle page (tabs)
web/src/routes/_app/battle.$id.tsx       # Battle replay page
web/src/components/battle/TeamPicker.tsx  # Inline team builder
web/src/components/battle/TeamPresets.tsx # Preset management
web/src/components/battle/BattleHistory.tsx
web/src/components/battle/IncomingChallenges.tsx
web/src/components/battle/BattleReplay.tsx
web/src/components/battle/SynergyPreview.tsx
web/src/lib/battle.ts                   # Server functions for battle ops
web/src/routes/api/battle.ts            # API route for mutations
bot/src/commands/battle.ts              # /battle command
bot/src/commands/battles.ts             # /battles command
bot/src/commands/rating.ts              # /rating command
bot/src/lib/components.ts               # Button/select menu interaction handling
bot/src/lib/battle-embeds.ts            # Battle result embeds
```
