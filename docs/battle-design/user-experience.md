# Battle User Experience

Arena, friendly battles, rating, Discord UX, web UX, and rollout strategy. For core mechanics, see [mechanics.md](./mechanics.md). For the ability system, see [abilities.md](./abilities.md).

---

## Battle Flow (v2 — Async Arena)

All battles resolve instantly. No pending/accept flow. Players set an offense team (for attacking) and a defense team (for being attacked).

### Arena (Ranked)

```
Player opens Arena tab
  → Sees daily attack counter (X/5)
  → Clicks "Find Opponents"
  → Sees ~4 opponents near their rating with defense team previews
  → Picks one to attack
  → Battle resolves instantly (offense vs defense)
  → Redirected to replay page
  → Rating updated, daily counter incremented
```

### Friendly Battle

```
Player searches for opponent by username
  → Clicks "Battle"
  → Battle resolves instantly (offense vs defense)
  → Redirected to replay page
  → No rating change, no daily limit
```

### Limits

- 5 arena attacks per day (resets at midnight UTC)
- No limit on friendly battles
- Cannot attack yourself
- Target must have a defense team set
- No creature locking — same creature can be on both offense and defense teams

---

## Duplicate Creatures in Battle

**No duplicate creatures allowed on the same team.** Each of the 3 slots must be a different creature species. This forces roster diversity and makes collection breadth matter.

Type synergies reward same-type but different-species teams (e.g., two different ceratopsians).

---

## Rating System

Simple win/loss tracking with cosmetic arena tiers. Only arena battles affect rating.

- **Starting rating:** 0
- **Win:** +25 rating
- **Loss:** -20 rating (floor of 0 — can't go negative)

Flat point changes keep it simple and approachable. Can be upgraded to ELO later if competitive depth is needed.

### Arena Tiers (cosmetic only)

| Tier    | Rating    |
| ------- | --------- |
| Bronze  | 0-499     |
| Silver  | 500-999   |
| Gold    | 1000-1499 |
| Diamond | 1500-1999 |
| Apex    | 2000+     |

---

## Discord UX

### Commands

Bot battle commands are currently stubbed, redirecting users to the web app while the v2 web UI is being built. Planned commands:

```
/battle @user     -- Friendly battle (instant resolve, no rating change)
/arena            -- Ranked: browse opponents, pick one to attack
/battles          -- View recent battle history (updated, uses battle_log)
/rating [@user]   -- View battle rating and arena tier (unchanged)
```

### Battle Result Embed (Planned)

```
--- ARENA BATTLE --- @Alice vs @Bob
========================================

Alice's Team           Bob's Team
-- Triceratops         -- T-Rex
-- Ankylosaurus        -- Spinosaurus
-- Velociraptor        -- Pteranodon

Synergies: Cretaceous +3%  |  Carnivore ATK +10%

Key Moments:
- T-Rex's Tyrant Bite KOs Ankylosaurus (Turn 3)
- Velociraptor's Sickle Slash crits Pteranodon for 89 dmg (Turn 4)
- Triceratops finishes Spinosaurus with Horn Rush (Turn 7)

Alice wins in 9 turns (2 remaining vs 0)
Alice 1245 (+25) Gold | Bob 1312 (-20) Diamond

Full replay: paleowaifu.com/battle/abc123
```

---

## Web App UX

### `/battle` — Four Tabs

- **Arena** — Daily attack counter (pip dots), "Find Opponents" button, opponent cards showing defense team previews with attack button
- **Teams** — Two `BattleTeamPicker` instances (offense + defense) with Save/Clear buttons
- **Friendly** — Search for a user by username, instant battle button, redirects to replay
- **History** — Battle log with WIN/LOSS/DRAW badges, mode label (Arena/Friendly), rating change display, links to replays

### `/battle/$id` — Replay Page

Full turn-by-turn replay with creature cards, HP bars, and narration. Shareable link. Shows attacker vs defender with team compositions, synergies, and grouped turn events.

### Team Picker

Collection view filtered to battle-ready creatures. Click to fill 3 slots, assign front/back row. Shows synergy bonuses in real-time via `SynergyPreview` component. Same picker used for both offense and defense teams.

### Opponent Cards (Arena)

Each opponent card shows:

- Avatar, username, arena tier, rating
- 3 defense team creatures with rarity-colored borders and role labels
- Attack button (disabled if daily limit reached)

---

## Battle-Ready Rollout

Not all 600+ creatures launch with battle data. Roll out in tight, curated waves.

### Waves

| Wave        | Count     | Criteria                                                               | When                  |
| ----------- | --------- | ---------------------------------------------------------------------- | --------------------- |
| **Wave 1**  | 40        | Hand-curated: iconic creatures, complete data, even role/rarity spread | Launch                |
| **Wave 2**  | 40-60     | LLM-assisted ability assignment with human review                      | 2-4 weeks post-launch |
| **Wave 3**  | 60-80     | LLM-assisted, light review                                             | Ongoing (~monthly)    |
| **Wave 4+** | Remainder | Bulk assignment as data is enriched                                    | Ongoing               |

### Wave 1 Composition (40 creatures)

| Rarity   | Per Role | Total | Notes                   |
| -------- | -------- | ----- | ----------------------- |
| Common   | 4        | 16    | Most players start here |
| Uncommon | 3        | 12    | Accessible upgrades     |
| Rare     | 2        | 8     | Rewarding pulls         |
| Epic     | 1        | 4     | Chase targets           |

Selection criteria:

1. **Fan favorites** — creatures players already pull for and show off
2. **Iconic animals** — T-Rex, Triceratops, Velociraptor, Mammoth, etc.
3. **Data completeness** — type, diet, era, description, image all present
4. **Visual diversity** — mix of dinosaurs, mammals, marine, insects
5. **Ability coverage** — each of the 15 actives and 13 passives appears on at least 1-2 creatures

Creatures not in the current wave are visible in collection/encyclopedia but show "Not yet battle-ready" and can't be selected for teams. Each wave release is a mini-event that brings players back.

---

## Future Hooks (Not at Launch)

- Fossil stakes (friendly / standard / high tiers with ante + pot)
- ELO-based rating (replace flat +25/-20 with proper ELO math)
- Ranked seasons with cosmetic rewards
- Arena tier rewards (rating thresholds unlock cosmetics or bonuses)
- Ascension tier battle stat multipliers
- Creature XP + leveling (level 1-30, stats scale per level)
- PvE expeditions (idle auto-battle against procedural encounters)
- Grand Arena (5-creature teams)
- Spectator mode (live narration in Discord channel)
- Additional triggers: `atHpThreshold`, `onCrit`, `onDodge`
- Additional effects: `cleanse` (remove debuffs), `revive` (restore KO'd ally), `stat_steal`
- Ability evolution: higher rarity creatures unlock enhanced versions of the same ability
- Defense team activity log ("X attacked you while you were away")
- Bonus arena attacks from daily login rewards
