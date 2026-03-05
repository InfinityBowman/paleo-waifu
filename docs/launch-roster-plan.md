# Reduced Battle Roster for Launch

## Context

Battle system has 415 creatures with auto-assigned roles (via TYPE_TO_ROLE) and batch-generated abilities. Too complex to balance. Launching with a minimal 4-role, 8-creature roster where **everything is hand-defined per creature** in a single config file. No auto-assignment, no derivation.

## 4 Launch Roles

| Role       | Identity                      | Key Stat      |
| ---------- | ----------------------------- | ------------- |
| striker    | Physical damage dealer        | High ATK      |
| tank       | Absorbs hits, protects allies | High HP + DEF |
| support    | Heals and buffs allies        | High HP + ABL |
| specialist | Ability-based damage (AoE)    | Very high ABL |

## Launch Roster Config

New file: `python/data/launch_roster.json` — single source of truth for every launch creature. Each entry fully defines the creature's battle identity: role + all 3 ability slots. No auto-assignment logic involved.

```json
[
  {
    "creatureId": "06b921acce773fc9d5879",
    "name": "Tyrannosaurus",
    "role": "striker",
    "active1": {
      "templateId": "crushing_jaw",
      "displayName": "Tyrant's Crushing Bite"
    },
    "active2": { "templateId": "apex_roar", "displayName": "Apex Roar" },
    "passive": { "templateId": "apex_predator", "displayName": "Apex Predator" }
  },
  {
    "creatureId": "cd08a4eaabb034d94ecc3",
    "name": "Carnotaurus",
    "role": "striker",
    "active1": { "templateId": "horn_charge", "displayName": "Bull Horn Rush" },
    "active2": { "templateId": "primal_surge", "displayName": "Primal Surge" },
    "passive": {
      "templateId": "predator_instinct",
      "displayName": "Blood Frenzy"
    }
  },
  {
    "creatureId": "5da306ca1959a51f1c551",
    "name": "Stegosaurus",
    "role": "tank",
    "active1": {
      "templateId": "tail_sweep",
      "displayName": "Thagomizer Sweep"
    },
    "active2": { "templateId": "taunt", "displayName": "Plated Stance" },
    "passive": {
      "templateId": "armored_plates",
      "displayName": "Armored Plates"
    }
  },
  {
    "creatureId": "b93aab5eb3f01fdd74c6f",
    "name": "Ankylosaurus",
    "role": "tank",
    "active1": { "templateId": "provoke", "displayName": "Club Tail Provoke" },
    "active2": { "templateId": "shield_wall", "displayName": "Fortress Shell" },
    "passive": {
      "templateId": "retaliate",
      "displayName": "Spined Retaliation"
    }
  },
  {
    "creatureId": "9f1da2a89c1bf3afafabb",
    "name": "Parasaurolophus",
    "role": "support",
    "active1": {
      "templateId": "screech",
      "displayName": "Resonating Crest Call"
    },
    "active2": { "templateId": "rally_cry", "displayName": "Herd Rally" },
    "passive": {
      "templateId": "herd_mentality",
      "displayName": "Herd Mentality"
    }
  },
  {
    "creatureId": "c60f619101bf1c709a58d",
    "name": "Maiasaura",
    "role": "support",
    "active1": { "templateId": "rally_cry", "displayName": "Nurturing Call" },
    "active2": { "templateId": "symbiosis", "displayName": "Maternal Bond" },
    "passive": {
      "templateId": "regenerative",
      "displayName": "Good Mother's Grace"
    }
  },
  {
    "creatureId": "20c8c6f8d9d68645b928e",
    "name": "Elasmosaurus",
    "role": "specialist",
    "active1": { "templateId": "constrict", "displayName": "Serpentine Coil" },
    "active2": { "templateId": "tidal_wave", "displayName": "Tidal Wave" },
    "passive": {
      "templateId": "aquatic_adaptation",
      "displayName": "Deep Sea Adaptation"
    }
  },
  {
    "creatureId": "8a38a0445fb72578e4397",
    "name": "Ichthyosaurus",
    "role": "specialist",
    "active1": { "templateId": "dive_attack", "displayName": "Torpedo Dive" },
    "active2": { "templateId": "armor_break", "displayName": "Pressure Crush" },
    "passive": { "templateId": "evasive", "displayName": "Slippery Swimmer" }
  }
]
```

