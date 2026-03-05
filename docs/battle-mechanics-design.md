# Battle Mechanics Design

Official game design for PaleoWaifu's battle system. See `battle-mechanics-design-ideas.md` for explored alternatives and rationale. See `battle-implementation-plan.md` for technical details (schema, pipeline, build phases).

---

## Overview

Async auto-battle system inspired by AFK Arena. Players assemble a team of 3 creatures, position them in a front/back formation, and challenge other players. Battles simulate turn-by-turn combat server-side and produce a narrative log. No real-time interaction during combat — strategy lives in team building, formation, and synergies.

No creature XP or leveling at launch. Power comes from rarity, role, abilities, ascension (future), and team synergies.

No Fossil stakes at launch. Battles are free to play — no risk, no barrier. This encourages everyone to battle early and often while the player base is growing.

---

## Stats

### Core Stats (4)

| Stat | Abbrev | Purpose |
|------|--------|---------|
| **Health** | HP | Total health pool. KO'd at 0. |
| **Attack** | ATK | Damage dealt by basic attacks and offensive abilities. |
| **Defense** | DEF | Reduces incoming damage. Never fully negates. |
| **Speed** | SPD | Determines turn order via weighted initiative: `SPD * random(0.5, 1.5)`. |

No Ability Power (ABL) stat. Utility effects (heals, shields, buffs) use fixed percentages defined by the ability itself. ATK is the sole offensive scaling stat. This keeps stat budgets clean and role identity sharp.

### Roles (4 Archetypes)

Each creature gets one role based on its creature type. Role determines stat distribution and which abilities it can be assigned.

| Role | Identity | Position | Typical Types |
|------|----------|----------|---------------|
| **Striker** | High ATK, moderate SPD, low DEF | Back | Large theropods, small theropods, Eurypterida, Pterosauria |
| **Tank** | High HP/DEF, low ATK/SPD | Front | Sauropods, armoured dinosaurs, Proboscidea, Asterolepidiformes |
| **Support** | High HP, moderate DEF/SPD, low ATK | Back | Euornithopods, Primates, Sirenia, Trinucleida |
| **Bruiser** | Balanced across all stats | Front | Ceratopsians, Crocodylia, Saurischia, Mammalia |

**Migration from 6 roles:**
- Old Striker → **Striker**
- Old Scout → **Striker** (fast subtype — high SPD strikers)
- Old Tank → **Tank**
- Old Support → **Support**
- Old Bruiser → **Bruiser**
- Old Specialist → **Support** (utility/control) or **Striker** (damage) based on creature identity

**Fallback assignment** (for creatures with null/unknown type):
- Carnivorous diet → Striker
- Herbivorous diet → Tank
- Piscivorous diet → Support
- Omnivorous diet → Bruiser
- Unknown everything → Bruiser

### Stat Scaling

Stats are calculated from `rarity base total × role distribution × individual variance`.

**Rarity base stat totals:**

| Rarity | Base Stat Total |
|--------|----------------|
| Common | 105 |
| Uncommon | 130 |
| Rare | 170 |
| Epic | 215 |
| Legendary | 280 |

**Role stat distributions** (% of base total allocated to each stat, sums to 1.0):

| Role | HP | ATK | DEF | SPD |
|------|-----|-----|-----|-----|
| Striker | 28% | 35% | 15% | 22% |
| Tank | 38% | 12% | 35% | 15% |
| Support | 38% | 10% | 27% | 25% |
| Bruiser | 30% | 25% | 25% | 20% |

With only 4 stats sharing the budget, roles are far more differentiated. A Striker's ATK (35%) is nearly 3x a Tank's (12%). A Tank's DEF (35%) is over 2x a Striker's (15%). Each role has a clear statistical identity.

**Individual variance:** A deterministic hash of the creature's ID produces a per-stat modifier between 0.90 and 1.10. Same creature always gets the same stats. Two common Strikers feel slightly different without manual tuning.

Physical size/weight data is displayed as flavor in creature cards and battle narration but does NOT influence stats.

---

## Ability System — Effect / Trigger / Target (ETT)

Abilities are composed from three primitives:

