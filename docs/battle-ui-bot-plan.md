# Battle System — Implementation Plan (v2)

Redesigned battle system with async Arena (ranked) + friendly battles (unranked). Replaces the old challenge/accept flow with instant resolution against defense teams.

Depends on the existing battle engine in `packages/shared/src/battle/` and the DB schema (`creatureBattleStats`, `creatureAbility`).

---

## Core Concepts

### Offense & Defense Teams

Every player sets two teams on the web app:

- **Offense team** — used when you attack someone (arena or friendly)
- **Defense team** — used when someone attacks you; visible to opponents before they attack

Each team has 3 creatures with assigned rows (front/back). Same creatures can be on both teams. Players without a defense team are ineligible for arena matchmaking and cannot be targeted in friendly battles.

Team management is **web-only** — Discord commands link to the web app for team setup.

### Arena (Ranked)

- Browse ~4 opponents near your rating, see their defense team composition
- Pick one to attack — battle resolves instantly (your offense vs their defense)
- **5 attacks per day** (resets at midnight UTC)
- Rating changes: winner +25, loser -20 (floor 0)
- Refresh to get new opponents
- Defender does not need to be online

### Friendly Battles (Unranked)

- `/battle @user` — instant resolution, your offense vs their defense
- **No rating change**, no daily limit
- Result posted publicly in the channel (fun for trash talk)
- Target must have a defense team set

### Rating System

- Starting: 0
- Win: +25, Loss: -20 (floor 0)
- Arena tiers (cosmetic): Bronze (0-499), Silver (500-999), Gold (1000-1499), Diamond (1500-1999), Apex (2000+)
- Only arena battles affect rating

---

## DB Schema

### `battle_team`

```
id              TEXT PRIMARY KEY
user_id         TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
slot            TEXT NOT NULL           -- 'offense' | 'defense'
members         TEXT NOT NULL           -- JSON: [{userCreatureId, creatureId, row}]
created_at      INTEGER DEFAULT (unixepoch())
updated_at      INTEGER DEFAULT (unixepoch())

UNIQUE(user_id, slot)
```

One offense row + one defense row per user (max 2 rows).

### `battle_log`

All battles are instantly resolved. No pending/accept flow.

```
id              TEXT PRIMARY KEY
attacker_id     TEXT NOT NULL REFERENCES user(id)
defender_id     TEXT NOT NULL REFERENCES user(id)
mode            TEXT NOT NULL           -- 'arena' | 'friendly'
attacker_team   TEXT NOT NULL           -- JSON: [{userCreatureId, row}]
defender_team   TEXT NOT NULL           -- JSON: [{userCreatureId, row}]
result          TEXT NOT NULL           -- JSON: full BattleResult
winner_id       TEXT REFERENCES user(id)
rating_change   INTEGER                -- +25 or -20 for attacker (null for friendly)
discord_message_id  TEXT
discord_channel_id  TEXT
created_at      INTEGER DEFAULT (unixepoch())
```

### `battle_rating`

```
user_id              TEXT PRIMARY KEY REFERENCES user(id)
rating               INTEGER NOT NULL DEFAULT 0
wins                 INTEGER NOT NULL DEFAULT 0
losses               INTEGER NOT NULL DEFAULT 0
arena_attacks_today  INTEGER NOT NULL DEFAULT 0
last_attack_date     TEXT               -- 'YYYY-MM-DD' UTC, for daily reset
updated_at           INTEGER DEFAULT (unixepoch())
```

---

## Discord Bot Commands

Currently stubbed — bot commands redirect to the web app while v2 web UI is being built.

### `/battle @user` (Friendly) — TODO

Deferred, public response.

1. Resolve target Discord user → app user
2. Validate: target has defense team, not self
3. Load attacker's offense team + target's defense team
4. Run `simulateBattle()` instantly
5. Post public result embed (winner, teams, key moments, replay link)

No rating change. No daily limit.

### `/arena` (Ranked) — TODO

Deferred, public response.

1. Validate: attacker has offense team set, hasn't exceeded 5 daily attacks
2. Find ~4 opponents near attacker's rating who have defense teams set
3. Show ephemeral select menu with opponent names + defense team previews
4. On selection: resolve battle instantly, post public result embed
5. Update ratings, increment daily attack counter

Requires `MESSAGE_COMPONENT` handler for the opponent select menu.

### `/rating [@user]` (unchanged)

Ephemeral. Shows rating, W/L, arena tier, progress bar. Already implemented.

### `/battles` (updated)

Ephemeral. Shows recent battle history from `battle_log` (arena + friendly). Updated to new schema.

---

## Web App Changes

### `/battle` Route — Tab Restructure

