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

## DB Schema Changes

### Remove

- `battle_team_preset` — replaced by offense/defense team columns on `battle_team`
- `battle_challenge.status` states `pending`, `declined`, `expired`, `cancelled`, `resolving` — all battles resolve instantly now

### New: `battle_team`

```
id              TEXT PRIMARY KEY
user_id         TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
slot            TEXT NOT NULL           -- 'offense' | 'defense'
members         TEXT NOT NULL           -- JSON: [{userCreatureId, creatureId, row}]
created_at      INTEGER DEFAULT (unixepoch())
updated_at      INTEGER DEFAULT (unixepoch())

UNIQUE(user_id, slot)
```

One offense row + one defense row per user (max 2 rows). Replaces the preset system.

### Modify: `battle_challenge` → `battle_log`

Rename to `battle_log` to reflect its new purpose (no more pending/accept flow). All battles are instantly resolved.

```
id              TEXT PRIMARY KEY
attacker_id     TEXT NOT NULL REFERENCES user(id)
defender_id     TEXT NOT NULL REFERENCES user(id)
mode            TEXT NOT NULL           -- 'arena' | 'friendly'
attacker_team   TEXT NOT NULL           -- JSON: [{userCreatureId, row}]
defender_team   TEXT NOT NULL           -- JSON: [{userCreatureId, row}]
result          TEXT NOT NULL           -- JSON: full BattleResult
winner_id       TEXT REFERENCES user(id)
rating_change   INTEGER                -- +25 or -25 for attacker (null for friendly)
discord_message_id  TEXT
discord_channel_id  TEXT
created_at      INTEGER DEFAULT (unixepoch())
```

### Modify: `battle_rating`

Add daily attack tracking:

```
user_id         TEXT PRIMARY KEY REFERENCES user(id)
rating          INTEGER NOT NULL DEFAULT 0
wins            INTEGER NOT NULL DEFAULT 0
losses          INTEGER NOT NULL DEFAULT 0
arena_attacks_today  INTEGER NOT NULL DEFAULT 0
last_attack_date     TEXT               -- 'YYYY-MM-DD' UTC, for daily reset
updated_at      INTEGER DEFAULT (unixepoch())
```

---

## Discord Bot Commands

### `/battle @user` (Friendly)

Deferred, public response.

1. Resolve target Discord user → app user
2. Validate: target has defense team, not self
3. Load attacker's offense team + target's defense team
4. Run `simulateBattle()` instantly
5. Post public result embed (winner, teams, key moments, replay link)

No rating change. No daily limit.

### `/arena` (Ranked)

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

Ephemeral. Shows recent battle history (arena + friendly). Already implemented, needs minor update to new schema.

---

## Web App Changes

### `/battle` Route — Tab Restructure

- **Arena** — Browse opponents near your rating, see their defense teams, attack button. Daily attack counter (X/5). Refresh for new opponents.
- **Teams** — Set your offense and defense teams. Inline team picker with synergy preview. Replaces the old preset CRUD and Challenge tab.
- **History** — Past battles (arena + friendly) with replay links and W/L. Mostly unchanged.

Remove: **Incoming** tab (no more pending challenges), **Challenge** tab search-for-opponent flow.

### `/battle/$id` Replay Page

Unchanged — already polished.

### Team Picker

Largely reusable from current implementation. Now manages exactly 2 teams (offense/defense) instead of N presets.

---

## Scope: MVP

### Web App

- [x] `/battle/$id` replay page (player badges, rarity-styled teams, KO overlays, turn-grouped log, event icons)
- [x] Battle stats on profile page (rating, tier badge, W/L record, win rate)
- [x] Battle-ready indicators (swords badge on cards, filter in collection/encyclopedia/gacha)
- [x] Battle stats inspection in CreatureModal (role, stat bars, abilities with popovers)
- [ ] Rework `/battle` tabs: Arena, Teams, History (remove Incoming, Challenge)
- [ ] Offense/defense team management (replace preset CRUD)
- [ ] Arena opponent browser with defense team previews
- [ ] Arena attack flow (pick opponent → instant result)
- [ ] Daily attack counter display (X/5)

### Discord Bot

- [ ] `/battle @user` — friendly battle, instant resolution, public result
- [ ] `/arena` — ranked matchmaking with opponent select menu
- [ ] `MESSAGE_COMPONENT` handler for arena opponent selection
- [ ] Battle result embed (teams, key moments, rating changes)
- [ ] Update `/battles` for new schema
- [ ] Register new/updated commands

### Backend

- [ ] `battle_team` table + migration (replaces `battle_team_preset`)
- [ ] `battle_log` table + migration (replaces `battle_challenge`)
- [ ] Add `arena_attacks_today` + `last_attack_date` to `battle_rating`
- [ ] Offense/defense team CRUD server functions
- [ ] Arena matchmaking query (find opponents near rating with defense teams)
- [ ] Instant battle resolution function (no pending state)
- [ ] Daily attack limit enforcement + midnight UTC reset
- [ ] Migrate existing data (presets → teams, challenges → logs)

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
packages/shared/src/db/schema.ts          # battle_team, battle_log (replace preset + challenge)
web/drizzle/XXXX_battle_v2.sql             # Migration: new tables, data migration

# Backend
web/src/lib/battle.ts                      # Rework: instant resolution, team CRUD, matchmaking
web/src/routes/api/battle.ts               # Rework: new actions (set_team, arena_attack, friendly_attack)

# Web UI
web/src/routes/_app/battle.tsx             # Rework tabs: Arena, Teams, History
web/src/components/battle/ArenaOpponents.tsx  # New: opponent browser
web/src/components/battle/TeamManager.tsx     # New: offense/defense team editor (replaces TeamPresets)
web/src/components/battle/BattleList.tsx      # Update for new schema
web/src/components/battle/BattleReplay.tsx    # Unchanged

# Bot
bot/src/commands/battle.ts                 # Rework: instant friendly battle
bot/src/commands/arena.ts                  # New: ranked matchmaking
bot/src/commands/battles.ts                # Update for new schema
bot/src/commands/rating.ts                 # Unchanged
bot/src/components/arena-select.ts         # New: opponent selection handler
bot/src/lib/battle-embeds.ts               # Update: richer result embed
bot/src/lib/battle-helpers.ts              # Update: remove preset/challenge helpers
bot/register.ts                            # Add /arena, keep /battle /battles /rating

# Remove
bot/src/components/battle-accept.ts        # No more accept flow
bot/src/components/battle-decline.ts       # No more decline flow
bot/src/components/battle-defender-preset.ts  # No more preset selection
web/src/components/battle/IncomingChallenges.tsx  # No more incoming tab
web/src/components/battle/TeamPresets.tsx   # Replaced by TeamManager
```