- **Effect** — what it does (deal damage, heal, apply a DoT, grant a shield)
- **Trigger** — when it fires (on use, on hit, on kill, at turn end, at battle start)
- **Target** — who it affects (self, single enemy, all allies, lowest HP ally)

Active abilities and passive abilities are the same data structure. An ability with an `onUse` trigger is an active (the creature chooses to use it). Any other trigger is a passive (the engine fires it automatically). The engine processes all abilities through the same resolution pipeline.

Each creature has **1 active ability + 1 passive ability**.

### Effects

Effects are the atomic units of what an ability does. An ability can have multiple effects (e.g., "deal damage AND apply poison").

| Effect | Parameters | Description |
|--------|-----------|-------------|
| **damage** | `multiplier`, `scaling: atk \| def` | Deal `stat × multiplier` damage, mitigated by DEF |
| **heal** | `percent` | Heal `percent`% of target's max HP |
| **dot** | `dotKind: poison \| bleed`, `percent`, `duration` | Apply `percent`% max HP damage per turn for `duration` turns. Ignores DEF. Stacks from multiple sources. |
| **buff** | `stat: atk \| def \| spd`, `percent`, `duration` | Increase `stat` by `percent`% for `duration` turns. Same-stat buff replaces previous. |
| **debuff** | `stat: atk \| def \| spd`, `percent`, `duration` | Decrease `stat` by `percent`% for `duration` turns. Same-stat debuff replaces previous. |
| **shield** | `percent`, `duration` | Grant a shield absorbing `percent`% of caster's max HP for `duration` turns. Latest shield replaces previous. |
| **stun** | `duration` | Target skips next `duration` turns. Blocked by stun immunity. |
| **taunt** | `duration` | Forces all single-target enemy attacks to target this creature. Latest taunt replaces previous team taunts. |
| **lifesteal** | `percent` | Heal caster for `percent`% of damage dealt. Only valid alongside a `damage` effect. |
| **reflect** | `percent`, `duration` | Reflect `percent`% of damage taken back to attacker for `duration` turns. |
| **damage_reduction** | `percent` | Permanently reduce all incoming damage by `percent`%. |

### Triggers

Triggers define when the engine fires an ability's effects.

| Trigger | Parameters | Description |
|---------|-----------|-------------|
| **onUse** | `cooldown` | Active ability. Creature chooses to use it on their turn. Goes on cooldown after use. |
| **onBasicAttack** | — | Fires whenever this creature performs a basic attack. |
| **onHit** | — | Fires whenever this creature takes damage. |
| **onKill** | — | Fires when this creature KOs an enemy. |
| **onEnemyKO** | — | Fires when any enemy is KO'd (regardless of who killed them). |
| **onAllyKO** | — | Fires when an ally is KO'd. |
| **onTurnStart** | — | Fires at the start of this creature's turn. |
| **onTurnEnd** | — | Fires at the end of this creature's turn. |
| **onBattleStart** | `condition?` | Fires once at battle setup. Optional condition gates activation. |
| **always** | — | Permanent modifier, applied at battle start and recalculated dynamically. |

### Targets

Targets define who receives the effects.

| Target | Description |
|--------|-------------|
| **self** | The creature that owns this ability. |
| **single_enemy** | One enemy, prioritizing front row. Respects taunt. |
| **all_enemies** | All living enemies. |
| **lowest_hp_ally** | The ally with the lowest HP%. |
| **all_allies** | All living allies (including self). |
| **random_enemy** | One randomly selected living enemy. |
| **attack_target** | The enemy being attacked (for onBasicAttack triggers). |
| **attacker** | The creature that just dealt damage (for onHit triggers). |

### Conditions

Optional gates on triggers. If the condition is false, the ability does not fire.

| Condition | Parameters | Description |
|-----------|-----------|-------------|
| **in_row** | `row: front \| back` | Only activates if creature is in the specified row. |
| **target_hp_below** | `percent` | Only activates if the target's HP is below `percent`%. |
| **per_ally_alive** | — | Effect stacks once per living ally (excluding self). |
| **per_dead_ally** | — | Effect stacks once per KO'd ally. |

### Active Ability Pool (15)

