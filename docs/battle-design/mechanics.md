# Battle Mechanics

Core combat mechanics for PaleoWaifu's auto-battle system. For the ability system, see [abilities.md](./abilities.md). For UX, rollout, and competitive structure, see [user-experience.md](./user-experience.md). For explored alternatives and early design rationale, see [ideas.md](./ideas.md).

---

## Overview

Async auto-battle system inspired by AFK Arena. Players assemble a team of 3 creatures, position them in a front/back formation, and challenge other players. Battles simulate turn-by-turn combat server-side and produce a narrative log. No real-time interaction during combat -- strategy lives in team building, formation, and synergies.

No creature XP or leveling at launch. Power comes from rarity, role, abilities, ascension (future), and team synergies. No Fossil stakes at launch.

---

## Stats

### Core Stats (4)

| Stat        | Abbrev | Purpose                                                                  |
| ----------- | ------ | ------------------------------------------------------------------------ |
| **Health**  | HP     | Total health pool. KO'd at 0.                                            |
| **Attack**  | ATK    | Damage dealt by basic attacks and offensive abilities.                   |
| **Defense** | DEF    | Reduces incoming damage via diminishing returns. Never fully negates.    |
| **Speed**   | SPD    | Determines turn order via weighted initiative: `SPD * random(0.5, 1.5)`. |

Utility effects (heals, shields, buffs) use fixed percentages defined by the ability itself. ATK is the sole offensive scaling stat. This keeps stat budgets clean and role identity sharp.

### Roles (4 Archetypes)

Each creature gets one role based on its creature type. Role determines stat distribution and which abilities it can be assigned.

| Role        | Identity                           | Typical Position | Typical Types                                                  |
| ----------- | ---------------------------------- | ---------------- | -------------------------------------------------------------- |
| **Striker** | High ATK, moderate SPD, low DEF    | Back             | Large theropods, small theropods, Eurypterida, Pterosauria     |
| **Tank**    | High HP/DEF, low ATK/SPD           | Front            | Sauropods, armoured dinosaurs, Proboscidea, Asterolepidiformes |
| **Support** | High HP, moderate DEF/SPD, low ATK | Back             | Euornithopods, Primates, Sirenia, Trinucleida                  |
| **Bruiser** | Balanced across all stats          | Front            | Ceratopsians, Crocodylia, Saurischia, Mammalia                 |

**Fallback assignment** (for creatures with unmapped type): Bruiser (the most balanced distribution). Diet does not influence role -- a carnivorous creature can be any role if its type maps to it.

### Stat Scaling

Stats are calculated from `rarity base total * role distribution * individual variance`.

**Rarity base stat totals:**

| Rarity    | Base Stat Total |
| --------- | --------------- |
| Common    | 105             |
| Uncommon  | 130             |
| Rare      | 170             |
| Epic      | 215             |
| Legendary | 280             |

**Role stat distributions** (% of base total allocated to each stat, sums to 1.0):

| Role    | HP  | ATK | DEF | SPD |
| ------- | --- | --- | --- | --- |
| Striker | 28% | 35% | 15% | 22% |
| Tank    | 38% | 12% | 35% | 15% |
| Support | 38% | 10% | 27% | 25% |
| Bruiser | 30% | 25% | 25% | 20% |

A Striker's ATK (35%) is nearly 3x a Tank's (12%). A Tank's DEF (35%) is over 2x a Striker's (15%). Each role has a clear statistical identity.

**Individual variance:** A deterministic hash of the creature's ID produces a per-stat modifier between 0.90 and 1.10. Same creature always gets the same stats. Two common Strikers feel slightly different without manual tuning.

Physical size/weight data is displayed as flavor in creature cards and battle narration but does NOT influence stats.

---

## Formation

Teams of 3, placed in front row or back row.

- **Front row** (1-2 creatures): Takes hits first. Single-target attacks must target front row while front row creatures are alive.
- **Back row** (1-2 creatures): Protected until front row is KO'd.
- AoE abilities hit all living creatures regardless of row.
- Tanks and Bruisers belong in front. Strikers and Supports belong in back.
- Misplacing roles is a valid (bad) strategy -- a Support in front row will die fast.

---

## Damage Formula

The damage pipeline is clean and linear. No branching on ability type, no special stat routing.

```
1. Base damage
   raw = stat * ability.multiplier
   (stat = ATK for scaling:'atk', DEF for scaling:'def')

2. Crit check (10% chance)
   critBonus = 0.5 * (1 - defender.critReductionPercent / 100)
   if crit: raw *= (1 + critBonus)
   (Spiked Plates passive reduces the crit bonus)

3. DEF mitigation (diminishing returns)
   raw *= K / (K + defender.DEF)
   K = DEF_SCALING_CONSTANT (default 100, tunable)
   Lower K = DEF is stronger.
   At K=100: DEF 60 lets 62.5% through, DEF 100 lets 50% through.
   At K=80:  DEF 60 lets 57.1% through, DEF 100 lets 44.4% through.

4. Variance
   raw *= random(0.9, 1.1)

5. Thick Hide (damage_reduction passive)
   raw *= (1 - damageReductionPercent / 100)

6. Ironclad (flat_reduction passive)
   flatReduction = floor(defender.DEF * flatReductionDefPercent / 100)
   raw = max(1, raw - flatReduction)

7. Global damage scaling
   raw *= COMBAT_DAMAGE_SCALE (default 0.6, tuning knob for battle length)

8. Floor
   finalDamage = max(1, floor(raw))

9. Dodge check (Evasive passive)
   dodgeChance = min(0.4, max(0.03, baseDodge * defender.SPD / attacker.SPD))
   if dodged: finalDamage = 0
```

