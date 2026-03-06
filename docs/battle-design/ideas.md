# Battle Mechanics Design Doc

Deep dive into stats, abilities, battle format, and how to scale it all to 600+ creatures. This supersedes the "Arena Battles" section in `game-design-ascension-battles.md` once we settle on a direction.

---

## Table of Contents

1. [The Discord Constraint](#the-discord-constraint)
2. [Battle Format Options](#battle-format-options)
3. [Stats System Design](#stats-system-design)
4. [Abilities & Skills](#abilities--skills)
5. [Stat & Ability Generation at Scale](#stat--ability-generation-at-scale)
6. [Creature Progression (XP / Leveling)](#creature-progression)
7. [Team Composition & Synergies](#team-composition--synergies)
8. [Matchmaking & Competitive Structure](#matchmaking--competitive-structure)
9. [Recommendation](#recommendation)

---

## The Discord Constraint

Before anything else — the platform shapes the design. Discord slash commands have hard limits:

- **Interaction tokens expire after 15 minutes.** No long-running real-time battles.
- **No persistent UI state.** Each command is a fresh interaction. You can't maintain a "battle screen."
- **Buttons/select menus** can create multi-step flows, but they feel clunky for more than 2-3 steps.
- **Embeds** are the display primitive — rich text + images, but no animation.
- **Deferred responses** let you do server work, but you still need to respond within 15 minutes.

**What this means for battles:**

- Real-time turn-by-turn combat (like Pokemon's "choose your move") is _technically possible_ but awkward. Each turn would be a button click → edit message → wait for opponent button click. Doable, but the UX is mediocre and timeout-prone.
- **Async auto-resolve is the natural fit.** Pick your team, opponent picks theirs, battle resolves instantly. This is exactly what AFK Arena does, and it works beautifully for a bot.
- The web app can do fancier presentation (animations, battle replays with visual flair), but the core mechanic should work great in a text embed.

---

## Battle Format Options

### Option A: Instant Auto-Resolve (Current Design)

What's in the existing doc — pick 3, opponent picks 3, resolve instantly with math. Best-of-3 rounds, each round is a 1v1 power comparison.

**Pros:** Dead simple. Fast. Works perfectly in Discord. Easy to implement.
**Cons:** Shallow. No abilities, no interaction, just bigger-number-wins with randomness. Gets boring fast. No skill expression beyond team selection.

### Option B: Simulated Auto-Battle (AFK Arena Style)

Both players pick a team (3-5 creatures). The server simulates a multi-round battle where creatures take turns attacking, using abilities, and potentially dying. The simulation runs instantly but produces a rich turn-by-turn log that reads like a story.

```
Turn 1: Velociraptor uses Swift Strike on Triceratops (142 dmg)
Turn 1: Triceratops uses Horn Charge on Velociraptor (89 dmg)
Turn 1: Stegosaurus uses Tail Whip (AoE) — hits Velociraptor (67 dmg), Pteranodon (45 dmg)
Turn 2: Velociraptor is KO'd!
Turn 2: T-Rex uses Apex Roar — ATK +30% to all allies
...
```

**Pros:**

- Deep and interesting. Abilities create real strategic variety.
- Still async — no real-time interaction needed. You pick your team, it simulates.
- Produces compelling battle logs that are fun to read and share.
- Creature abilities make each creature feel unique (not just a stat stick).
- Team composition and ordering matters (front line, back line, support).

**Cons:**

- Significantly more complex to build. Need a full combat simulator.
- Need abilities for 600+ creatures (but see generation section below).
- Balance is harder — abilities can create degenerate combos.
- More state to manage (HP pools, buffs, debuffs, turn order).

### Option C: Turn-Based Interactive (Pokemon Style)

Players take turns choosing moves. Each creature has 2-4 abilities, you pick one per turn. Real back-and-forth.

**Pros:** Maximum skill expression. Most engaging moment-to-moment.
**Cons:** **Terrible fit for Discord.** Requires both players online simultaneously. Each turn is a 15-second interaction timeout risk. A 3v3 battle could take 10+ minutes of back-and-forth button clicks. Not fun on mobile Discord. Eliminates the "AFK" appeal entirely.

**Verdict: Eliminated.** The UX would be bad enough to hurt the game.

### Option D: Expedition / PvE Auto-Battle

Instead of (or in addition to) PvP, creatures go on timed expeditions. You send a team, they fight procedurally generated encounters over hours, and you collect rewards when they return. Like AFK Arena's idle rewards.

**Pros:** Engagement loop that doesn't require opponents. Passive content.
**Cons:** Doesn't scratch the competitive itch. Better as a supplementary system, not the core battle mechanic.

### **Recommendation: Option B (Simulated Auto-Battle) with Option A available as "Quick Battle"**

Option B is the sweet spot. It's async-friendly, produces fun content, and gives abilities/stats meaning. The simulation runs server-side in milliseconds — the player experience is still "pick team → see results" but the results are rich and varied.

Quick Battles (Option A) could exist as a lightweight alternative for casual Fossil wagering.

---

## Stats System Design

### The Data Problem

Current creature data is **sparse**:

- Only **330/615** (54%) have `sizeMeters`
- Only **68/615** (11%) have `weightKg`
- **84/615** have no `type` classification
- **90/615** have `Unknown` diet

The existing design's `basePower = (sizeMeters * 10) + (weightKg * 0.1)` breaks down immediately — most creatures would get wildly inconsistent stats based on which fields happen to be populated.

### Approach: Role-Based Stat Templates

Instead of deriving stats from physical measurements, assign each creature a **role** based on its type/diet/characteristics, then use role templates to generate balanced stat distributions.

#### Core Stats (5 stats, simple)

| Stat        | What It Does                                                          |
| ----------- | --------------------------------------------------------------------- |
| **HP**      | Total health pool. Creature is KO'd at 0.                             |
| **ATK**     | Damage dealt by basic attacks and most offensive abilities.           |
| **DEF**     | Flat damage reduction on incoming attacks.                            |
| **SPD**     | Determines turn order. Higher SPD acts first. Ties broken randomly.   |
| **ABILITY** | Amplifies ability damage/healing/effect strength (like a magic stat). |

**Why 5 stats?** Enough for meaningful differentiation, few enough to be instantly readable. AFK Arena has ~20 stats but many are hidden — the player-facing ones are essentially ATK/DEF/HP with speed and crit under the hood. We want something in between — visible enough to reason about, simple enough for a Discord embed.

**Alternative: 3-stat system (simpler)**

| Stat    | What It Does                             |
| ------- | ---------------------------------------- |
| **HP**  | Health pool                              |
| **PWR** | Attack power (both physical and ability) |
| **SPD** | Turn order + dodge chance                |

Fewer stats = easier balance, faster to read, less to generate. DEF could be folded into HP (tanky creatures just have more HP). The tradeoff is less build diversity.

#### Roles (Archetypes)

Each creature gets one role that determines its stat distribution. Roles map naturally to creature types:

| Role           | Stat Priority                  | Creature Types                              |
| -------------- | ------------------------------ | ------------------------------------------- |
| **Striker**    | ATK > SPD > HP > ABILITY > DEF | Large theropods, Eurypterida                |
| **Tank**       | HP > DEF > ATK > ABILITY > SPD | Sauropods, armoured dinosaurs, ceratopsians |
| **Scout**      | SPD > ATK > ABILITY > HP > DEF | Small theropods, Pterosauria                |
| **Support**    | ABILITY > HP > DEF > SPD > ATK | Euornithopods, herbivore mammals            |
| **Bruiser**    | ATK > HP > DEF > SPD > ABILITY | Saurischia, Ornithischia, Crocodylia        |
| **Specialist** | ABILITY > SPD > ATK > HP > DEF | Ichthyosauria, Plesiosauria, Temnospondyli  |

The role → type mapping can be a lookup table with fallbacks:

1. If creature has a known `type`, map it to a role
2. If `type` is null, infer from `diet` (carnivore → Striker/Scout, herbivore → Tank/Support)
3. If diet is also unknown, default to Bruiser (the most "average" distribution)

#### Stat Calculation

```
baseStatTotal = rarityBaseStat[rarity]  // e.g., common=100, uncommon=130, rare=170, epic=220, legendary=300
statDistribution = roleDistributions[role]  // e.g., Striker: {hp: 0.20, atk: 0.30, def: 0.10, spd: 0.25, ability: 0.15}

hp  = baseStatTotal * statDistribution.hp  * individualVariance
atk = baseStatTotal * statDistribution.atk * individualVariance
// ... etc
```

**`individualVariance`**: A per-creature random seed (deterministic, based on creature ID hash) that adds ±10% to each stat. This makes two "common Striker" creatures feel slightly different without requiring manual tuning. The seed is fixed — same creature always gets the same stats.

**`rarityBaseStat`** values mean a legendary creature has ~3x the total stats of a common. This is intentional — rarity should matter in battle, but abilities and synergies let lower-rarity teams compete.

#### Physical Data as Flavor, Not Formula

Size/weight data is **displayed** in battle narration and creature cards but does NOT drive stats. This avoids the sparse data problem entirely. A 35-meter Argentinosaurus and a 2-meter Velociraptor can both be competitive in their roles — the Argentinosaurus isn't 17x stronger just because it's bigger.

If we want size to have _some_ influence, it could be a minor modifier (±5%) within a role, not the primary stat driver.

---

## Abilities & Skills

This is where creatures get interesting. Each creature should have **2-3 abilities** that define how they fight.

### Ability Structure

```typescript
interface Ability {
  name: string // "Tail Whip", "Apex Roar", "Pack Hunt"
  type: 'active' | 'passive'
  target: 'single' | 'all_enemies' | 'self' | 'all_allies' | 'random_enemy'
  effect: AbilityEffect // damage, heal, buff, debuff, etc.
  cooldown: number // turns between uses (0 = every turn)
  description: string // flavor text for display
}
```

### Ability Categories

| Category          | Example                           | Effect                                     |
| ----------------- | --------------------------------- | ------------------------------------------ |
| **Direct Damage** | Claw Strike, Bite, Horn Charge    | Deal ATK-scaled damage to target           |
| **AoE Damage**    | Tail Sweep, Stomp, Screech        | Deal reduced damage to all enemies         |
| **Buff**          | Apex Roar, Herd Rally, Camouflage | Increase ally stat(s) for N turns          |
| **Debuff**        | Intimidate, Venom Bite, Mudslide  | Decrease enemy stat(s) for N turns         |
| **Heal**          | Graze, Symbiosis, Regenerate      | Restore HP to self or ally                 |
| **Shield**        | Shell Guard, Armored Stance       | Absorb next N damage before HP             |
| **Lifesteal**     | Feeding Frenzy, Blood Fang        | Deal damage and heal for % of damage dealt |
| **Stun**          | Headbutt, Thunderclap             | Skip target's next turn                    |
| **Retaliate**     | Spike Defense, Countercharge      | Deal damage back when hit                  |
| **Summon/Pack**   | Call the Pack, Swarm              | Summon a temporary weak ally               |

### Passive Abilities

Each creature also gets **1 passive** that's always active:

| Passive               | Effect                                                    | Fits                       |
| --------------------- | --------------------------------------------------------- | -------------------------- |
| **Thick Hide**        | -15% incoming damage                                      | Tanks, armored creatures   |
| **Predator Instinct** | +20% ATK vs targets below 50% HP                          | Carnivores                 |
| **Herd Mentality**    | +10% all stats per ally of same type                      | Herbivore herd animals     |
| **Aquatic**           | +25% SPD, but -15% DEF                                    | Marine creatures           |
| **Venomous**          | Basic attacks apply poison (3% HP/turn for 3 turns)       | Small reptiles, amphibians |
| **Evasive**           | 15% chance to dodge attacks entirely                      | Small, fast creatures      |
| **Apex Predator**     | Cannot be stunned, +10% ATK                               | Legendary carnivores       |
| **Ancient**           | +10% all stats in rounds after turn 5 (late-game scaling) | Paleozoic creatures        |

### How Many Unique Abilities?

We don't need 600 unique abilities — that would be unbalanceable. Instead:

- **~30-40 ability templates** shared across creatures (Claw Strike, Horn Charge, Tail Sweep, etc.)
- **~15-20 passive templates** assigned by role/type
- Each creature gets a **specific combination** of 2 actives + 1 passive from the available pool
- The combination is what makes each creature feel unique, not every ability being bespoke
- **A few "signature abilities"** (maybe 10-15) reserved for legendary/epic creatures that are truly unique

This is how most gacha games work — ability _pools_ per class, with special characters getting unique twists.

---

## Stat & Ability Generation at Scale

The core question: how do we assign stats and abilities to 615 creatures without hand-crafting each one?

### Option 1: Pure Rules Engine (Deterministic)

Write a script that assigns everything based on metadata:

```python
def assign_role(creature):
    TYPE_TO_ROLE = {
        'large theropod': 'striker',
        'small theropod': 'scout',
        'sauropod': 'tank',
        'armoured dinosaur': 'tank',
        'ceratopsian': 'bruiser',
        'euornithopod': 'support',
        'Pterosauria': 'scout',
        'Ichthyosauria': 'specialist',
        'Plesiosauria': 'specialist',
        'Eurypterida': 'striker',
        # ... etc for all 48 types
    }
    if creature.type in TYPE_TO_ROLE:
        return TYPE_TO_ROLE[creature.type]
    # Fallback: infer from diet
    if creature.diet == 'Carnivorous':
        return 'striker'
    if creature.diet == 'Herbivorous':
        return 'tank'
    return 'bruiser'  # default

def assign_abilities(creature, role):
    ROLE_ABILITY_POOLS = {
        'striker': {
            'actives': ['Claw Strike', 'Bite', 'Pounce', 'Feeding Frenzy'],
            'passives': ['Predator Instinct', 'Bloodlust']
        },
        'tank': {
            'actives': ['Horn Charge', 'Tail Sweep', 'Armored Stance', 'Stomp'],
            'passives': ['Thick Hide', 'Herd Mentality']
        },
        # ...
    }
    pool = ROLE_ABILITY_POOLS[role]
    # Deterministic selection based on creature name hash
    seed = hash(creature.id)
    active1 = pool['actives'][seed % len(pool['actives'])]
    active2 = pool['actives'][(seed >> 8) % len(pool['actives'])]
    passive = pool['passives'][(seed >> 16) % len(pool['passives'])]
    return [active1, active2, passive]
```

**Pros:**

- Reproducible. Same creature always gets same stats.
- Fast to run. No API calls.
- Easy to audit and adjust — change the mapping table, re-run.
- No hallucination risk.

**Cons:**

- Creatures within the same type/diet feel samey. 60 small theropods all get Scout role with similar ability picks.
- No creature-specific flavor. Velociraptor and Compsognathus get the same treatment despite being very different animals.
- The 84 untyped creatures get generic fallbacks.

### Option 2: LLM Batch Assignment

Run each creature through an LLM with a structured prompt:

```
Given this prehistoric creature, assign battle stats and abilities.

Creature: Velociraptor
Type: small theropod
Diet: Carnivorous
Era: Cretaceous
Size: 2m
Description: "A small, agile predatory dinosaur known for its speed and intelligence..."

Available roles: striker, tank, scout, support, bruiser, specialist
Available ability templates: [list of ~40 abilities with descriptions]
Available passives: [list of ~20 passives with descriptions]

Assign:
1. Role (pick one)
2. Two active abilities from the template list (pick the most thematically fitting)
3. One passive from the passive list
4. A unique ability name variant (e.g., "Claw Strike" → "Sickle Claw Slash" for Velociraptor)

Respond in JSON format.
```

**Pros:**

- Creature-specific flavor. The LLM knows Velociraptor was fast and hunted in packs — it'll pick Scout role, give it "Pack Hunt" and something speed-related.
- Handles unknowns gracefully. Even without type/diet, the LLM can use the creature's name, description, and real-world knowledge to make reasonable assignments.
- The 84 untyped creatures get thoughtful assignments instead of generic fallbacks.
- Ability name variants add flavor cheaply ("Tail Whip" → "Thagomizer Strike" for Stegosaurus).

**Cons:**

- Non-deterministic without careful prompting and temperature=0.
- Risk of inconsistency across the batch (creature A gets abilities that are strictly better than creature B's for no good reason).
- Need to validate output against the actual ability template list (LLM might invent abilities not in the pool).
- API cost (~615 calls, but cheap with Haiku).
- Need a validation/review pass after generation.

### Option 3: Hybrid (Recommended)

**Rules engine for stats + structure, LLM for flavor + ability selection.**

1. **Rules engine assigns role** based on type/diet (deterministic, auditable)
2. **Rules engine calculates base stats** from role + rarity (deterministic)
3. **LLM picks abilities** from the template pool, choosing the most thematically appropriate 2 actives + 1 passive for each creature
4. **LLM generates ability name variants** ("Bite" → "Sickle Claw Slash" for Velociraptor, "Constricting Bite" for a snake)
5. **Rules engine validates** that LLM output matches the template pool and stat ranges
6. **Human review** of legendary/epic creatures (only ~55 creatures) for quality

```
Pipeline:
  creature data → rules engine (role, stats) → LLM (ability picks + flavor) → validator → output JSON
```

This gives you the best of both worlds — deterministic, balanced stats with flavorful, creature-appropriate abilities. The LLM is constrained to picking from pre-defined pools, so it can't create balance problems, but it can make better picks than a hash function.

**For the 84 untyped creatures:** The LLM step also assigns a role, but the rules engine gets final say on stat calculations.

### Generation Pipeline

```bash
# One-time generation, output stored in DB/JSON
python generate_battle_data.py

# Steps:
# 1. Load creatures_enriched.json
# 2. Assign roles via rules engine
# 3. Calculate base stats
# 4. Batch LLM calls for ability assignment (with structured output)
# 5. Validate all assignments
# 6. Output creatures_battle.json
# 7. Human review of epic/legendary
# 8. Seed to D1
```

The output is a static JSON file that gets seeded into the database. No LLM calls at runtime. Regenerate when adding new creatures.

---

## Creature Progression

### The Question: Should Creatures Have XP?

In Pokemon, your creatures level up through battle. In AFK Arena, heroes level up via resource investment. Should our creatures gain XP and level up?

### Option A: No Creature XP (Collection Power Only)

Creature power comes entirely from:

- Base stats (rarity + role)
- Ascension tier (future multiplier)
- Team synergies

**Pros:** Simpler. Collection-focused — your strategy is building the right roster, not grinding levels. New pulls are immediately useful at their full power. Less database state.
**Cons:** Less progression feel. A creature you've used in 100 battles is identical to one you just pulled. No attachment.

### Option B: Creature XP + Levels (Pokemon-Lite)

Creatures gain XP from battles and level up. Levels increase stats by a percentage.

```
Level 1:  base stats (100%)
Level 10: base stats * 1.15 (+15%)
Level 20: base stats * 1.30 (+30%)
Level 30: base stats * 1.50 (+50%)  // max level
```

XP sources:

- Winning a battle: 50 XP per participating creature
- Losing a battle: 20 XP per participating creature
- Expedition completion: variable XP
- "Training" (spending Fossils to give XP): 10 Fossils = 100 XP

**Pros:**

- Strong progression hook. "My Velociraptor is level 27" creates attachment.
- Incentivizes using diverse creatures (level multiple creatures, not just the same 3).
- Creates another resource sink (Fossils for training).
- Leveling could unlock ability upgrades at milestones (e.g., level 10: ability cooldown -1, level 20: ability damage +20%, level 30: unlock a third active ability).

**Cons:**

- Advantage snowball. Players who battle more have higher-level creatures, making them harder to beat. New players face a steeper hill.
- More database state (XP per user_creature).
- Balance complexity — level 30 legendary vs level 1 common is an even wider gap.

### Option C: Player Level Unlocks, Not Creature Levels

Players already have XP and levels (from the gateway listener). Tie battle power to **player level** instead of creature level:

- Player level gates which battle tiers they can enter
- Player level could unlock ability slots (start with 1 active, unlock 2nd active at level 10, passive at level 20)
- Individual creatures don't level — their stats are fixed by rarity/role

**Pros:** Avoids per-creature grind. Player level already exists and comes from normal Discord activity.
**Cons:** Less creature-specific attachment. Doesn't give a reason to keep using the same creatures.

### Recommendation: Option B (Creature XP) with Guard Rails

Creature leveling adds a ton of engagement, and the snowball problem can be mitigated:

1. **Level-based matchmaking brackets** — level 1-10 creatures face level 1-10, etc.
2. **Level cap scales with rarity** — commons cap at 30, legendaries cap at 20. This compresses the gap. A maxed common has +50% stats, a maxed legendary has +30% stats — the legendary is still stronger overall but the gap narrows. This also makes commons not feel like trash.
3. **"Underdog bonus"** — creatures fighting above their level get +5% ATK per level difference (capped).
4. **XP sharing** — all creatures on the team get XP, not just the ones who landed the killing blow.

---

## Team Composition & Synergies

### Team Size: 3 vs 5

|                              | 3-Creature Teams                                       | 5-Creature Teams                                              |
| ---------------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| **Discord UX**               | Fits in one embed. Easy to pick with a select menu.    | Harder to pick, needs multiple select menus. Embed gets long. |
| **Strategic Depth**          | Limited but sufficient. Roles matter — you want a mix. | More room for synergies and counter-play.                     |
| **Collection Pressure**      | Need a few good creatures to compete.                  | Need a deeper roster — more pulling incentive.                |
| **Battle Log Length**        | Short, readable.                                       | Can get very long.                                            |
| **New Player Accessibility** | Easy to field a team quickly.                          | Might not have 5 good creatures early on.                     |

**Recommendation: Start with 3, expand to 5 later.** Three is snappy for Discord, easier to balance, and accessible. Can always add a "Grand Arena" mode with 5-creature teams as endgame content.

### Formation / Positioning

AFK Arena has a 2-row formation (front/back). For simplicity:

**Option: Front / Back Row**

- **Front row** (1-2 creatures): Takes hits first. Tanks and bruisers go here.
- **Back row** (1-2 creatures): Protected until front row is KO'd. Scouts, strikers, specialists go here.
- Single-target attacks hit front row first. AoE hits everyone.

This adds meaningful positioning strategy without complex spatial mechanics. In Discord, it's just:

```
Your team:
  Front: Triceratops, Ankylosaurus
  Back:  Velociraptor
```

### Synergy System

Synergies reward thoughtful team building over just picking your 3 highest-rarity creatures.

#### Type Synergies (Same-Type Bonus)

If 2+ creatures share a type, they get a bonus:

| Same Type Count | Bonus                    |
| --------------- | ------------------------ |
| 2 of same type  | +10% HP to both          |
| 3 of same type  | +15% HP, +10% ATK to all |

This replaces the "pack bonus" from the old design (which required literal duplicate creatures). Now you can run 2 different ceratopsians for a bonus, which is more interesting than running 2 copies of the same creature.

#### Era Synergies (Same-Era Bonus)

| Same Era Count | Bonus          |
| -------------- | -------------- |
| 2 of same era  | +5% all stats  |
| 3 of same era  | +10% all stats |

Thematic — a full Cretaceous team fought together in the same world. Since Cretaceous has 300 creatures, this isn't hard to achieve, but mixing eras for better role coverage is a valid tradeoff.

#### Diet Synergies

| Combo                                      | Bonus                         |
| ------------------------------------------ | ----------------------------- |
| All Carnivore                              | +15% ATK (aggressive)         |
| All Herbivore                              | +20% DEF (defensive)          |
| Mixed (at least 1 carnivore + 1 herbivore) | +10% SPD (balanced ecosystem) |

#### Anti-Synergy / Counter System

Certain type matchups could have advantages/disadvantages:

| Attacker         | Defender          | Effect                                 |
| ---------------- | ----------------- | -------------------------------------- |
| Carnivore        | Herbivore         | +15% damage                            |
| Marine creature  | Land creature     | -10% damage                            |
| Flying creature  | Grounded creature | +10% evasion                           |
| Armored creature | Non-armored       | -10% incoming damage (stacks with DEF) |

This gives players something to think about when they see their opponent's team composition (if we reveal team composition before battle, or in a draft mode).

---

## Matchmaking & Competitive Structure

### Arena Tiers

```
Bronze   (0-999 rating)    — New players start here
Silver   (1000-1499)       — Getting competitive
Gold     (1500-1999)       — Solid collection and strategy
Diamond  (2000-2499)       — Top players
Apex     (2500+)           — Best of the best
```

### Battle Modes

| Mode                 | Description                                                                                      | Rewards                                           | Rating Impact          |
| -------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ---------------------- |
| **Quick Battle**     | Old-style instant resolve. No abilities. Just power comparison with randomness.                  | Small Fossil payout                               | None                   |
| **Arena Battle**     | Full simulated auto-battle. Abilities, turn order, the works.                                    | Fossil pot + creature XP + rating                 | Yes                    |
| **Ranked Season**    | Monthly seasons with rank rewards. Uses Arena Battle rules. Resets rating partially each season. | Season-end rewards (Fossils, exclusive cosmetics) | Separate ranked rating |
| **Expedition** (PvE) | Send a team on a timed mission against procedural encounters. Idle rewards.                      | Fossils, XP, rare items                           | None                   |

### Discord Commands

```
/battle @user [stake]     — Challenge a player to Arena Battle
/quickbattle @user [stake] — Quick Battle (instant resolve, no abilities)
/accept                   — Accept incoming challenge
/decline                  — Decline incoming challenge
/battles                  — View active challenges and recent history
/team                     — View/set your default battle team
/expedition [duration]    — Send a team on an expedition
/rating [@user]           — View battle rating
```

---

## Battle Simulation Engine

### Turn Flow (for full Arena Battle)

```
1. SETUP
   - Both teams placed in formation (front/back)
   - Apply synergy bonuses
   - Apply level bonuses
   - Calculate effective stats

2. TURN LOOP (max 30 turns to prevent infinite games)
   - Sort all living creatures by SPD (descending), randomize ties
   - Each creature acts in order:
     a. Check if any active abilities are off cooldown
        - If yes: use highest-priority available ability (AI logic)
        - If no: use basic attack (ATK-scaled single target)
     b. Resolve damage: damage = attacker.ATK * abilityMultiplier - defender.DEF * 0.5
        (DEF reduces but never fully negates — minimum damage is 10% of raw damage)
     c. Apply status effects (poison tick, buffs expire, etc.)
     d. Check for KOs — remove KO'd creatures from turn order
   - Check win condition: one team has no creatures remaining

3. TIMEOUT
   - If 30 turns pass, team with more remaining HP% wins
   - If tied, attacker (challenger) loses (defender's advantage for stalling concern)

4. RESULT
   - Generate battle log with all turns
   - Calculate XP gains
   - Update ratings
   - Distribute Fossil pot
```

### Ability AI (How creatures choose abilities)

Since this is auto-battle, creatures need logic for when to use which ability. Simple priority system:

1. If a heal ability is available and self HP < 30%: use heal
2. If a buff ability is available and no active buffs: use buff
3. If an AoE ability is available and 2+ enemies alive: use AoE
4. If a debuff ability is available and strongest enemy has no debuffs: use debuff
5. Otherwise: use strongest single-target attack
6. If all abilities on cooldown: basic attack

This is deterministic given the game state, so battles are reproducible from the same starting conditions (no RNG in ability selection, only in damage variance).

### Damage Formula

```
rawDamage = attackerATK * abilityMultiplier * (1 + critBonus)
mitigated  = rawDamage * (100 / (100 + defenderDEF))
variance   = mitigated * random(0.9, 1.1)
finalDamage = max(variance, rawDamage * 0.1)  // minimum 10% of raw

// Diet advantage
if (dietAdvantage(attacker, defender)):
    finalDamage *= 1.15

// Crit: 10% base chance, +ATK/SPD can increase
// Crit damage: 1.5x
```

Using the `ATK * (100 / (100 + DEF))` formula ensures DEF is always useful but never makes a creature unkillable. At DEF=100, damage is halved. At DEF=200, damage is 1/3. Diminishing returns feel natural.

---

## Battle Log & Presentation

### Discord Embed Example

```
⚔️ ARENA BATTLE: @Alice vs @Bob
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🦕 Alice's Team                    🦖 Bob's Team
  Front: Triceratops Lv.15          Front: T-Rex Lv.18
  Front: Ankylosaurus Lv.12         Front: Spinosaurus Lv.14
  Back:  Velociraptor Lv.20         Back:  Pteranodon Lv.16

Synergies: Cretaceous +10%         Synergies: Carnivore +15% ATK

━━━ Turn 1 ━━━
Velociraptor uses Sickle Claw Slash → T-Rex (142 dmg)
T-Rex uses Devastating Bite → Triceratops (198 dmg)
Pteranodon uses Dive Attack → Ankylosaurus (87 dmg)
Triceratops uses Horn Charge → T-Rex (156 dmg)
Ankylosaurus uses Armored Stance → DEF +30% (3 turns)
Spinosaurus uses Aquatic Lunge → Velociraptor (167 dmg)

━━━ Turn 2 ━━━
Velociraptor uses Pack Tactics → ATK +20% to all allies
...

━━━ RESULT ━━━
🏆 Alice wins! (3 creatures remaining vs 0)
Rating: Alice 1245 (+18) | Bob 1312 (-18)
Fossils: Alice +10
XP: Triceratops +50, Ankylosaurus +50, Velociraptor +50
```

For Discord, we'd show a condensed version (key moments only) with a "View full battle" link to the web app. The full turn-by-turn log lives on the web app's `/battle/:id` page.

---

## Open Questions

These are design decisions that need input before implementation:

1. **Ability unlock progression**: Do creatures start with all abilities, or unlock them at certain levels? (Levels 1/10/20 could unlock abilities 1/2/3)

2. **Should teams be visible before accepting a challenge?** If yes, the defender can counter-pick (more strategic but favors defender). If no, it's blind picks for both (more fair but less strategic). Middle ground: show team composition (roles/types) but not specific creatures.

3. **Duplicate creatures in battle**: Allow multiple copies of the same creature on a team? The old design had a "pack bonus" for this. With type synergies replacing pack bonus, we could simply disallow duplicates (forces roster diversity).

4. **Seasonal resets**: How much rating resets between seasons? Full reset to 1000 creates a miserable first week. Soft reset (compress toward 1200) is smoother.

5. **Ability balance patches**: How often do we adjust ability numbers? Monthly? Per-season? Should we have a way to hot-fix without a redeploy?

6. **Expedition scope**: Full PvE expedition system or just focus on PvP for v1?

7. **Team presets**: Let players save multiple team compositions and switch between them? Useful for counter-picking.

8. **Spectator mode**: Can other Discord users watch a battle? (Just viewing the result embed, or a real-time narration for live battles?)

---

## Implementation Phases

### Phase 1: Foundation

- Define ability templates (~30-40 actives, ~15-20 passives)
- Build stat generation pipeline (rules engine + LLM for abilities)
- Generate battle data for all 615 creatures
- Add battle stats schema to DB (`creature_battle_stats`, `creature_abilities`)
- Build the battle simulation engine (pure function: teams in → result out)

### Phase 2: Arena Battles

- Challenge lifecycle (create, accept, decline, expire)
- Battle resolution + replay storage
- Discord commands (`/battle`, `/accept`, `/decline`, `/battles`)
- Web UI for battle page
- ELO rating system

### Phase 3: Creature Leveling

- XP system + level-up logic
- Level-based stat scaling
- Ability unlock progression at level milestones
- Training system (spend Fossils for XP)

### Phase 4: Polish & Expansion

- Ranked seasons with rewards
- Expedition system (PvE)
- 5-creature Grand Arena mode
- Spectator embeds
- Battle statistics and analytics