Each creature gets exactly 1 active ability from this pool, plus a creature-specific flavor name (e.g., "Bite" → "Sickle Claw Slash" for Velociraptor).

**Damage — 5 abilities:**

| Name | Trigger | Effects | Target | Role Affinity |
|------|---------|---------|--------|---------------|
| **Bite** | onUse(cd:0) | damage(1.0x ATK) | single_enemy | Striker, Bruiser |
| **Crushing Jaw** | onUse(cd:3) | damage(1.3x ATK) | single_enemy | Striker |
| **Venom Strike** | onUse(cd:2) | damage(0.7x ATK), dot(poison 5%/turn 3t) | single_enemy | Striker |
| **Feeding Frenzy** | onUse(cd:3) | damage(1.0x ATK), lifesteal(25%) | single_enemy | Striker, Bruiser |
| **Headbutt** | onUse(cd:3) | damage(0.8x ATK), stun(1t) | single_enemy | Bruiser, Tank |

**AoE Damage — 2 abilities:**

| Name | Trigger | Effects | Target | Role Affinity |
|------|---------|---------|--------|---------------|
| **Tail Sweep** | onUse(cd:2) | damage(0.6x ATK) | all_enemies | Bruiser, Tank |
| **Bleed** | onUse(cd:2) | damage(0.5x ATK), dot(bleed 5%/turn 3t) | single_enemy | Striker |

**Buff — 2 abilities:**

| Name | Trigger | Effects | Target | Role Affinity |
|------|---------|---------|--------|---------------|
| **Rally Cry** | onUse(cd:2) | buff(ATK +20% 3t) | all_allies | Support |
| **Herd Formation** | onUse(cd:2) | buff(DEF +30% 3t) | all_allies | Support, Tank |

**Debuff — 2 abilities:**

| Name | Trigger | Effects | Target | Role Affinity |
|------|---------|---------|--------|---------------|
| **Intimidate** | onUse(cd:2) | debuff(ATK -25% 3t) | single_enemy | Support |
| **Armor Break** | onUse(cd:2) | debuff(DEF -25% 3t) | single_enemy | Support, Bruiser |

**Heal — 2 abilities:**

| Name | Trigger | Effects | Target | Role Affinity |
|------|---------|---------|--------|---------------|
| **Symbiosis** | onUse(cd:2) | heal(15%) | all_allies | Support |
| **Mend** | onUse(cd:1) | heal(25%) | lowest_hp_ally | Support |

**Utility — 2 abilities:**

| Name | Trigger | Effects | Target | Role Affinity |
|------|---------|---------|--------|---------------|
| **Shield Wall** | onUse(cd:2) | shield(25% 2t) | lowest_hp_ally | Tank |
| **Taunt** | onUse(cd:1) | taunt(2t) | self | Tank |

### Passive Ability Pool (10)

Each creature gets exactly 1 passive ability.

**Defensive:**

| Name | Trigger | Effects | Target | Condition | Role Affinity |
|------|---------|---------|--------|-----------|---------------|
| **Thick Hide** | always | damage_reduction(15%) | self | — | Tank |
| **Armored Plates** | always | crit_reduction(50%) | self | — | Tank |
| **Ironclad** | always | flat_reduction(10% of DEF) | self | — | Tank, Bruiser |
| **Evasive** | always | dodge(base 10%, scales with SPD ratio, capped 3-40%) | self | — | Striker |

**Offensive:**

| Name | Trigger | Effects | Target | Condition | Role Affinity |
|------|---------|---------|--------|-----------|---------------|
| **Predator Instinct** | onBasicAttack | buff(ATK +20% 1t) | self | target_hp_below(50%) | Striker |
| **Venomous** | onBasicAttack | dot(poison 3%/turn 2t) | attack_target | — | Striker |
| **Territorial** | onBattleStart | buff(ATK +10%), buff(DEF +10%) | self | in_row(front) | Tank, Bruiser |
| **Pack Hunter** | always | buff(ATK +10%) | self | per_ally_alive | Striker |

**Sustain:**

