# Battle Balance Iteration Guide

Step-by-step process for tuning the 3v3 battle system. Follow this loop to adjust balance and validate with the meta simulation.

## Goal

All 6 roles should have **10-25% meta share** in the genetic algorithm simulation. Average battle length should be **7-10 turns** (long enough for support/tank utility to matter, short enough to keep it interesting).

## Current State (as of 2026-03-04)

### Role Stat Distributions (`packages/shared/src/battle/constants.ts`)

| Role       | HP   | ATK  | DEF  | SPD  | ABL  | Identity                          |
| ---------- | ---- | ---- | ---- | ---- | ---- | --------------------------------- |
| striker    | 0.30 | 0.20 | 0.14 | 0.08 | 0.28 | High damage, slow, back row       |
| tank       | 0.38 | 0.13 | 0.26 | 0.05 | 0.18 | Tanky, protects allies, front row |
| scout      | 0.30 | 0.14 | 0.10 | 0.22 | 0.24 | Fast, fragile, back row           |
| support    | 0.38 | 0.04 | 0.24 | 0.12 | 0.22 | Heals/buffs, survives, back row   |
| bruiser    | 0.30 | 0.16 | 0.18 | 0.12 | 0.24 | Balanced brawler, front row       |
| specialist | 0.32 | 0.02 | 0.14 | 0.09 | 0.43 | ABL-scaling AoE, back row         |

**All distributions must sum to 1.0.**

### Global Damage Scale

`COMBAT_DAMAGE_SCALE = 0.55` in `constants.ts` — multiplies ALL damage output. Lower = longer battles.

### Latest Sim Results

| Role       | Share | Target |
| ---------- | ----- | ------ |
| striker    | 83.4% | 10-25% |
| tank       | 6.1%  | 10-25% |
| scout      | 4.7%  | 10-25% |
| bruiser    | 4.6%  | 10-25% |
| support    | 1.2%  | 10-25% |
| specialist | 0.1%  | 10-25% |

Avg turns: 5.2. **Striker ATK 0.20 is identified as the root cause** — pure stat sim (no abilities) still shows striker at 84%.

### Diagnostic Results

| Scenario                   | Avg Turns | Striker | Tank  | Scout | Bruiser | Support | Specialist |
| -------------------------- | --------- | ------- | ----- | ----- | ------- | ------- | ---------- |
| Pure Stats (no abilities)  | 5.1       | 84.0%   | 4.6%  | 5.0%  | 5.7%    | 0.6%    | 0.0%       |
| Actives only (no passives) | 5.7       | 82.4%   | 4.5%  | 5.8%  | 4.6%    | 2.6%    | 0.0%       |
| Passives only (no actives) | 5.5       | 57.0%   | 38.7% | 2.1%  | 2.1%    | 0.1%    | —          |
| Full (all abilities)       | 5.2       | 83.4%   | 6.1%  | 4.7%  | 4.6%    | 1.2%    | 0.1%       |

Key takeaway: **Stats matter more than abilities.** If pure stats are unbalanced, no amount of ability tuning will fix it.

---

## The Iteration Loop

### Step 1: Identify the Problem

Look at the sim results and figure out what's wrong:

- **One role > 25%**: That role is overpowered. Either nerf its stats/abilities or buff what counters it.
- **One role < 10%**: That role is underpowered. Buff its stats, improve its abilities, or reduce what suppresses it.
- **Avg turns < 5**: Battles too short — burst damage dominates, support/tank can't contribute. Reduce `COMBAT_DAMAGE_SCALE` or nerf ATK.
- **Avg turns > 15**: Battles too long — nobody can kill anything. Increase `COMBAT_DAMAGE_SCALE` or buff ATK.

### Step 2: Choose What to Change

There are 4 levers, ordered from most to least impactful:

#### Lever 1: Role Stat Distributions (HIGHEST IMPACT)

Edit `ROLE_DISTRIBUTIONS` in `packages/shared/src/battle/constants.ts`.

**Rules:**

- All 5 stats must sum to 1.0
- Changes of 0.02-0.04 are significant (at 170 total, 0.02 = ~3.4 stat points)
- ATK is the most impactful stat (directly multiplies damage)
- HP is the second most impactful (determines survivability)
- DEF has diminishing returns (formula: `100 / (100 + def)`)
- SPD determines turn order (higher = goes first)
- ABL amplifies ability damage and heal/buff effectiveness