- **Arena** — Browse opponents near your rating, see their defense teams, attack button. Daily attack counter (X/5). Refresh for new opponents.
- **Teams** — Set your offense and defense teams. Inline team picker with synergy preview.
- **Friendly** — Search for a user by name, battle them instantly. No rating change.
- **History** — Past battles (arena + friendly) with replay links, W/L badges, rating changes.

### `/battle/$id` Replay Page

Unchanged — queries `battle_log` for attacker/defender data and renders `BattleReplay` component.

### Team Picker

Reusable `BattleTeamPicker` component manages exactly 2 teams (offense/defense). `SynergyPreview` shows synergy bonuses in real-time.

---

## Scope: MVP

### Web App

- [x] `/battle/$id` replay page (player badges, rarity-styled teams, KO overlays, turn-grouped log, event icons)
- [x] Battle stats on profile page (rating, tier badge, W/L record, win rate)
- [x] Battle-ready indicators (swords badge on cards, filter in collection/encyclopedia/gacha)
- [x] Battle stats inspection in CreatureModal (role, stat bars, abilities with popovers)
- [x] Rework `/battle` tabs: Arena, Teams, Friendly, History
- [x] Offense/defense team management (BattleTeamPicker with save/clear per slot)
- [x] Arena opponent browser with defense team previews (OpponentCard component)
- [x] Arena attack flow (pick opponent → instant result → redirect to replay)
- [x] Daily attack counter display (pip dots, X/5)
- [x] Friendly battle tab (user search + instant battle)

### Discord Bot

- [x] `/battles` updated for `battle_log` schema
- [x] Bot commands stubbed to redirect to web app during rework
- [ ] `/battle @user` — friendly battle, instant resolution, public result embed
- [ ] `/arena` — ranked matchmaking with opponent select menu
- [ ] `MESSAGE_COMPONENT` handler for arena opponent selection
- [ ] Battle result embed (teams, key moments, rating changes)
- [ ] Register new/updated commands

### Backend

- [x] `battle_team` table + migration
- [x] `battle_log` table + migration
- [x] Add `arena_attacks_today` + `last_attack_date` to `battle_rating`
- [x] Offense/defense team CRUD (`setTeam`, `deleteTeam`, `getTeams`)
- [x] Arena matchmaking query (`findArenaOpponents` — near rating, has defense team)
- [x] Instant arena battle resolution (`executeArenaBattle` — rating updates + daily counter)
- [x] Instant friendly battle resolution (`executeFriendlyBattle` — no rating change)
- [x] Daily attack limit enforcement + midnight UTC reset (`checkDailyLimit`)
- [x] API endpoints: `set_team`, `delete_team`, `arena_attack`, `friendly_attack`

---

## Deferred (Post-Launch)

- Animated step-through battle replay (HP bar transitions, damage numbers, effect animations)
- Battle leaderboard tab on `/leaderboard`
- Bonus arena attacks from daily login rewards
- Ranked seasons with rating resets
- Expedition / PvE auto-battle
- 5-creature Grand Arena mode
- Spectator embeds
- Fossil stakes / wagering
- ELO-based rating (replace flat +25/-20)
- Defense team activity log ("X attacked you while you were away")

---

## File Map

```
# Schema + migrations
packages/shared/src/db/schema.ts          # battle_team, battle_log, battle_rating
web/drizzle/0013_opposite_magdalene.sql    # Migration: new tables + rating columns

# Backend
web/src/lib/battle.ts                      # Team CRUD, matchmaking, instant resolution, daily limits
web/src/routes/api/battle.ts               # API: set_team, delete_team, arena_attack, friendly_attack

# Web UI
web/src/routes/_app/battle.tsx             # Route loader: history, teams, creatures, rating, daily limit
web/src/routes/_app/battle.$id.tsx         # Replay page (queries battle_log)
web/src/components/battle/BattleList.tsx    # All tabs: Arena, Teams, Friendly, History + OpponentCard
web/src/components/battle/BattleTeamPicker.tsx  # Reusable team picker (offense/defense)
web/src/components/battle/BattleCreatureSlot.tsx # Creature slot with stats/abilities
web/src/components/battle/SynergyPreview.tsx    # Synergy bonus display
web/src/components/battle/BattleReplay.tsx      # Turn-by-turn replay renderer
web/src/lib/badges.ts                      # Nav badges (removed challenge badge)

# Bot (stubbed for v2 rework)
bot/src/commands/battle.ts                 # Stubbed → "use the web app"
bot/src/commands/battles.ts                # Updated: queries battle_log
bot/src/commands/rating.ts                 # Unchanged
bot/src/components/battle-accept.ts        # Stubbed → "use the web app"
bot/src/components/battle-decline.ts       # Stubbed → "use the web app"
bot/src/components/battle-defender-preset.ts  # Stubbed → "use the web app"
bot/src/lib/battle-helpers.ts              # Kept: ensureBattleRating, tier helpers, parseChallengeAction
```