## Stat Distribution Changes

Update `ROLE_DISTRIBUTIONS` in both `constants.ts` and `generate_battle_seed.py`:

| Role       | hp       | atk      | def      | spd      | abl      | Changes from Current                      |
| ---------- | -------- | -------- | -------- | -------- | -------- | ----------------------------------------- |
| striker    | 0.30     | **0.15** | 0.14     | **0.10** | **0.31** | ATK -0.04, SPD +0.02, ABL +0.02           |
| tank       | **0.41** | **0.10** | **0.28** | 0.05     | **0.16** | HP +0.03, ATK -0.03, DEF +0.02, ABL -0.02 |
| support    | 0.38     | 0.04     | 0.24     | 0.12     | 0.22     | (unchanged)                               |
| specialist | **0.30** | 0.02     | **0.12** | **0.12** | **0.44** | HP -0.02, DEF -0.02, SPD +0.03, ABL +0.01 |

Also reduce `COMBAT_DAMAGE_SCALE` from `0.60` → `0.50`.

## Seed Script Changes (`generate_battle_seed.py`)

Rework to use `launch_roster.json` as the source of truth:

1. Load `launch_roster.json`
2. For each entry: look up the creature in D1 (for rarity), compute stats from `role × ROLE_DISTRIBUTIONS × rarity`, emit `creature_battle_stats` INSERT
3. For each entry: emit `creature_ability` INSERTs directly from the config (no separate `battle_abilities.json` needed)
4. Still emit all `ability_template` INSERTs (engine needs them at runtime)

The `TYPE_TO_ROLE`, `DIET_TO_ROLE`, and `battle_abilities.json` are **no longer used** for launch creatures. They stay in the codebase for future full-rollout but the launch path bypasses them entirely.

## Sim Tool Changes

### 1. `reports/role.ts` — Lower threshold from `>= 3` to `>= 2` creatures per role

### 2. `reports/meta.ts` — Add exhaustive mode

With 8 creatures there are only `C(8,3) = 56` possible teams. Instead of a genetic algorithm sampling randomly, exhaustive mode evaluates **every team vs every other team** — 1,540 matchups total. This gives exact win rates with zero statistical noise.

**Trigger:** Add `--exhaustive` flag. Auto-enable when `C(n,3) <= 500` (i.e. pool of ~12 or fewer creatures). The GA is still available via `--no-exhaustive` for larger pools.

**How it works:**

1. Generate all `C(n,3)` unique 3-creature teams
2. For each team, assign rows using existing `assignRow()` logic
3. Run every team vs every other team, N trials each (default 10-20 for RNG averaging)
4. Compute exact win rate per team, then aggregate to role share by counting role appearances in top-quartile teams weighted by win rate

**Output:** Same format as current meta report (role distribution, team leaderboard, creature leaderboard) but labeled as "EXHAUSTIVE" instead of "GENETIC ALGORITHM". Results are deterministic given enough trials per matchup.

**Why this is better for small pools:** The GA with `--population 200` when there are only 56 possible teams means massive duplication, instant convergence, and meaningless "generation" progression. Exhaustive mode gives the true answer directly.

## Files to Modify

1. **`python/data/launch_roster.json`** — NEW: single config defining all 8 creatures (role + abilities)
2. **`python/scripts/generate_battle_seed.py`** — Rework to read `launch_roster.json`, bypass `TYPE_TO_ROLE` / `battle_abilities.json`
3. **`packages/shared/src/battle/constants.ts`** — `ROLE_DISTRIBUTIONS` (4 roles) + `COMBAT_DAMAGE_SCALE`
4. **`tools/battle-sim/src/reports/meta.ts`** — Add exhaustive mode (all teams vs all teams)
5. **`tools/battle-sim/src/index.ts`** — Add `--exhaustive` flag
6. **`tools/battle-sim/src/reports/role.ts`** — Lower minimum creatures per role from 3 → 2
7. **`docs/balance-iteration-guide.md`** — Update with new roster approach + exhaustive sim usage

## Future Expansion

To add a creature: add an entry to `launch_roster.json` with its role and abilities, re-run seed. That's it.

To add scout/bruiser roles: add entries, add stat distributions for those roles. The engine already supports all 6 roles.

To do full rollout: switch the seed script back to the automated `TYPE_TO_ROLE` + `battle_abilities.json` path (or keep using the config file and add all 415 entries to it).