| Name | Trigger | Effects | Target | Condition | Role Affinity |
|------|---------|---------|--------|-----------|---------------|
| **Regenerative** | onTurnEnd | heal(3%) | self | — | Tank, Support |
| **Scavenger** | onEnemyKO | heal(15%) | self | — | Bruiser |

### Basic Attack

Always available, no cooldown. Used when the active ability is on cooldown.

| Name | Effects | Target |
|------|---------|--------|
| **Basic Attack** | damage(0.9x ATK) | single_enemy |

### Ability Assignment Strategy

Hand-crafted for Wave 1 (40 creatures). Each creature gets:

1. **1 active ability** from the pool, chosen for thematic fit
2. **1 passive ability** from the pool, chosen for thematic fit
3. **Flavor names** — creature-specific rename of the template (e.g., "Crushing Jaw" → "Tyrant's Bite" for T-Rex)

With only 40 creatures at launch, every assignment is hand-reviewed. No LLM bulk assignment needed. Future waves can use LLM-assisted assignment constrained to the template pool.

---

## Formation

Teams of 3, placed in front row or back row.

- **Front row** (1-2 creatures): Takes hits first. Single-target attacks must target front row while front row creatures are alive.
- **Back row** (1-2 creatures): Protected until front row is KO'd.
- AoE abilities hit all living creatures regardless of row.
- Tanks and Bruisers belong in front. Strikers and Supports belong in back.
- Misplacing roles is a valid (bad) strategy — a Support in front row will die fast.

---

## Synergies

Synergies reward thoughtful team building over just picking your 3 highest-rarity creatures.

### Type Synergy (same creature type)

| Count | Bonus |
|-------|-------|
| 2 of same type | +5% HP to those creatures |
| 3 of same type | +7% HP, +3% ATK to all |

### Era Synergy (same geological era)

| Count | Bonus |
|-------|-------|
| 2 of same era | +3% HP, ATK, DEF, SPD to those creatures |
| 3 of same era | +3% HP, ATK, DEF, SPD to all |

### Diet Synergy

| Composition | Bonus |
|-------------|-------|
| All Carnivore | +10% ATK, +7% SPD |
| All Herbivore | +10% DEF, +10% HP |
| Mixed (1+ carnivore + 1+ herbivore) | +12% SPD, +7% ATK |

### Diet Matchup (attack modifier)

Full food-chain advantage cycle:

| Attacker → Defender | Damage Modifier |
|--------------------|-----------------|
| Carnivore → Herbivore | +15% |
| Herbivore → Omnivore | +15% |
| Omnivore → Carnivore | +15% |
| Piscivore → Carnivore | +15% |
| Reverse of above | -15% |
| All other combinations | neutral |

### Diet Categories

Carnivorous, Herbivorous, Piscivorous, Omnivorous, Herbivorous/omnivorous (treated as Herbivorous for synergy purposes).

---

## Battle Simulation

### Turn Flow

1. **Setup:** Place teams in formation, apply synergy bonuses, fire all `onBattleStart` triggers, all creatures start at full HP.
2. **Turn loop** (max 30 turns):
   - Calculate initiative for each living creature: `SPD × random(0.5, 1.5)` (weighted initiative with randomness)
   - Sort by initiative descending
   - Each creature acts in initiative order:
     1. Fire `onTurnStart` triggers
     2. If stunned → skip action, fire `onTurnEnd` triggers, continue
     3. Choose action: use active ability (if off cooldown) or basic attack
     4. Resolve action → for each effect in the ability, call `resolveEffect()`
     5. After damage dealt → fire `onHit` triggers on defender, `onBasicAttack` triggers if basic attack
     6. After KO → fire `onKill` on attacker, `onEnemyKO`/`onAllyKO` on relevant creatures
     7. Fire `onTurnEnd` triggers
   - Win check: if one team has 0 creatures alive, other team wins
3. **Timeout** (turn 30): Team with higher total remaining HP% wins. If tied, defender wins (anti-stall).

### Trigger Resolution Order

When multiple triggers fire simultaneously (e.g., two creatures both have `onEnemyKO`), resolve in initiative order (same order as the turn). This keeps behavior deterministic.

### Ability Selection AI

