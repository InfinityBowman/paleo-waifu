# Battle System Audit

Comprehensive review of the battle system across engine, backend, and UI layers.

---

## Critical Issues

### 1. Non-deterministic turn order breaks replays

**File:** `packages/shared/src/battle/engine.ts:101-106`

`rng.nextFloat()` is called inside the sort comparator, but JS `Array.sort` makes a non-deterministic number of comparisons. Same seed can produce different battles across engine versions or even different inputs.

**Fix:** Pre-roll initiative values per creature before sorting:

```ts
const pool = [...creaturesA, ...creaturesB].filter((c) => c.isAlive)
const withInit = pool.map((c) => ({ c, init: c.spd * rng.nextFloat(0.5, 1.5) }))
withInit.sort((a, b) => b.init - a.init)
const turnOrder = withInit.map((x) => x.c)
```

---

### 2. Dead creature fires `onBasicAttack` passive after reflect KO

**File:** `packages/shared/src/battle/engine.ts:217`, `packages/shared/src/battle/abilities.ts:211-223`

Reflect damage can kill the attacker mid-action, but `onBasicAttack` passives (e.g. `venomous`) still fire for the dead creature.

**Fix:** Guard with `if (creature.isAlive)` before firing `onBasicAttack` triggers.

---

### 3. `onTurnEnd` fires for KO'd creatures — zombie heals

**File:** `packages/shared/src/battle/engine.ts:278-291`

Dead creatures with `soothing_aura` still heal living allies at turn end.

**Fix:** Skip `onTurnEnd` triggers for dead creatures with `if (!creature.isAlive) continue`.

---

### 4. DoT ticks on dead creatures / `hot` can "resurrect" HP

**File:** `packages/shared/src/battle/engine.ts:259`, `packages/shared/src/battle/abilities.ts:558`

`tickStatusEffects` has no `isAlive` guard. HoT ticks can increase a dead creature's HP without setting `isAlive = true`.

**Fix:** Guard tick processing with `if (creature.isAlive)`.

---

### 5. Race condition on daily arena limit

**File:** `web/src/lib/battle.ts:327-333, 448`

Check-then-act pattern. `checkDailyLimit` reads the counter, then `executeArenaBattle` does async work (hydration, simulation) before writing the incremented counter. Concurrent requests can all pass the limit check before any counter increment lands.

**Fix:** Use atomic SQL `UPDATE battle_rating SET arena_attacks_today = arena_attacks_today + 1 WHERE user_id = ? AND arena_attacks_today < 5 AND last_attack_date = ? RETURNING arena_attacks_today`. If zero rows affected, the limit is exhausted.

---

### 6. No auth check on `getBattleById` server function

**File:** `web/src/routes/_app/battle.$id.tsx:74`

Server function has no session check. Anyone who knows a battle ID can fetch full team/replay data via direct fetch. The `_app` layout guard only protects browser navigation, not direct server function calls.

**Fix:** Add session check at the top of `getBattleById`.

---

## Important Issues

### 7. Traded creatures break defender teams silently

**File:** `web/src/lib/battle.ts:74-81`

If a defender trades a creature on their team, `hydrateTeam` throws because the creature is no longer owned. The attacker gets a generic error and loses a daily attack. No feedback to either player.

**Fix:** When a `user_creature` is transferred via trade, invalidate any `battle_team` rows referencing it. Or return a specific error code (e.g. `defender_team_invalid`) that the client can surface.

---

### 8. Unvalidated `JSON.parse` of stored team data

**File:** `web/src/routes/api/battle.ts:148, 191`

Defender slots from DB are `JSON.parse`'d and passed directly to execution without schema validation. Corrupted data would produce unclear errors.

**Fix:** Parse through the same zod schema used for `set_team` input validation before passing to execution.

---

### 9. `ratingChange` stores attacker delta only

**File:** `web/src/lib/battle.ts:437`, `packages/shared/src/db/schema.ts`

`battle_log.ratingChange` is always the attacker's delta. A defender viewing their history would see the wrong sign unless the UI explicitly negates. No `defenderRatingChange` column exists.

