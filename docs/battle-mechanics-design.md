# Battle Mechanics Design

Official game design for PaleoWaifu's battle system. See `battle-mechanics-design-ideas.md` for explored alternatives and rationale. See `battle-implementation-plan.md` for technical details (schema, pipeline, build phases).

---

## Overview

Async auto-battle system inspired by AFK Arena. Players assemble a team of 3 creatures, position them in a front/back formation, and challenge other players. Battles simulate turn-by-turn combat server-side and produce a narrative log. No real-time interaction during combat — strategy lives in team building, formation, and synergies.

No creature XP or leveling at launch. Power comes from rarity, role, abilities, ascension (future), and team synergies.

No Fossil stakes at launch. Battles are free to play — no risk, no barrier. This encourages everyone to battle early and often while the player base is growing.

---

## Stats

### Core Stats (5)

| Stat | Abbrev | Purpose |
|------|--------|---------|
| **Health** | HP | Total health pool. KO'd at 0. |
| **Attack** | ATK | Damage dealt by basic attacks and offensive abilities. |
| **Defense** | DEF | Reduces incoming damage. Never fully negates. |
| **Speed** | SPD | Determines turn order. Higher acts first. Ties broken randomly. |
| **Ability Power** | ABL | Amplifies ability damage, healing, and effect strength. |

### Roles (6 Archetypes)

Each creature gets one role based on its creature type. Role determines stat distribution.

| Role | Stat Priority | Creature Types |
|------|--------------|----------------|
| **Striker** | ATK > SPD > HP > ABL > DEF | Large theropods, Eurypterida |
| **Tank** | HP > DEF > ATK > ABL > SPD | Sauropods, armoured dinosaurs, ceratopsians |
| **Scout** | SPD > ATK > ABL > HP > DEF | Small theropods, Pterosauria |
| **Support** | ABL > HP > DEF > SPD > ATK | Euornithopods, herbivore mammals |
| **Bruiser** | ATK > HP > DEF > SPD > ABL | Saurischia, Ornithischia, Crocodylia |
| **Specialist** | ABL > SPD > ATK > HP > DEF | Ichthyosauria, Plesiosauria, Temnospondyli |

**Fallback assignment** (for creatures with null/unknown type):
- Carnivorous diet → Striker
- Herbivorous diet → Tank
- Piscivorous diet → Specialist
- Omnivorous diet → Bruiser
- Unknown everything → Bruiser

### Stat Scaling

Stats are calculated from `rarity base total × role distribution × individual variance`.

**Rarity base stat totals:**

| Rarity | Base Stat Total |
|--------|----------------|
| Common | 100 |
| Uncommon | 130 |
| Rare | 170 |
| Epic | 220 |
| Legendary | 300 |

**Role stat distributions** (% of base total allocated to each stat):

| Role | HP | ATK | DEF | SPD | ABL |
|------|-----|-----|-----|-----|-----|
| Striker | 20% | 30% | 10% | 25% | 15% |
| Tank | 30% | 15% | 25% | 10% | 20% |
| Scout | 15% | 25% | 10% | 30% | 20% |
| Support | 25% | 10% | 20% | 15% | 30% |
| Bruiser | 25% | 25% | 20% | 15% | 15% |
| Specialist | 15% | 20% | 10% | 25% | 30% |

**Individual variance:** A deterministic hash of the creature's ID produces a per-stat modifier between 0.90 and 1.10. Same creature always gets the same stats. Two common Strikers feel slightly different without manual tuning.

Physical size/weight data is displayed as flavor in creature cards and battle narration but does NOT influence stats.

---

## Abilities

Each creature has **2 active abilities + 1 passive ability**.

Abilities come from a shared template pool (~35 actives, ~15 passives). Each creature picks a specific combination from the pool, optionally with a creature-specific name variant (e.g., "Bite" → "Sickle Claw Slash" for Velociraptor). The combination is what makes each creature feel unique — not every ability being bespoke.