### Design Decisions

- **DEF uses diminishing returns** (`K / (K + DEF)`) rather than flat subtraction. This means stacking DEF is always useful but never makes a creature unkillable. The constant K is tunable via the balance UI.
- **No diet damage modifier.** Diet affects team synergies and role fallback assignment, but not individual hit damage. Removed to simplify the formula.
- **DoTs bypass DEF entirely.** Poison and bleed deal `floor(maxHp * percent)` per turn -- flat percentage damage with no mitigation. This makes them strong against high-DEF tanks.
- **Crit is a flat 10% chance** with a 1.5x multiplier (before Spiked Plates reduction). No crit scaling stat.
- **COMBAT_DAMAGE_SCALE** is a global knob that controls battle length. At 0.6, battles typically run 8-15 turns. Lower values = longer battles.

---

## Synergies

Synergies reward thoughtful team building over just picking your 3 highest-rarity creatures. Applied once at battle start as flat stat bonuses.

### Type Synergy (same creature type)

| Count          | Bonus                     |
| -------------- | ------------------------- |
| 2 of same type | +5% HP to those creatures |
| 3 of same type | +7% HP, +3% ATK to all    |

### Era Synergy (same geological era)

| Count         | Bonus                                    |
| ------------- | ---------------------------------------- |
| 2 of same era | +3% HP, ATK, DEF, SPD to those creatures |
| 3 of same era | +3% HP, ATK, DEF, SPD to all             |

### Diet Synergy

| Composition                         | Bonus             |
| ----------------------------------- | ----------------- |
| All Carnivore                       | +10% ATK, +7% SPD |
| All Herbivore                       | +10% DEF, +10% HP |
| Mixed (1+ carnivore + 1+ herbivore) | +12% SPD, +7% ATK |

### Diet Categories

Carnivorous, Herbivorous, Piscivorous, Omnivorous, Herbivorous/omnivorous (treated as Herbivorous for synergy purposes).

---

## Status Effects

| Effect      | Behavior                                                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| **Poison**  | X% max HP damage per turn. Ignores DEF. Stacks with multiple sources.                                                 |
| **Bleed**   | X% max HP damage per turn. Ignores DEF. Stacks with multiple sources.                                                 |
| **Buff**    | +X% to a stat for N turns. Same-stat buff replaces previous.                                                          |
| **Debuff**  | -X% to a stat for N turns. Same-stat debuff replaces previous.                                                        |
| **Stun**    | Target skips their next turn. Removed after skip.                                                                     |
| **Shield**  | Absorbs up to X damage before HP is reduced. Latest shield replaces previous. Lasts until broken or duration expires. |
| **HoT**     | Heal X% max HP at end of target's turn for N turns.                                                                   |
| **Taunt**   | Forces all single-target enemy attacks to target the taunting creature. Latest taunt replaces previous team taunts.   |
| **Reflect** | Reflects X% of damage taken back to attacker. Ends when duration expires.                                             |

Buffs/debuffs of the same stat don't stack -- latest applied replaces the previous. Different stats can have simultaneous effects. Poison and Bleed DO stack from multiple sources.

---

## Battle Simulation

### Turn Flow

1. **Setup:** Hydrate creatures from team data, place in formation, materialize `always` passives, apply synergy bonuses, fire all `onBattleStart` triggers. All creatures start at full HP.
2. **Turn loop** (max 30 turns):
   - Calculate initiative for each living creature: `SPD * random(0.5, 1.5)` (weighted initiative with randomness)
   - Sort by initiative descending
   - Each creature acts in initiative order:
     1. Decrement active ability cooldown
     2. If stunned -> skip action, tick status effects, continue
     3. Re-materialize dynamic `always` passives (e.g., Pack Hunter recalculates ally count)
     4. Fire `onTurnStart` triggers
     5. AI selects action: use active ability (if off cooldown and scored higher) or basic attack
     6. Fire `onBeforeAttack` triggers (e.g., Predator Instinct checks target HP)
     7. Resolve ability effects (damage, heal, buff, etc.)
     8. Fire `onBasicAttack` triggers if basic attack (e.g., Venomous applies poison)
     9. Process KOs -> fire `onKill`, `onEnemyKO`, `onAllyKO` triggers
     10. Tick status effects (DoT damage, buff/debuff expiry, shield duration)
     11. Process KOs from DoT
     12. Fire `onTurnEnd` triggers (e.g., Regenerative heals)
   - Win check: if one team has 0 creatures alive, other team wins
3. **Timeout** (turn 30): Team with higher total remaining HP% wins. If tied, defender (team B) wins (anti-stall).

### Trigger Resolution Order

When multiple triggers could fire (e.g., two creatures both have `onEnemyKO`), resolve in initiative order (same order as the turn). This keeps behavior deterministic.

### Determinism

The entire battle is deterministic given the same inputs and RNG seed. Same teams, same seed = same result, same log. The seeded RNG (mulberry32) produces the same sequence every time.

---

## Tuning Constants

These values are adjustable via the balance UI without code changes:

| Constant                | Default | Purpose                                            |
| ----------------------- | ------- | -------------------------------------------------- |
| `COMBAT_DAMAGE_SCALE`   | 0.6     | Global damage multiplier. Controls battle length.  |
| `DEF_SCALING_CONSTANT`  | 100     | DEF formula constant. Lower = DEF is stronger.     |
| Role stat distributions | (table) | Per-role % allocation of stat budget.              |
| Rarity stat modifiers   | (none)  | Optional per-rarity stat scaling overrides.        |
| Ability overrides       | (none)  | Per-ability multiplier/duration/percent overrides. |
