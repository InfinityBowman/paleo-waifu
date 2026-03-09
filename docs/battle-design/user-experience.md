# Battle User Experience

Challenge lifecycle, rating, Discord UX, web UX, and rollout strategy. For core mechanics, see [mechanics.md](./mechanics.md). For the ability system, see [abilities.md](./abilities.md).

---

## Challenge Lifecycle

```
CHALLENGE CREATED (challenger picks team)
  -> PENDING
    -> Accepted (defender picks team) -> RESOLVED
    -> Declined -> DECLINED
    -> 24h passes -> EXPIRED
    -> Challenger cancels -> CANCELLED
```

### Limits

- Max 3 active outgoing challenges per player
- Max 5 pending incoming challenges per player
- Cannot challenge yourself
- Cannot challenge someone you already have a pending challenge with
- No creature locking -- same creature can be on multiple active challenges (no stakes to protect)

---

## Duplicate Creatures in Battle

**No duplicate creatures allowed on the same team.** Each of the 3 slots must be a different creature species. This forces roster diversity and makes collection breadth matter.

Type synergies reward same-type but different-species teams (e.g., two different ceratopsians).

---

## Rating System

Simple win/loss tracking with a cosmetic arena tier. Purely visual -- no matchmaking restriction, no rewards, no stakes. Just a badge on your profile.

- **Starting rating:** 1000
- **Win:** +25 rating
- **Loss:** -20 rating (floor of 0 -- can't go negative)

Flat point changes keep it simple and approachable. Can be upgraded to ELO later if competitive depth is needed.

### Arena Tiers (cosmetic only)

| Tier    | Rating    |
| ------- | --------- |
| Bronze  | 0-999     |
| Silver  | 1000-1499 |
| Gold    | 1500-1999 |
| Diamond | 2000-2499 |
| Apex    | 2500+     |

---

## Discord UX

### Commands

```
/battle @user     -- Challenge a player
/accept           -- Accept incoming challenge (opens team picker)
/decline          -- Decline incoming challenge
/battles          -- View active challenges + recent history (ephemeral)
/team             -- View your current default team
/rating [@user]   -- View battle rating and arena tier
```

### Team Picking

`/battle @opponent` -> ephemeral select menus to pick 3 creatures -> assign front/back row via buttons -> confirm -> public challenge embed in channel.

### Battle Result Embed

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
Alice 1245 (+25) Silver | Bob 1312 (-20) Gold

Full replay: paleowaifu.com/battle/abc123
```

---

## Web App UX

- `/battle` -- Tabs: Challenge (search opponent, pick team), Incoming (pending challenges), History (past battles with replays)
- `/battle/:id` -- Full turn-by-turn replay page with creature cards, HP bars, and narration. Shareable link.
- **Team picker:** Collection view filtered to battle-ready creatures, drag/click to fill 3 slots, assign front/back row, shows synergy bonuses in real-time.

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

1. **Fan favorites** -- creatures players already pull for and show off
2. **Iconic animals** -- T-Rex, Triceratops, Velociraptor, Mammoth, etc.
3. **Data completeness** -- type, diet, era, description, image all present
4. **Visual diversity** -- mix of dinosaurs, mammals, marine, insects
5. **Ability coverage** -- each of the 15 actives and 13 passives appears on at least 1-2 creatures

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
- Team presets (save/load team compositions)
- Spectator mode (live narration in Discord channel)
- Additional triggers: `atHpThreshold`, `onCrit`, `onDodge`
- Additional effects: `cleanse` (remove debuffs), `revive` (restore KO'd ally), `stat_steal`
- Ability evolution: higher rarity creatures unlock enhanced versions of the same ability