### Active Ability Templates (~35 total)

**Damage (single target):**
| Template | Multiplier | Cooldown | Notes |
|----------|-----------|----------|-------|
| Bite | 1.2x ATK | 0 | Basic bread-and-butter |
| Claw Strike | 1.0x ATK | 0 | Slightly weaker but faster (acts +10 SPD this turn) |
| Horn Charge | 1.5x ATK | 2 | Heavy hitter |
| Crushing Jaw | 1.8x ATK | 3 | Strongest single-target |
| Venom Strike | 0.8x ATK + poison | 2 | Deals 5% max HP/turn for 3 turns |
| Feeding Frenzy | 1.3x ATK + lifesteal | 3 | Heals 30% of damage dealt |

**Damage (AoE):**
| Template | Multiplier | Cooldown | Notes |
|----------|-----------|----------|-------|
| Tail Sweep | 0.7x ATK to all enemies | 2 | Standard AoE |
| Stomp | 0.8x ATK to all enemies | 3 | Slightly stronger AoE |
| Screech | 0.6x ABL to all enemies | 2 | ABL-scaling AoE |

**Buff:**
| Template | Effect | Duration | Cooldown | Notes |
|----------|--------|----------|----------|-------|
| Rally Cry | +20% ATK to all allies | 3 turns | 4 | Offensive team buff |
| Herd Formation | +20% DEF to all allies | 3 turns | 4 | Defensive team buff |
| Adrenaline Rush | +30% SPD to self | 2 turns | 3 | Self speed boost |
| Apex Roar | +15% ATK, +15% DEF to all allies | 2 turns | 5 | Premium buff, longer CD |

**Debuff:**
| Template | Effect | Duration | Cooldown | Notes |
|----------|--------|----------|----------|-------|
| Intimidate | -20% ATK to single enemy | 3 turns | 3 | Shuts down a striker |
| Mudslide | -20% SPD to all enemies | 2 turns | 4 | AoE slow |
| Armor Break | -30% DEF to single enemy | 3 turns | 3 | Setup for burst damage |

**Heal:**
| Template | Effect | Cooldown | Notes |
|----------|--------|----------|-------|
| Graze | Heal 25% max HP to self | 3 | Self sustain |
| Symbiosis | Heal 15% max HP to all allies | 4 | Team heal |
| Regenerate | Heal 8% max HP/turn for 3 turns | 4 | HoT |

**Utility:**
| Template | Effect | Cooldown | Notes |
|----------|--------|----------|-------|
| Shell Guard | Shield absorbing next hit (up to 30% max HP) | 4 | Damage soak |
| Headbutt | 0.8x ATK + stun 1 turn | 4 | CC — target skips next turn |
| Counter Stance | Reflect 40% of damage taken this turn | 3 | Risky but punishing |
| Dive Attack | 1.4x ATK, ignore DEF | 4 | DEF piercing |

### Passive Abilities (~15 total)

Each creature has 1 passive, always active.

| Passive | Effect | Typical Roles |
|---------|--------|---------------|
| **Thick Hide** | -15% incoming damage | Tank |
| **Predator Instinct** | +20% ATK vs targets below 50% HP | Striker |
| **Herd Mentality** | +10% all stats per ally of same creature type | Tank, Support |
| **Aquatic Adaptation** | +20% SPD, -10% DEF | Specialist |
| **Venomous** | Basic attacks apply poison (3% HP/turn, 2 turns) | Scout, Specialist |
| **Evasive** | 15% chance to dodge attacks | Scout |
| **Apex Predator** | Immune to stun, +10% ATK | Striker (legendary only) |
| **Ancient Resilience** | +5% all stats per KO'd ally (last-stand scaling) | Bruiser |
| **Territorial** | +15% ATK and DEF when in front row | Tank, Bruiser |
| **Pack Hunter** | +10% ATK per ally still alive | Scout, Striker |
| **Regenerative** | Heal 3% max HP at end of each turn | Tank, Support |
| **Camouflage** | 25% chance to not be targeted by single-target abilities | Scout |
| **Armored Plates** | Reduce crit damage taken by 50% | Tank |
| **Thermal Regulation** | Immune to debuffs for first 2 turns | Support, Specialist |
| **Scavenger** | Heal 15% max HP when an enemy is KO'd | Bruiser |