With 1 active ability, the AI is a simple decision:

1. Is the active ability off cooldown?
   - **Yes** → Score it against a basic attack using role weights and game state
   - **No** → Basic attack
2. Select the best target for the chosen ability

**Scoring factors:**
- **Role weights**: Tanks prefer utility (taunt, shield) over damage. Strikers prefer damage over utility.
- **Game state**: Low HP → prefer heals/shields. Winning → prefer aggression. Late game → prefer urgency.
- **Target selection**: Finish low-HP enemies. Debuff the strongest threat. Heal the weakest ally.
- **Waste prevention**: Don't use a 3-turn cooldown ability to kill a target a basic attack could finish.

The AI is deterministic — given the same game state and RNG seed, the same choice is always made.

### Damage Formula

```
Raw damage = ATK × ability.multiplier

Crit check: 10% chance
  - Crit multiplier: 1.5x (reduced to 1.25x by Armored Plates passive)

DEF mitigation:
  raw = raw × (100 / (100 + defender.DEF))

Variance: ×= random(0.9, 1.1)

Diet modifier: ×= 1.15 (advantage) or 0.85 (disadvantage)

Global damage scaling: ×= COMBAT_DAMAGE_SCALE (tuning knob)

Floor to minimum 1

Passive modifiers (applied during resolution):
  - Thick Hide: ×= 0.85
  - Ironclad: -= floor(defender.DEF × 0.10) (minimum 1)
  - Evasive: dodge check (base 10% × defenderSPD/attackerSPD, capped 3-40%)
  - Predator Instinct: ATK ×= 1.2 (if target below 50% HP)
```

The formula is clean and linear: ATK → multiplier → crit → DEF mitigation → variance → diet → scale → passives. No branching on ability type, no ABL amplification paths, no special stat routing.

For DEF-scaling abilities (e.g., a future Provoke), use `scaling: 'def'` in the effect and substitute DEF for ATK in the formula. Same pipeline, different input stat.

### Status Effects

| Effect | Behavior |
|--------|----------|
| **Poison** | X% max HP damage per turn. Ignores DEF. Stacks with multiple sources. |
| **Bleed** | X% max HP damage per turn. Ignores DEF. Stacks with multiple sources. |
| **Buff** | +X% to a stat for N turns. Same-stat buff replaces previous. |
| **Debuff** | -X% to a stat for N turns. Same-stat debuff replaces previous. |
| **Stun** | Target skips their next turn. Removed after skip. |
| **Shield** | Absorbs up to X damage before HP is reduced. Latest shield replaces previous. Lasts until broken or duration expires. |
| **HoT** | Heal X% max HP at end of target's turn for N turns. Latest HoT replaces previous. |
| **Taunt** | Forces all single-target enemy attacks to target the taunting creature. Latest taunt replaces previous team taunts. |
| **Reflect** | Reflects X% of damage taken back to attacker. Ends when duration expires. |

Buffs/debuffs of the same stat don't stack — latest applied replaces the previous. Different stats can have simultaneous effects. Poison and Bleed DO stack from multiple sources.

---

## Engine Architecture

### ETT Type System

The engine uses discriminated unions for type safety. No ambiguous string parsing.

