# Battle Analytics Pipeline

How to use real battle data from live play to inform balance decisions alongside simulation data. For the battle system itself, see [mechanics.md](./mechanics.md). For ability details, see [abilities.md](./abilities.md).

---

## Overview

The balance UI currently uses two simulation modes (meta sim and field sim) to evaluate balance. Once live battles ship, real player data becomes a third data source — the ground truth. The engine output is identical whether a battle is simulated or real, so the same analytics apply.

## Data Available Per Battle

Every `battleLog` entry stores the full `BattleResult` from `simulateBattle()`:

**Top-level** (fast to query):

- Winner (A/B), reason (ko/timeout), turn count
- Team A/B HP remaining (percentage)
- RNG seed (deterministic replay)

**`finalState`** (per-creature snapshot at battle end):

- HP remaining, alive/dead, all stats, role, abilities, row, rarity, era, diet, type

**`log`** (every event, granular):

- `creature_action` — ability usage (who, what ability, targets)
- `damage` — amount, source, target, crit, dodge
- `heal` — amount, source, target
- `shield_absorbed` — absorption amount
- `ko` — who died, what turn
- `status_applied` / `status_tick` — buffs, debuffs, DoTs
- `synergy_applied` — which synergy bonuses fired
- `passive_trigger` — passive ability activations
- `reflect_damage` — reflect damage events

**From the battle log record** (not in BattleResult):

- `attackerTeam` / `defenderTeam` — full team compositions with creature IDs, rows
- Player IDs, ratings, mode (arena/friendly), timestamp

## Metrics Derivable from Real Data

Maps 1:1 to what the balance UI sims already produce:

| Sim Metric                        | Real Data Equivalent                                       |
| --------------------------------- | ---------------------------------------------------------- |
| Creature win rate                 | Win rate from all battles featuring that creature          |
| Role matchup matrix               | Win rates by role composition vs opponent role composition |
| Ability impact                    | Win rate of teams containing creatures with ability X      |
| Comp win rates                    | Win rate by role composition (e.g. striker/tank/support)   |
| Synergy value                     | Win rate with vs without each synergy type                 |
| Turn distribution                 | Histogram of turn counts from real battles                 |
| Balance scorecard (Gini, spread)  | Same formulas applied to real creature win rates           |
| Ability usage stats               | From `creature_action` log events                          |
| Damage/healing/shielding per role | From `damage`, `heal`, `shield_absorbed` events            |

Key difference: sims give 10K+ battles instantly, real data trickles in. Use minimum sample thresholds (e.g. 50+ games) before drawing conclusions from real win rates.

## Archive Pipeline

D1 keeps only the last 30 days of battle data for active queries. Older battles are archived to R2 on a ~30 day cycle.

### Flow

```
D1 (battleLog)
  → Every ~30 days: pull battles older than 30 days
  → Write to R2 as JSON/NDJSON (batched by date range)
  → Delete archived rows from D1
```

### Processing

Archived data in R2 is processed in batch to compute aggregate stats:

1. Pull archived JSON from R2
2. Parse `BattleResult` + team composition per battle
3. Compute aggregates (creature win rates, role matchups, ability impact, etc.)
4. Output in the same shape as field sim results
5. Feed into balance UI as a "Live Data" view

Python scripts in `python/scripts/` are a natural home for the ETL. Alternatively, a script in `tools/battle-sim/` that reads archived JSON instead of running simulations.

### Time Slicing

Since each record has a timestamp, analytics can be sliced by period:

- Last 30 days (from D1 directly)
- Last 90 days, last season, all-time (from R2 archives)
- Before/after a balance patch (compare periods)

## Balance UI Integration

A third data source alongside meta sim and field sim. Could be:

- A "Live" toggle on the results tab alongside Meta Sim / Field Sim
- Or a separate analysis tool that imports pre-computed aggregate files

The aggregate output should match the existing `FieldResult` shape where possible so existing visualization components can be reused (creature win rate tables, role matchup matrix, ability impact rankings, balance scorecard).

## No Schema Changes Needed

The battle plan already stores everything required in `battleLog.result`. No additional columns or tables are needed to support analytics — it's purely a processing and presentation concern on top of existing data.