### Ability Assignment Strategy

Hybrid approach — deterministic rules assign roles and stats, then an LLM picks the most thematically appropriate abilities from the template pool for each creature and generates flavor name variants. The LLM is constrained to the pre-defined pools so it can't create balance problems. Human review only needed for epic/legendary creatures (~55 total).

---

## Formation

Teams of 3, placed in front row or back row.

- **Front row** (1-2 creatures): Takes hits first. Single-target attacks must target front row while front row creatures are alive.
- **Back row** (1-2 creatures): Protected until front row is KO'd.
- AoE abilities hit all living creatures regardless of row.
- Tanks and Bruisers belong in front. Scouts, Strikers, Specialists, and Supports belong in back.
- Misplacing roles is a valid (bad) strategy — a Scout in front row will die fast.

---

## Synergies

Synergies reward thoughtful team building over just picking your 3 highest-rarity creatures.

### Type Synergy (same creature type)

| Count | Bonus |
|-------|-------|
| 2 of same type | +10% HP to those creatures |
| 3 of same type | +15% HP, +10% ATK to all |

### Era Synergy (same geological era)

| Count | Bonus |
|-------|-------|
| 2 of same era | +5% all stats to those creatures |
| 3 of same era | +10% all stats to all |

### Diet Synergy

| Composition | Bonus |
|-------------|-------|
| All Carnivore | +15% ATK to all |
| All Herbivore | +20% DEF to all |
| All Autotrophic | +20% HP to all |
| Mixed (1+ carnivore + 1+ herbivore) | +10% SPD to all |

### Diet Matchup (attack modifier)

| Attacker → Defender | Damage Modifier |
|--------------------|-----------------|
| Carnivore → Herbivore | +15% |
| Herbivore → Carnivore | -10% |
| All other combinations | neutral |

Kept simple — only one meaningful advantage axis. Piscivorous, omnivorous, and autotrophic are treated as neutral in matchups.

### Diet Categories

Carnivorous, Herbivorous, Piscivorous, Omnivorous, Autotrophic (plants).

---

## Battle Simulation

### Turn Flow

1. **Setup:** Place teams in formation, apply synergy bonuses, all creatures start at full HP.
2. **Turn loop** (max 30 turns):
   - Sort all living creatures by SPD descending, randomize ties
   - Each creature acts in SPD order: select ability → select target (front row first) → resolve damage/effect → apply status effects → check for KOs
   - Win check: if one team has 0 creatures alive, other team wins
3. **Timeout** (turn 30): Team with higher total remaining HP% wins. If tied, defender wins (anti-stall).

### Ability Selection AI

Deterministic priority — given the same game state, creatures always make the same choice:

1. Heal available AND self HP < 30%? → Use heal
2. Shield available AND self has no shield? → Use shield
3. Buff available AND no active buff on team? → Use buff
4. Enemy exists below 20% HP AND single-target damage available? → Finish them
5. AoE available AND 2+ enemies alive? → Use AoE
6. Debuff available AND strongest enemy has no active debuff? → Use debuff
7. Stun available AND strongest enemy not stunned? → Use stun
8. Use highest-multiplier single-target damage ability off cooldown
9. Basic attack (1.0x ATK, no cooldown, always available)

### Damage Formula

- Raw damage = ATK (or ABL for ability-scaling) × ability multiplier
- Mitigation = raw damage × (100 / (100 + defender DEF)) — DEF always useful, never fully negates
- ±10% random variance per hit
- Diet matchup modifier applied after mitigation
- Minimum 1 damage
- Crit: 10% base chance, 1.5x damage (before mitigation)