```typescript
// ─── Effects ─────────────────────────────────────────────────
type Effect =
  | { type: 'damage'; multiplier: number; scaling: 'atk' | 'def' }
  | { type: 'heal'; percent: number }
  | { type: 'dot'; dotKind: 'poison' | 'bleed'; percent: number; duration: number }
  | { type: 'buff'; stat: Stat; percent: number; duration: number }
  | { type: 'debuff'; stat: Stat; percent: number; duration: number }
  | { type: 'shield'; percent: number; duration: number }
  | { type: 'stun'; duration: number }
  | { type: 'taunt'; duration: number }
  | { type: 'lifesteal'; percent: number }
  | { type: 'reflect'; percent: number; duration: number }
  | { type: 'damage_reduction'; percent: number }

// ─── Triggers ────────────────────────────────────────────────
type Trigger =
  | { type: 'onUse'; cooldown: number }
  | { type: 'onBasicAttack' }
  | { type: 'onHit' }
  | { type: 'onKill' }
  | { type: 'onEnemyKO' }
  | { type: 'onAllyKO' }
  | { type: 'onTurnStart' }
  | { type: 'onTurnEnd' }
  | { type: 'onBattleStart'; condition?: Condition }
  | { type: 'always' }

// ─── Targets ─────────────────────────────────────────────────
type Target =
  | 'self'
  | 'single_enemy'
  | 'all_enemies'
  | 'lowest_hp_ally'
  | 'all_allies'
  | 'random_enemy'
  | 'attack_target'
  | 'attacker'

// ─── Conditions ──────────────────────────────────────────────
type Condition =
  | { type: 'in_row'; row: 'front' | 'back' }
  | { type: 'target_hp_below'; percent: number }
  | { type: 'per_ally_alive' }
  | { type: 'per_dead_ally' }
  | { type: 'debuff_immune_turns'; turns: number }

// ─── Ability (unified active + passive) ──────────────────────
interface Ability {
  id: string
  name: string
  trigger: Trigger
  effects: Effect[]
  target: Target
  condition?: Condition
  description: string
}

// ─── Battle Creature (runtime) ───────────────────────────────
interface BattleCreature {
  id: string
  creatureId: string
  name: string
  teamSide: 'A' | 'B'
  row: 'front' | 'back'
  baseStats: { hp: number; atk: number; def: number; spd: number }
  maxHp: number
  currentHp: number
  atk: number
  def: number
  spd: number
  role: Role
  diet: string
  type: string
  era: string
  rarity: string
  active: Ability          // 1 active ability
  passive: Ability         // 1 passive ability
  cooldown: number         // turns remaining on active ability cooldown
  statusEffects: StatusEffect[]
  isAlive: boolean
  isStunned: boolean
}

type Role = 'striker' | 'tank' | 'support' | 'bruiser'
type Stat = 'atk' | 'def' | 'spd'
```

### Effect Resolution

The engine has one `resolveEffect()` function that handles every effect type uniformly. No special cases per ability template.

```
resolveEffect(effect, caster, target, context):
  switch effect.type:
    'damage'   → calculate damage, apply to target, return result
    'heal'     → heal % of target maxHP, cap at maxHP
    'dot'      → push DoT status effect onto target
    'buff'     → replace same-stat buff, apply modifier
    'debuff'   → replace same-stat debuff, apply modifier
    'shield'   → replace existing shield, set value to % of caster maxHP
    'stun'     → set target stunned
    'taunt'    → clear team taunts, set taunt on caster
    'lifesteal' → heal caster for % of last damage dealt
    'reflect'  → set reflect status on target
    'damage_reduction' → store permanent reduction %
```

An ability with multiple effects (e.g., Venom Strike = `[damage, dot]`) simply calls `resolveEffect()` for each. Order matters — damage resolves first, then secondary effects. If the target is KO'd by the damage, secondary effects targeting that creature are skipped.

### Trigger Dispatch

The engine maintains a trigger registry. When a game event occurs, it fires all matching triggers:

```
onEvent('damage_dealt', { source, target, amount }):
  → check source.passive for 'onBasicAttack' trigger (if basic attack)
  → check target.passive for 'onHit' trigger

onEvent('creature_ko', { killer, victim }):
  → check killer.passive for 'onKill' trigger
  → for each enemy of victim: check 'onEnemyKO' triggers
  → for each ally of victim: check 'onAllyKO' triggers

onEvent('turn_start', { creature }):
  → check creature.passive for 'onTurnStart' trigger

onEvent('turn_end', { creature }):
  → check creature.passive for 'onTurnEnd' trigger

onEvent('battle_start', { allCreatures }):
  → for each creature: check 'onBattleStart' and 'always' triggers
```

This replaces the current hardcoded passive checks scattered throughout `engine.ts`, `abilities.ts`, and `damage.ts`.

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
- No creature locking — same creature can be on multiple active challenges (no stakes to protect)

---

## Rating System

Simple win/loss tracking with a cosmetic arena tier. Purely visual — no matchmaking restriction, no rewards, no stakes. Just a badge on your profile.