**Fix:** Either add a `defender_rating_change` column, or document the convention clearly and ensure all consumers check which side the viewing user is on.

---

### 10. Simultaneous wipe credits defender as winner

**File:** `packages/shared/src/battle/engine.ts:621`

Both teams dying simultaneously results in `winner = 'B'` (defender) with `reason: 'ko'`. Players will perceive mutual destruction as a bug, not a clean defender win.

**Fix:** Return `winner: null` for simultaneous wipes, or add a distinct `reason: 'mutual_ko'`.

---

### 11. Wrong test assertion for basic attack multiplier

**File:** `packages/shared/src/battle/__tests__/engine.test.ts:408`

Test expects basic attack multiplier `0.9`, actual constant in `constants.ts` is `0.7`. Test is either failing or was never updated after the constant changed.

**Fix:** Update the test assertion to match the actual constant value.

---

### 12. `basicAttackMultiplier` patch drops all effects except `[0]`

**File:** `packages/shared/src/battle/engine.ts:202-208`

The `resolvedAbility` patch unconditionally replaces `effects` with a single-element array. If `BASIC_ATTACK` ever gets a second effect, it'll be silently dropped.

**Fix:** Patch only the first damage effect while preserving the rest:

```ts
effects: ability.effects.map((e, i) =>
  i === 0 && e.type === 'damage' ? { ...e, multiplier: bam } : e
),
```

---

### 13. `scaleEffect(effect, 0)` returns unscaled effect

**File:** `packages/shared/src/battle/abilities.ts:149-151`

`multiplier <= 0` guard returns the original effect instead of zeroing it. Latent bug for future `per_dead_ally` passives with non-`always` triggers.

**Fix:** Change the guard to only return early for `multiplier === 1`, and handle `<= 0` by actually zeroing the effect.

---

### 14. `critReductionPercent` is dead code

**File:** `packages/shared/src/battle/damage.ts:35`, `packages/shared/src/battle/constants.ts:219`

No ability template populates `critReductionPercent`. The field and its formula in the damage calculation work correctly but can never activate through any existing ability.

**Fix:** Either remove the dead field or add an ability template that uses `crit_reduction` effect type.

---

### 15. `refreshOpponents` early return discards opponents

**File:** `web/src/routes/_app/battle.index.tsx:71`

If all opponent defense team creature IDs are empty (data integrity edge case), returns `[]` instead of mapping opponents with empty `defenseCreatures` arrays.

**Fix:** Replace `return []` with `return opponents.map((o) => ({ ...o, defenseCreatures: [] }))`.

---

### 16. `name[0]` crash on empty username

**Files:** `web/src/components/battle/BattleList.tsx:515,590,686`, `web/src/components/battle/BattleReplay.tsx:102`, `web/src/components/battle/BattleTransition.tsx:340,429`

Discord allows empty display names. `name[0].toUpperCase()` throws TypeError on empty strings.

**Fix:** Replace with `name?.[0]?.toUpperCase() ?? '?'`.

---

### 17. `router.invalidate()` fires during active transition

**File:** `web/src/components/battle/BattleList.tsx:125`

Causes the page behind the overlay to refetch/rerender while the battle transition animation is still playing.

**Fix:** Move `router.invalidate()` to after the transition dismisses, or into `handleBattleNavigate`.

---

### 18. `selectedCreatureIds` Set defeats `useMemo`

**File:** `web/src/components/battle/BattleTeamPicker.tsx:62`

New `Set` instance created on every render is used as a `useMemo` dependency. The memo recomputes every render, providing no memoization benefit.

**Fix:** Wrap `selectedCreatureIds` in its own `useMemo` keyed on `value`.

---

### 19. Replay HP bars matched by index, not creature ID

**File:** `web/src/components/battle/BattleReplay.tsx:134`

`finalState[i]` assumes engine output order matches display order. If the engine reorders creatures internally, the wrong HP bar appears on the wrong creature card.

**Fix:** Match by creature name or stable ID: `finalState?.find(s => s.name === c.name)`.