### Status Effects

| Effect | Behavior |
|--------|----------|
| **Poison** | X% max HP damage at end of target's turn. Ignores DEF. |
| **Buff** | +X% to a stat for N turns. Expires at end of caster's turn. |
| **Debuff** | -X% to a stat for N turns. Expires at end of caster's turn. |
| **Stun** | Target skips their next turn. Removed after skip. |
| **Shield** | Absorbs up to X damage. Consumed when hit. Lasts until broken or 2 turns. |
| **HoT** | Heal X% max HP at end of target's turn for N turns. |

Buffs/debuffs of the same stat don't stack — latest applied replaces the previous. Different stats can have simultaneous effects.

---

## Challenge Lifecycle

```
CHALLENGE CREATED (challenger picks team)
  → PENDING
    → Accepted (defender picks team) → RESOLVED
    → Declined → DECLINED
    → 24h passes → EXPIRED
    → Challenger cancels → CANCELLED
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
| Bronze | 0–999 |
| Silver | 1000–1499 |
| Gold | 1500–1999 |
| Diamond | 2000–2499 |
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
⚔️ ARENA BATTLE — @Alice vs @Bob
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Alice's Team           Bob's Team
├ 🛡️ Triceratops       ├ 🗡️ T-Rex
├ 🛡️ Ankylosaurus      ├ 🗡️ Spinosaurus
└ ⚡ Velociraptor       └ 🏹 Pteranodon

Synergies: 🦕 Cretaceous +10%  |  🥩 Carnivore ATK +15%

Key Moments:
• T-Rex's Devastating Bite KOs Ankylosaurus (Turn 3)
• Velociraptor's Sickle Slash crits Pteranodon for 89 dmg (Turn 4)
• Triceratops finishes Spinosaurus with Horn Charge (Turn 7)

🏆 Alice wins in 9 turns (2 remaining vs 0)
📊 Alice 1245 (+25) Silver | Bob 1312 (-20) Gold

🔗 Full replay: paleowaifu.com/battle/abc123
```

### Web App

- `/battle` — Tabs: Challenge (search opponent, pick team), Incoming (pending challenges), History (past battles with replays)
- `/battle/:id` — Full turn-by-turn replay page with creature cards, HP bars, and narration. Shareable link.
- **Team picker:** Collection view filtered to battle-ready creatures, drag/click to fill 3 slots, assign front/back row, shows synergy bonuses in real-time.

---

## Battle-Ready Rollout

Not all 615 creatures launch with battle data. Roll out in waves based on data completeness.

### Waves

| Wave | Criteria | Count | When |
|------|----------|-------|------|
| **Wave 1** | Complete data (type + diet + size + desc) | 290 | Launch |
| **Wave 2** | Good data (3+ fields, usually missing size) | 250 | 1-2 weeks post-launch |
| **Wave 3** | Partial/sparse (needs enrichment) | 75 | Ongoing |

Wave 1 has good rarity spread: 130 common, 109 uncommon, 33 rare, 10 epic, 8 legendary. Enough for competitive variety across all 6 roles.

Creatures not in the current wave are visible in collection/encyclopedia but show "Not yet battle-ready" and can't be selected for teams. New waves become available through a data seed — no code changes required.

---

## Future Hooks (Not at Launch)

- Fossil stakes (friendly / standard / high tiers with ante + pot)
- ELO-based rating (replace flat +25/-20 with proper ELO math)
- Ranked seasons with cosmetic rewards
- Arena tier rewards (rating thresholds unlock cosmetics or bonuses)
- Ascension tier battle stat multipliers (Bronze +10%, Silver +20%, etc.)
- Creature XP + leveling (level 1–30, stats scale per level)
- PvE expeditions (idle auto-battle against procedural encounters)
- Grand Arena (5-creature teams)
- Team presets (save/load team compositions)
- Spectator mode (live narration in Discord channel)