**IMPORTANT:** You must also update the identical `ROLE_DISTRIBUTIONS` dict in `python/scripts/generate_battle_seed.py` to match. The Python script generates creature stats for the database.

#### Lever 2: Global Damage Scale (HIGH IMPACT)

Edit `COMBAT_DAMAGE_SCALE` in `constants.ts`. This is a simple multiplier on ALL damage.

- 0.45 ≈ 8-10 turn battles
- 0.55 ≈ 5-7 turn battles
- 0.70 ≈ 3-4 turn battles

Does NOT require re-seeding the database (engine-only change).

#### Lever 3: Ability Templates (MEDIUM IMPACT)

Edit `ACTIVE_ABILITY_TEMPLATES` or `PASSIVE_ABILITY_TEMPLATES` in `constants.ts`.

Common ability knobs:

- `multiplier`: Damage multiplier (higher = more damage)
- `cooldown`: Turns between uses (0 = every turn)
- `effectValue`: Heal %, buff %, debuff %, dodge chance, etc.
- `statAffected`: What stat the ability interacts with

**IMPORTANT:** Also update the matching tuple in `ABILITY_TEMPLATES` in `python/scripts/generate_battle_seed.py`.

#### Lever 4: Ability Assignments (LOW IMPACT)

Edit `python/data/battle_abilities.json` to change which creatures get which abilities. This is per-creature and requires re-running the Python seed generator.

### Step 3: Sync Python Script

After editing `constants.ts`, you MUST sync the Python script so the database matches:

**File:** `python/scripts/generate_battle_seed.py`

Sync these sections:

1. `ROLE_DISTRIBUTIONS` dict (must match constants.ts exactly)
2. `ABILITY_TEMPLATES` list (must match all active + passive templates)

### Step 4: Regenerate Database

```bash
# From repo root
cd python && uv run python scripts/generate_battle_seed.py --with-abilities
cd .. && pnpm db:seed:battle:local
```

**Note:** If you only changed `COMBAT_DAMAGE_SCALE` or ability template values (not stat distributions), you can skip this step — those are engine-only changes read at runtime.

### Step 5: Run the Meta Simulation

```bash
cd tools/battle-sim
pnpm sim:meta --population 200 --generations 50 --matches 30 --normalize-stats
```

**Always use `--normalize-stats`** — this scales all creatures to 170 total stats, removing rarity advantages and isolating role balance.

The sim runs a genetic algorithm:

- 200 teams of 3 creatures each
- 50 generations of evolution
- 30 matches per team per generation
- Top 25% (top-quartile) teams define the meta

**Output to look at:**

- `META ROLE DISTRIBUTION` — the main balance metric (target: all roles 10-25%)
- `Avg turns / match` — battle length (target: 7-10)
- `FITNESS PROGRESSION` — shows if meta is converging or oscillating

### Step 6: Diagnostic Runs (Optional)

Use these flags to isolate problems:

```bash
# Basic attacks only (no special abilities, passives still active)
pnpm sim:meta --population 200 --generations 50 --matches 30 --normalize-stats --no-actives

# No passives (active abilities work, passives disabled)
pnpm sim:meta --population 200 --generations 50 --matches 30 --normalize-stats --no-passives

# Pure stats (no abilities at all — basic attack only, no passives)
pnpm sim:meta --population 200 --generations 50 --matches 30 --normalize-stats --no-actives --no-passives
```

**If pure stats are imbalanced, fix stats first.** Ability tuning won't fix a stat problem.

### Step 7: Evaluate and Repeat

Compare results to the target (all roles 10-25%, 7-10 avg turns). If not there yet, go back to Step 1.

**Common patterns and fixes:**

| Pattern                          | Likely Cause                                            | Fix                                                            |
| -------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------- |
| One damage role dominates (>40%) | ATK too high for that role                              | Reduce that role's ATK, redistribute to HP/ABL                 |
| Tank dominates (>40%)            | Battles too long, nobody can kill tanks                 | Increase `COMBAT_DAMAGE_SCALE`, reduce tank HP/DEF             |
| Support/specialist near 0%       | Battles too short (< 5 turns)                           | Decrease `COMBAT_DAMAGE_SCALE`, nerf highest-ATK roles         |
| Scout dominates                  | High HP + high SPD + back row = unkillable              | Reduce scout HP (they should be glass cannons)                 |
| Bruiser dominates                | Front row + high ATK + decent survivability             | Reduce bruiser ATK, shift to ABL                               |
| Specialist always 0%             | Only 22 specialists in pool (5.3%), AoE damage too weak | Buff specialist HP/DEF for survivability, buff AoE multipliers |