- **Starting rating:** 1000
- **Win:** +25 rating
- **Loss:** -20 rating (floor of 0 — can't go negative)

Flat point changes keep it simple and approachable. Can be upgraded to ELO later if competitive depth is needed.

### Arena Tiers (cosmetic only)

| Tier | Rating |
|------|--------|
| Bronze | 0-999 |
| Silver | 1000-1499 |
| Gold | 1500-1999 |
| Diamond | 2000-2499 |
| Apex | 2500+ |

---

## Duplicate Creatures in Battle

**No duplicate creatures allowed on the same team.** Each of the 3 slots must be a different creature species. This forces roster diversity and makes collection breadth matter.

Type synergies reward same-type but different-species teams (e.g., two different ceratopsians).

---

## User Experience

### Discord

```
/battle @user     — Challenge a player
/accept           — Accept incoming challenge (opens team picker)
/decline          — Decline incoming challenge
/battles          — View active challenges + recent history (ephemeral)
/team             — View your current default team
/rating [@user]   — View battle rating and arena tier
```

**Team picking:** `/battle @opponent` → ephemeral select menus to pick 3 creatures → assign front/back row via buttons → confirm → public challenge embed in channel.

**Battle result embed (condensed):**
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

### Web App

- `/battle` — Tabs: Challenge (search opponent, pick team), Incoming (pending challenges), History (past battles with replays)
- `/battle/:id` — Full turn-by-turn replay page with creature cards, HP bars, and narration. Shareable link.
- **Team picker:** Collection view filtered to battle-ready creatures, drag/click to fill 3 slots, assign front/back row, shows synergy bonuses in real-time.

---

## Battle-Ready Rollout

Not all 600+ creatures launch with battle data. Roll out in tight, curated waves.

### Waves

| Wave | Count | Criteria | When |
|------|-------|----------|------|
| **Wave 1** | 40 | Hand-curated: iconic creatures, complete data, even role/rarity spread | Launch |
| **Wave 2** | 40-60 | LLM-assisted ability assignment with human review | 2-4 weeks post-launch |
| **Wave 3** | 60-80 | LLM-assisted, light review | Ongoing (~monthly) |
| **Wave 4+** | Remainder | Bulk assignment as data is enriched | Ongoing |

### Wave 1 Composition (40 creatures)

| Rarity | Per Role | Total | Notes |
|--------|----------|-------|-------|
| Common | 4 | 16 | Most players start here |
| Uncommon | 3 | 12 | Accessible upgrades |
| Rare | 2 | 8 | Rewarding pulls |
| Epic | 1 | 4 | Chase targets |

Selection criteria:
1. **Fan favorites** — creatures players already pull for and show off
2. **Iconic animals** — T-Rex, Triceratops, Velociraptor, Mammoth, etc.
3. **Data completeness** — type, diet, era, description, image all present
4. **Visual diversity** — mix of dinosaurs, mammals, marine, insects
5. **Ability coverage** — each of the 15 actives and 10 passives appears on at least 1-2 creatures

Creatures not in the current wave are visible in collection/encyclopedia but show "Not yet battle-ready" and can't be selected for teams. New waves become available through a data seed — no code changes required.

Each wave release is a mini-event that brings players back and generates engagement.

---

## Future Hooks (Not at Launch)

- Fossil stakes (friendly / standard / high tiers with ante + pot)
- ELO-based rating (replace flat +25/-20 with proper ELO math)
- Ranked seasons with cosmetic rewards
- Arena tier rewards (rating thresholds unlock cosmetics or bonuses)
- Ascension tier battle stat multipliers (Bronze +10%, Silver +20%, etc.)
- Creature XP + leveling (level 1-30, stats scale per level)
- PvE expeditions (idle auto-battle against procedural encounters)
- Grand Arena (5-creature teams)
- Team presets (save/load team compositions)
- Spectator mode (live narration in Discord channel)
- Additional triggers: `atHpThreshold`, `onCrit`, `onDodge`
- Additional effects: `cleanse` (remove debuffs), `revive` (restore KO'd ally), `stat_steal`
- Ability evolution: higher rarity creatures unlock enhanced versions of the same ability
