# Battle System — Implementation Plan

Technical implementation details for the battle system described in `battle-mechanics-design.md`.

---

## Table of Contents

1. [Database Schema](#database-schema)
2. [Stat & Ability Generation Pipeline](#stat--ability-generation-pipeline)
3. [Battle Engine](#battle-engine)
4. [Balance Simulation Tooling](#balance-simulation-tooling)
5. [Build Order](#build-order)

---

## Database Schema

```sql
-- Battle stats for each creature (seeded from generation pipeline)
CREATE TABLE creature_battle_stats (
  creature_id TEXT PRIMARY KEY REFERENCES creature(id),
  role TEXT NOT NULL,           -- striker, tank, scout, support, bruiser, specialist
  hp INTEGER NOT NULL,
  atk INTEGER NOT NULL,
  def INTEGER NOT NULL,
  spd INTEGER NOT NULL,
  abl INTEGER NOT NULL
);

-- Ability templates (the shared pool)
CREATE TABLE ability_template (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,           -- active, passive
  category TEXT NOT NULL,       -- damage, aoe_damage, buff, debuff, heal, shield, stun, passive
  target TEXT,                  -- single_enemy, all_enemies, self, all_allies, random_enemy
  multiplier REAL,
  cooldown INTEGER,
  duration INTEGER,
  stat_affected TEXT,
  effect_value REAL,
  description TEXT NOT NULL
);

-- Creature-specific ability assignments
CREATE TABLE creature_ability (
  id TEXT PRIMARY KEY,
  creature_id TEXT NOT NULL REFERENCES creature(id),
  template_id TEXT NOT NULL REFERENCES ability_template(id),
  slot TEXT NOT NULL,           -- active1, active2, passive
  display_name TEXT NOT NULL,   -- creature-specific variant name
  UNIQUE(creature_id, slot)
);

-- Battle challenges
CREATE TABLE battle_challenge (
  id TEXT PRIMARY KEY,
  challenger_id TEXT NOT NULL REFERENCES user(id),
  defender_id TEXT NOT NULL REFERENCES user(id),
  status TEXT NOT NULL,         -- pending, resolved, declined, expired, cancelled
  challenger_team TEXT NOT NULL, -- JSON: [{userCreatureId, row}]
  defender_team TEXT,           -- JSON: [{userCreatureId, row}] — null until accepted
  result TEXT,                  -- JSON: full battle log — null until resolved
  winner_id TEXT REFERENCES user(id),
  created_at INTEGER DEFAULT (unixepoch()),
  resolved_at INTEGER
);

-- Player battle rating (cosmetic only)
CREATE TABLE battle_rating (
  user_id TEXT PRIMARY KEY REFERENCES user(id),
  rating INTEGER NOT NULL DEFAULT 1000,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER DEFAULT (unixepoch())
);
```

### Battle-Ready Check

The `creature_battle_stats` table only has rows for battle-ready creatures. If a creature has no row in `creature_battle_stats`, it's not battle-eligible — no extra flag needed. New waves become available by seeding more rows.

---

## Stat & Ability Generation Pipeline

Hybrid approach: deterministic rules for stats, LLM for ability selection.

```
Production D1 (creature table)
  → Rules engine: assign role from type/diet
  → Rules engine: calculate stats from role + rarity + ID hash
  → LLM (batch): pick 2 actives + 1 passive from template pools, generate flavor name variants
  → Validator: ensure all picks exist in template pool, stats in expected range
  → Human review: epic + legendary creatures only (~55)
  → Write back to D1 (creature_battle_stats + creature_ability tables)
```

### Type-to-Role Mapping

```typescript
const TYPE_TO_ROLE: Record<string, Role> = {
  'large theropod': 'striker',
  'small theropod': 'scout',
  sauropod: 'tank',
  'armoured dinosaur': 'tank',
  ceratopsian: 'bruiser',
  euornithopod: 'support',
  Pterosauria: 'scout',
  Ichthyosauria: 'specialist',
  Plesiosauria: 'specialist',
  Eurypterida: 'striker',
  Saurischia: 'bruiser',
  Ornithischia: 'bruiser',
  Crocodylia: 'bruiser',
  Squamata: 'scout',
  Reptilia: 'bruiser',
  Proboscidea: 'tank',
  Temnospondyli: 'specialist',
  Mammalia: 'bruiser',
  Perissodactyla: 'bruiser',
  Artiodactyla: 'support',
  Phlyctaeniiformes: 'specialist',
  Actinolepidiformes: 'specialist',
  Cimolesta: 'scout',
  Ichthyornithes: 'scout',
  Hesperornithiformes: 'specialist',
  Lagomorpha: 'scout',
  Rodentia: 'scout',
  Primates: 'support',
  Condylarthra: 'bruiser',
  Multituberculata: 'scout',
  Sirenia: 'support',
  Urodela: 'specialist',
  Anura: 'scout',
  // Trilobites
  Asaphida: 'tank',
  Phacopida: 'bruiser',
  Odontopleurida: 'specialist',
  Corynexochida: 'bruiser',
  Trinucleida: 'support',
  Redlichiida: 'bruiser',
  Bothriolepidiformes: 'specialist',
  Asterolepidiformes: 'tank',
  // Birds
  Anseriformes: 'support',
  Columbiformes: 'scout',
  Charadriiformes: 'scout',
  Galliformes: 'bruiser',
  Sphenisciformes: 'specialist',
}
```

Fallback for null/unknown type: infer from diet (Carnivorous → Striker, Herbivorous → Tank, Piscivorous → Specialist, Omnivorous → Bruiser, Unknown → Bruiser).

### LLM Prompt (for ability assignment)

```
You are assigning battle abilities to a prehistoric creature for a gacha game.

Creature: {{ name }}
Scientific Name: {{ scientificName }}
Type: {{ type }}
Diet: {{ diet }}
Era: {{ era }}
Description: {{ description }}
Assigned Role: {{ role }}

Pick the most thematically appropriate abilities for this creature.

ACTIVE ABILITIES (pick exactly 2 from this list):
[full template list with IDs]

PASSIVE ABILITIES (pick exactly 1 from this list):
[full passive list with IDs]

For each active ability, also provide a creature-specific name variant.
Examples: "Bite" → "Sickle Claw Slash" for Velociraptor, "Tail Sweep" → "Thagomizer Strike" for Stegosaurus.

Respond as JSON:
{
  "active1": { "templateId": "...", "name": "..." },
  "active2": { "templateId": "...", "name": "..." },
  "passive": { "templateId": "..." },
  "reasoning": "one sentence explaining your picks"
}
```

Run with structured output / JSON mode, temperature 0. Validate that `templateId` values exist in the template pool. Batch with Sonnet for cost efficiency (~615 calls).

### Ability Data Shape

```typescript
interface ActiveAbility {
  id: string
  name: string // Display name (creature-specific variant)
  templateId: string // Links to base template for balance
  target:
    | 'single_enemy'
    | 'all_enemies'
    | 'self'
    | 'all_allies'
    | 'random_enemy'
  category:
    | 'damage'
    | 'aoe_damage'
    | 'buff'
    | 'debuff'
    | 'heal'
    | 'shield'
    | 'stun'
  multiplier: number // ATK or ABL scaling factor
  cooldown: number // Turns between uses (0 = usable every turn)
  duration?: number // For buffs/debuffs: how many turns
  statAffected?: string // For buffs/debuffs: which stat
  effectValue?: number // For buffs/debuffs: percentage modifier
  description: string // Flavor text
}
```

---

## Battle Engine

The battle simulation is a **pure function** — teams in, battle log out. No DB access, no side effects, no network. This makes it testable, simulatable, and portable.

### Core Function Signature

```typescript
function simulateBattle(
  teamA: BattleTeam,
  teamB: BattleTeam,
  options: { seed: number }, // Deterministic RNG seed for reproducibility
): BattleResult
```

Same seed = same battle outcome. This enables reproducible bug reports and deterministic simulation.

### Code Location

```
src/lib/battle/
├── engine.ts          # simulateBattle() — the core loop
├── damage.ts          # Damage formula, mitigation, crits
├── abilities.ts       # Ability resolution, status effect application
├── ai.ts              # Ability selection priority logic
├── synergies.ts       # Synergy calculation from team composition
├── types.ts           # TypeScript types for battle state, results, logs
└── constants.ts       # Rarity bases, role distributions, ability templates
```

### Damage Formula Implementation

```
rawDamage = stat * ability.multiplier
  where stat = ATK for physical abilities, ABL for ability-scaling abilities

mitigation = rawDamage * (100 / (100 + defender.DEF))
variance   = mitigation * seededRandom(0.9, 1.1)
dietMod    = getDietModifier(attacker.diet, defender.diet)
finalDamage = max(floor(variance * dietMod), 1)  // minimum 1 damage

Crit: 10% base chance, 1.5x damage (applied before mitigation)
```

---

## Balance Simulation Tooling

The simulation tool imports the battle engine directly — same code that runs in production. No mock, no separate implementation.

### CLI Commands

```bash
pnpm sim                        # Run full balance suite (all reports)
pnpm sim:matchup                # Every creature vs every creature (1v1 round-robin)
pnpm sim:team                   # Random team compositions, thousands of battles
pnpm sim:role                   # Role vs role winrate matrix
pnpm sim:creature <name>        # Deep dive on a specific creature
```

### Tool Location

```
tools/battle-sim/
├── sim.ts              # CLI entry point
├── matchup.ts          # Round-robin 1v1
├── team.ts             # Random team composition battles
├── role.ts             # Role vs role aggregation
├── creature.ts         # Single creature deep dive
├── ability.ts          # Ability impact analysis
└── report.ts           # Output formatting (terminal tables + optional JSON/CSV)
```

### Report 1: Round-Robin Matchup Matrix (1v1)

Run every creature against every creature in a 1v1 (no teams, no synergies) across N trials (e.g., 100 each to account for RNG variance).

**What it catches:**

- **Dominant creatures** — anything with >70% winrate across all matchups is overtuned
- **Useless creatures** — anything with <30% winrate across all matchups needs a buff
- **Rarity sanity check** — expected winrate ranges:
  - Same rarity: 45-55% (balanced)
  - One tier up: 55-65% (advantage but not guaranteed)
  - Two tiers up: 65-80%
  - Legendary vs common: 75-90%

**Output example:**

```
=== WINRATE OUTLIERS (1v1, 100 trials each) ===

OVERPOWERED (>70% avg winrate):
  ⚠️  Tyrannosaurus Rex (legendary/striker) — 89.2% avg winrate
      Worst matchup: vs Ankylosaurus (62%)
      Best matchup: vs Compsognathus (99%)

UNDERPOWERED (<30% avg winrate):
  ⚠️  Microraptor (common/scout) — 22.1% avg winrate
      Best matchup: vs Lesothosaurus (41%)

=== RARITY TIER WINRATES (avg across all matchups) ===
  Legendary vs Common:    82.3%  (expected: 75-90%) ✅
  Legendary vs Uncommon:  71.5%  (expected: 65-80%) ✅
  Epic vs Common:         74.1%  (expected: 65-80%) ✅
  Rare vs Common:         63.2%  (expected: 55-65%) ✅
  Uncommon vs Common:     57.8%  (expected: 55-65%) ✅
```

### Report 2: Role Effectiveness Matrix

Aggregate winrates by role matchup. Checks that no role dominates or is useless.

**Output example:**

```
=== ROLE VS ROLE WINRATES (same rarity, 1000 trials each) ===

              Striker  Tank  Scout  Support  Bruiser  Specialist
Striker         50%    42%    58%     63%      52%       55%
Tank            58%    50%    45%     48%      54%       51%
Scout           42%    55%    50%     56%      47%       53%
Support         37%    52%    44%     50%      43%       48%
Bruiser         48%    46%    53%     57%      50%       51%
Specialist      45%    49%    47%     52%      49%       50%

⚠️  Support winrate is low across the board (avg 45.7%)
    Consider: buff Symbiosis heal from 15% → 20%, or increase ABL scaling
```

### Report 3: Team Composition Analysis

Generate N random legal teams (3 unique creatures, front/back assigned by role heuristic) and run them against each other.

**What it catches:**

- **Degenerate team comps** — "3 legendary strikers always wins" means synergies don't matter
- **Synergy imbalance** — one synergy type dominating over others
- **Formation irrelevance** — if front/back row doesn't affect outcomes

**Output example:**

```
=== TEAM COMP ANALYSIS (10,000 random matchups) ===

Top performing compositions by archetype mix:
  1. Tank + Striker + Scout     — 58.2% winrate
  2. Tank + Bruiser + Support   — 55.1% winrate
  3. Bruiser + Striker + Scout  — 53.8% winrate
  ...
  Last. Scout + Scout + Scout   — 34.2% winrate

Synergy winrate impact:
  All Carnivore (+15% ATK):    +4.2% vs no synergy  ✅
  All Herbivore (+20% DEF):    +3.8% vs no synergy  ✅
  Same Era (+10% all):         +5.1% vs no synergy  ⚠️ (might be too strong)
  Same Type 2x (+10% HP):     +2.1% vs no synergy  ✅
  Same Type 3x (+15%/+10%):   +6.3% vs no synergy  ⚠️ (strong but requires narrow roster)

Formation impact:
  Correct placement (tanks front, scouts back): +7.3% winrate vs random ✅
```

### Report 4: Ability Analysis

Track which abilities contribute most to wins.

**What it catches:**

- Abilities that are too strong or too short cooldown
- Abilities that never contribute meaningfully (dead templates)
- Passives that are strictly better than others

**Output example:**

```
=== ABILITY IMPACT (across 10,000 team battles) ===

Most impactful abilities (highest correlation with winning):
  1. Apex Roar (+15% ATK/DEF all allies) — teams with this win 61%
  2. Headbutt (stun) — 58% winrate when used
  3. Feeding Frenzy (lifesteal) — 57% winrate

Least impactful:
  1. Adrenaline Rush (+30% SPD self) — no measurable winrate impact
  2. Counter Stance (reflect) — 2% winrate impact

Passive rankings (avg winrate contribution):
  1. Predator Instinct (+20% ATK < 50% HP): +4.1%
  ...
  Last. Camouflage (25% dodge chance): +0.8%  ⚠️ Low impact
```

### Report 5: Single Creature Deep Dive

```bash
pnpm sim:creature "Tyrannosaurus Rex"
```

**Output example:**

```
=== TYRANNOSAURUS REX — Deep Dive ===

Role: Striker | Rarity: Legendary | Stats: HP 60 ATK 90 DEF 30 SPD 75 ABL 45
Abilities: Devastating Bite (1.8x ATK, CD 3), Apex Roar (+15% ATK/DEF, CD 5)
Passive: Apex Predator (immune to stun, +10% ATK)

1v1 Record (100 trials each, vs all 289 Wave 1 creatures):
  Overall: 87.3% winrate
  vs Tanks: 72.1%
  vs Strikers: 91.2%
  vs Scouts: 95.8%

  Hardest matchups:
    vs Ankylosaurus (epic/tank): 58%
    vs Triceratops (rare/bruiser): 64%

Team value (winrate delta when added to random 2-creature teams):
  +12.4% winrate — strong team carry

Ability usage patterns:
  Turn 1: Apex Roar (85%), Devastating Bite (15%)
  Turn 2-3: Devastating Bite (100%)
```

### When to Run Simulations

- **After generating battle data** — validate before seeding to DB
- **After tuning any stat or ability** — regression check
- **Before each wave rollout** — verify new creatures don't distort the meta
- **CI integration (optional)** — smoke test on PRs touching battle code, with assertions like "no creature has >90% 1v1 winrate" and "no role has <40% avg winrate"

---

## Build Order

### Phase 1: Data Pipeline

- Define all ability templates and passives
- Build type-to-role mapping
- Build stat generation script
- Run LLM batch for ability assignments (Wave 1: 290 creatures)
- Validate + human review epic/legendary
- Output `creatures_battle.json`
- Create DB tables, seed battle data

### Phase 2: Battle Engine

- Implement `simulateBattle()` as a pure function
- Unit test with known matchups
- Damage formula, status effects, ability AI, turn resolution

### Phase 3: Balance Simulation

- Build simulation CLI (`tools/battle-sim/`)
- Run all 5 reports against Wave 1 data
- Tune stats/abilities based on findings
- Re-seed adjusted data

### Phase 4: Challenge System + Rating

- Challenge lifecycle (create, accept, decline, expire, cancel)
- Win/loss rating tracking (cosmetic tiers)

### Phase 5: Discord Integration

- `/battle`, `/accept`, `/decline`, `/battles`, `/rating` commands
- Team picker via select menus (filtered to battle-ready creatures)
- Result embeds with key moments

### Phase 6: Web UI

- `/battle` route with tabs (Challenge, Incoming, History)
- Team picker component (filtered to battle-ready creatures)
- `/battle/:id` replay page
- Battle leaderboard tab on existing leaderboard page

### Phase 7: Wave 2 + 3 Rollout

- Run generation pipeline for Good tier creatures
- Seed Wave 2 data
- Enrich Partial/Sparse creatures as needed
- Seed Wave 3 data