---

## Architecture Reference

### How Stats Flow

```
constants.ts (ROLE_DISTRIBUTIONS)
        ↓
generate_battle_seed.py (computes creature stats from role + rarity)
        ↓
battle_seed.sql (INSERT statements)
        ↓
local D1 database (pnpm db:seed:battle:local)
        ↓
battle-sim/src/db.ts (loads creatures from DB)
        ↓
battle-sim/src/runner.ts (builds teams, runs battles)
        ↓
shared/battle/engine.ts (simulateBattle)
        ↓
shared/battle/damage.ts (damage formula, applies COMBAT_DAMAGE_SCALE)
```

### How Abilities Flow

```
constants.ts (ACTIVE/PASSIVE_ABILITY_TEMPLATES)
        ↓ (templates are loaded at runtime by the engine)
engine.ts → resolveAbility() looks up template by ID
        ↓
abilities.ts (resolveDamage, resolveBuff, resolveHeal, etc.)
        ↓
damage.ts (calculateDamage — applies multiplier, DEF mitigation, crits, etc.)
```

### Damage Formula

```
rawDamage = stat × multiplier × ablAmplifier × critMultiplier
          × defMitigation × variance × dietMod × backRowBonus
          × COMBAT_DAMAGE_SCALE

Where:
  stat = ATK (normal), ABL (abl_scaling), or DEF (def_scaling)
  ablAmplifier = ATK-based: 1 + abl/350, ABL-based: 1 + abl/200
  defMitigation = 100 / (100 + defender.def)  [skipped for ignore_def]
  variance = random(0.9, 1.1)
  critMultiplier = 10% chance for 1.5x (1.25x vs armored_plates)
```

### Row Assignment

- **Front row:** tank, bruiser
- **Back row:** striker, scout, support, specialist
- Single-target attacks prioritize front row
- If no front row creature, first member is forced to front

### Creature Pool Distribution

| Role       | Count | % of Pool |
| ---------- | ----- | --------- |
| tank       | 106   | 25.5%     |
| scout      | 80    | 19.3%     |
| bruiser    | 79    | 19.0%     |
| striker    | 71    | 17.1%     |
| support    | 57    | 13.7%     |
| specialist | 22    | 5.3%      |

Specialist's tiny pool (22 creatures) limits their meta presence even if individually strong.

---

## Files to Edit

| File                                      | What to Change                                      | Requires DB Re-seed?        |
| ----------------------------------------- | --------------------------------------------------- | --------------------------- |
| `packages/shared/src/battle/constants.ts` | Role distributions, ability templates, damage scale | Only for stat distributions |
| `python/scripts/generate_battle_seed.py`  | Must mirror constants.ts distributions + templates  | Yes (it generates the seed) |
| `packages/shared/src/battle/damage.ts`    | Damage formula, scaling mechanics                   | No                          |
| `packages/shared/src/battle/abilities.ts` | Ability resolution logic                            | No                          |
| `packages/shared/src/battle/ai.ts`        | AI targeting/scoring                                | No                          |
| `packages/shared/src/battle/engine.ts`    | Battle loop, passive application                    | No                          |
| `python/data/battle_abilities.json`       | Per-creature ability assignments                    | Yes                         |

---

## Quick Reference Commands

```bash
# Full iteration cycle (from repo root):
cd python && uv run python scripts/generate_battle_seed.py --with-abilities
cd .. && pnpm db:seed:battle:local
cd tools/battle-sim && pnpm sim:meta --population 200 --generations 50 --matches 30 --normalize-stats

# Engine-only changes (no DB re-seed needed):
cd tools/battle-sim && pnpm sim:meta --population 200 --generations 50 --matches 30 --normalize-stats

# Quick diagnostic run (smaller population, faster):
cd tools/battle-sim && pnpm sim:meta --population 100 --generations 25 --matches 20 --normalize-stats
```
