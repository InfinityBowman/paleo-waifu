# Ability System

The ability system for PaleoWaifu's battle engine. For core combat mechanics, see [mechanics.md](./mechanics.md).

---

## Effect / Trigger / Target (ETT) Architecture

Abilities are composed from three primitives:

- **Effect** -- what it does (deal damage, heal, apply a DoT, grant a shield)
- **Trigger** -- when it fires (on use, on hit, on kill, at turn end, at battle start)
- **Target** -- who it affects (self, single enemy, all allies, lowest HP ally)

Active abilities and passive abilities are the same data structure. An ability with an `onUse` trigger is an active (the creature chooses to use it). Any other trigger is a passive (the engine fires it automatically). The engine processes all abilities through the same resolution pipeline.

Each creature has **1 active ability + 1 passive ability**.

---

## Effects

Effects are the atomic units of what an ability does. An ability can have multiple effects (e.g., "deal damage AND apply poison").

| Effect               | Parameters                                        | Description                                                                                                   |
| -------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **damage**           | `multiplier`, `scaling: atk \| def`               | Deal `stat * multiplier` damage, mitigated by DEF                                                             |
| **heal**             | `percent`                                         | Heal `percent`% of target's max HP                                                                            |
| **dot**              | `dotKind: poison \| bleed`, `percent`, `duration` | Apply `percent`% max HP damage per turn for `duration` turns. Ignores DEF.                                    |
| **buff**             | `stat: atk \| def \| spd`, `percent`, `duration`  | Increase `stat` by `percent`% for `duration` turns. Same-stat buff replaces previous.                         |
| **debuff**           | `stat: atk \| def \| spd`, `percent`, `duration`  | Decrease `stat` by `percent`% for `duration` turns. Same-stat debuff replaces previous.                       |
| **shield**           | `percent`, `duration`                             | Grant a shield absorbing `percent`% of caster's max HP for `duration` turns. Latest shield replaces previous. |
| **stun**             | `duration`                                        | Target skips next `duration` turns.                                                                           |
| **taunt**            | `duration`                                        | Forces all single-target enemy attacks to target this creature. Replaces previous team taunts.                |
| **lifesteal**        | `percent`                                         | Heal caster for `percent`% of damage dealt. Only valid alongside a `damage` effect.                           |
| **reflect**          | `percent`, `duration`                             | Reflect `percent`% of damage taken back to attacker for `duration` turns.                                     |
| **damage_reduction** | `percent`                                         | Permanently reduce all incoming damage by `percent`%.                                                         |
| **crit_reduction**   | `percent`                                         | Reduce incoming crit bonus by `percent`%.                                                                     |
| **flat_reduction**   | `scalingStat: def`, `scalingPercent`              | Reduce incoming damage by a flat amount equal to `scalingPercent`% of DEF.                                    |
| **dodge**            | `basePercent`                                     | Chance to dodge attacks entirely. Scales with SPD ratio, capped 3-40%.                                        |

---

## Triggers

Triggers define when the engine fires an ability's effects.

| Trigger            | Parameters   | Description                                                                            |
| ------------------ | ------------ | -------------------------------------------------------------------------------------- |
| **onUse**          | `cooldown`   | Active ability. Creature chooses to use it on their turn. Goes on cooldown after use.  |
| **onBeforeAttack** | --           | Fires after target selection, before attack resolves. Used for conditional self-buffs. |
| **onBasicAttack**  | --           | Fires after a basic attack resolves. Used for on-hit effects like poison.              |
| **onHit**          | --           | Fires whenever this creature takes damage.                                             |
| **onKill**         | --           | Fires when this creature KOs an enemy.                                                 |
| **onEnemyKO**      | --           | Fires when any enemy is KO'd (regardless of who killed them).                          |
| **onAllyKO**       | --           | Fires when an ally is KO'd.                                                            |
| **onTurnStart**    | --           | Fires at the start of this creature's turn.                                            |
| **onTurnEnd**      | --           | Fires at the end of this creature's turn.                                              |
| **onBattleStart**  | `condition?` | Fires once at battle setup. Optional condition gates activation.                       |
| **always**         | --           | Permanent modifier, applied at battle start and recalculated dynamically each turn.    |

### Trigger Timing Details

- **`onBeforeAttack`** fires after the AI selects a target but before `resolveAbilityEffects`. This allows self-buffs (like Predator Instinct's ATK boost) to apply to the current attack. The buff needs duration 2 to survive the status tick at end of turn.
- **`onBasicAttack`** fires only for basic attacks, not active abilities. Effects target the `attack_target`.
- **`always`** passives are materialized as flat fields on the creature (e.g., `damageReductionPercent`, `dodgeBasePercent`). Dynamic `always` passives like Pack Hunter recalculate each turn based on ally count.

---

## Targets

| Target             | Description                                               |
| ------------------ | --------------------------------------------------------- |
| **self**           | The creature that owns this ability.                      |
| **single_enemy**   | One enemy, prioritizing front row. Respects taunt.        |
| **all_enemies**    | All living enemies.                                       |
| **lowest_hp_ally** | The ally with the lowest HP%.                             |
| **all_allies**     | All living allies (including self).                       |
| **random_enemy**   | One randomly selected living enemy.                       |
| **attack_target**  | The enemy being attacked (for onBasicAttack triggers).    |
| **attacker**       | The creature that just dealt damage (for onHit triggers). |

---

## Conditions

Optional gates on triggers. If the condition is false, the ability does not fire.

| Condition           | Parameters           | Description                                            |
| ------------------- | -------------------- | ------------------------------------------------------ |
| **in_row**          | `row: front \| back` | Only activates if creature is in the specified row.    |
| **target_hp_below** | `percent`            | Only activates if the target's HP is below `percent`%. |
| **per_ally_alive**  | --                   | Effect stacks once per living ally (excluding self).   |
| **per_dead_ally**   | --                   | Effect stacks once per KO'd ally.                      |

---

## Active Ability Pool (15)

Each creature gets exactly 1 active ability from this pool, plus a creature-specific flavor name (e.g., "Bite" -> "Sickle Claw Slash" for Velociraptor).

### Damage (5)

| Name               | Trigger     | Effects                                  | Target       | Role Affinity    |
| ------------------ | ----------- | ---------------------------------------- | ------------ | ---------------- |
| **Bite**           | onUse(cd:0) | damage(1.0x ATK)                         | single_enemy | Striker, Bruiser |
| **Crushing Jaw**   | onUse(cd:3) | damage(1.3x ATK)                         | single_enemy | Striker          |
| **Venom Strike**   | onUse(cd:2) | damage(0.7x ATK), dot(poison 5%/turn 3t) | single_enemy | Striker          |
| **Feeding Frenzy** | onUse(cd:3) | damage(1.0x ATK), lifesteal(25%)         | single_enemy | Striker, Bruiser |
| **Headbutt**       | onUse(cd:3) | damage(0.8x ATK), stun(1t)               | single_enemy | Bruiser, Tank    |

### AoE (2)

| Name           | Trigger     | Effects                                 | Target       | Role Affinity |
| -------------- | ----------- | --------------------------------------- | ------------ | ------------- |
| **Tail Sweep** | onUse(cd:2) | damage(0.6x ATK)                        | all_enemies  | Bruiser, Tank |
| **Bleed**      | onUse(cd:2) | damage(0.5x ATK), dot(bleed 5%/turn 3t) | single_enemy | Striker       |

### Buff (2)

| Name               | Trigger     | Effects           | Target     | Role Affinity |
| ------------------ | ----------- | ----------------- | ---------- | ------------- |
| **Rally Cry**      | onUse(cd:2) | buff(ATK +20% 3t) | all_allies | Support       |
| **Herd Formation** | onUse(cd:2) | buff(DEF +30% 3t) | all_allies | Support, Tank |

### Debuff (2)

| Name            | Trigger     | Effects             | Target       | Role Affinity    |
| --------------- | ----------- | ------------------- | ------------ | ---------------- |
| **Intimidate**  | onUse(cd:2) | debuff(ATK -25% 3t) | single_enemy | Support          |
| **Armor Break** | onUse(cd:2) | debuff(DEF -25% 3t) | single_enemy | Support, Bruiser |

### Heal (2)

| Name          | Trigger     | Effects   | Target         | Role Affinity |
| ------------- | ----------- | --------- | -------------- | ------------- |
| **Symbiosis** | onUse(cd:2) | heal(15%) | all_allies     | Support       |
| **Mend**      | onUse(cd:1) | heal(25%) | lowest_hp_ally | Support       |

### Utility (2)

| Name            | Trigger     | Effects                      | Target         | Role Affinity |
| --------------- | ----------- | ---------------------------- | -------------- | ------------- |
| **Shield Wall** | onUse(cd:2) | shield(25% 2t)               | lowest_hp_ally | Tank          |
| **Taunt**       | onUse(cd:1) | taunt(2t), buff(DEF +25% 2t) | self           | Tank          |

---

## Passive Ability Pool (13)

Each creature gets exactly 1 passive ability.

### Defensive (4)

| Name              | Trigger       | Effects                                              | Target | Condition | Role Affinity |
| ----------------- | ------------- | ---------------------------------------------------- | ------ | --------- | ------------- |
| **Thick Hide**    | always        | damage_reduction(15%)                                | self   | --        | Tank          |
| **Spiked Plates** | onBattleStart | reflect(20%, permanent)                              | self   | --        | Tank          |
| **Ironclad**      | always        | flat_reduction(10% of DEF)                           | self   | --        | Tank, Bruiser |
| **Evasive**       | always        | dodge(base 10%, scales with SPD ratio, capped 3-40%) | self   | --        | Striker       |

### Offensive (4)

| Name                  | Trigger        | Effects                        | Target        | Condition            | Role Affinity |
| --------------------- | -------------- | ------------------------------ | ------------- | -------------------- | ------------- |
| **Predator Instinct** | onBeforeAttack | buff(ATK +20% 2t)              | self          | target_hp_below(50%) | Striker       |
| **Venomous**          | onBasicAttack  | dot(poison 3%/turn 2t)         | attack_target | --                   | Striker       |
| **Territorial**       | onBattleStart  | buff(ATK +10%), buff(DEF +10%) | self          | in_row(front)        | Bruiser       |
| **Pack Hunter**       | always         | buff(ATK +10%)                 | self          | per_ally_alive       | Striker       |

### Sustain (3)

| Name              | Trigger   | Effects   | Target     | Condition | Role Affinity |
| ----------------- | --------- | --------- | ---------- | --------- | ------------- |
| **Regenerative**  | onTurnEnd | heal(3%)  | self       | --        | Tank, Support |
| **Scavenger**     | onEnemyKO | heal(15%) | self       | --        | Bruiser       |
| **Soothing Aura** | onTurnEnd | heal(2%)  | all_allies | --        | Support       |

### Support (2)

| Name                    | Trigger       | Effects             | Target        | Condition | Role Affinity |
| ----------------------- | ------------- | ------------------- | ------------- | --------- | ------------- |
| **Fortifying Presence** | onBattleStart | buff(DEF +10%)      | all_allies    | --        | Support       |
| **Weakening Strikes**   | onBasicAttack | debuff(ATK -15% 2t) | attack_target | --        | Support       |

### None

| Name     | Trigger | Effects | Target | Role Affinity        |
| -------- | ------- | ------- | ------ | -------------------- |
| **None** | always  | (none)  | self   | All roles (fallback) |

---

## Basic Attack

Always available, no cooldown. Used when the active ability is on cooldown or scored lower by the AI.

| Name             | Effects          | Target       |
| ---------------- | ---------------- | ------------ |
| **Basic Attack** | damage(0.9x ATK) | single_enemy |

---

## AI Decision Making

The AI scores each available action (active ability vs. basic attack) and picks the highest score.

### Scoring Categories

Each ability is categorized: `damage`, `aoe_damage`, `dot`, `heal`, `buff`, `debuff`, `shield`, `stun`, `taunt`.

### Role Weights

Each role has weight multipliers per category. Examples:

- **Strikers** prefer damage (1.3x) and dot (1.2x), avoid taunt (0.3x) and shield (0.5x)
- **Tanks** prefer taunt (1.8x) and shield (1.5x), avoid damage (0.7x) and dot (0.6x)
- **Support** prefers heal (1.5x) and buff (1.4x), avoids damage (0.5x)
- **Bruiser** is balanced across all categories (0.8x-1.0x)

### Game State Modifiers

- **Aggression**: Boost damage when winning (HP ratio > 1.3), reduce when losing
- **Defensive**: Boost heals/shields when losing (HP ratio < 0.7)
- **Urgency**: Boost damage after turn 15/20 to prevent stalling
- **Focus**: Boost single-target damage when only 1 enemy remains (1.3x)

### Smart Targeting

- Finish low-HP enemies (kill bonus)
- Don't waste long-cooldown abilities on targets a basic attack could kill (overkill penalty)
- Prefer debuffing highest-ATK enemies or healers
- Don't apply DoTs to dying targets or targets that already have DoTs
- Don't taunt when only 1 enemy remains

The AI is fully deterministic -- given the same game state and RNG seed, the same choice is always made.

---

## Ability Assignment Strategy

Hand-crafted for Wave 1 (40 creatures). Each creature gets:

1. **1 active ability** from the pool, chosen for thematic fit
2. **1 passive ability** from the pool, chosen for thematic fit
3. **Flavor names** -- creature-specific rename of the template (e.g., "Crushing Jaw" -> "Tyrant's Bite" for T-Rex)

With only 40 creatures at launch, every assignment is hand-reviewed. Future waves can use LLM-assisted assignment constrained to the template pool.

---

## Effect Resolution Pipeline

The engine has one `resolveEffect()` function that handles every effect type uniformly:

1. An ability's effects array is iterated in order
2. Each effect calls `resolveEffect(effect, caster, target, context)`
3. If a target is KO'd by a damage effect, subsequent effects targeting that creature are skipped (except lifesteal, which heals the caster)
4. Shield absorption happens during damage resolution -- damage is reduced by the shield's remaining value before hitting HP
5. Reflect damage is calculated after shield absorption and applied to the attacker

### Effect-Specific Edge Cases

**Damage resolution order:**

```
1. Calculate raw damage (ATK * multiplier, crit, DEF mitigation, variance, passives)
2. Shield absorption: absorbed = min(damage, shieldValue). Shield removed if depleted.
3. Reflect: reflectDmg = floor(postShieldDamage * reflectPercent / 100).
   - Only fires if postShieldDamage > 0 (fully shielded hits don't reflect).
   - Reflect damage is applied directly to attacker HP. Can KO the attacker.
4. Apply remaining damage to target HP.
```

**Stun:**

- Sets `isStunned = true` and adds a stun status effect.
- Re-stunning clears the old stun status effect before adding the new one (prevents stacking).
- Does not apply to dead targets.
- Consumed by the engine (not `tickStatusEffects`) -- the engine checks `isStunned`, skips the action, then clears the flag and removes the status.

**Lifesteal:**

- Heals caster for `max(1, floor(lastDamageDealt * percent / 100))`.
- Returns empty if `lastDamageDealt <= 0` (dodged or no preceding damage).
- Caps at `maxHp`.
- Explicitly exempted from the "skip effects after target death" rule -- lifesteal heals the caster, not the target.

**Buff/Debuff replacement:**

- Applying a buff/debuff to a stat that already has one of the same kind (buff or debuff) first removes the old modifier, then applies the new one. This prevents stat drift from accumulated modifiers.
- Different stats can have simultaneous buffs/debuffs (e.g., ATK buff + DEF buff).

**Taunt:**

- Applying taunt clears all existing taunts on the caster's team before adding the new one. Only one creature per team can taunt at a time.

**Shield:**

- Applying a new shield removes the existing shield status effect (latest replaces previous).
- Shield value is based on `caster.maxHp * percent / 100`.

### Trigger Safety Guards

- **`onBasicAttack`** only fires if the attacker is still alive after ability resolution. If reflect damage KOs the attacker, `onBasicAttack` passives (e.g., Venomous) do NOT fire.
- **`onKill`** only fires if the attacker is still alive. A creature that dies from reflect on the same action that kills an enemy does NOT trigger `onKill`.
- **`onTurnEnd` / `onTurnStart`** only fire for living creatures. Dead creatures' passives are inert.
- **`onEnemyKO`** fires for all living members of the opposing team when any creature is KO'd.
- **`onAllyKO`** fires for all living allies (excluding the dead creature itself).
