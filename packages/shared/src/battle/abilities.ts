import { calculateDamage } from './damage'
import { BASIC_ATTACK } from './constants'
import type {
  Ability,
  BattleCreature,
  Condition,
  Effect,
  EffectContext,
  EffectResolution,
  SeededRng,
  Stat,
  StatusEffect,
  StatusEffectKind,
  Target,
  Trigger,
} from './types'

// ─── Status Tick Result ─────────────────────────────────────────────

export interface StatusTickResult {
  kind: StatusEffectKind
  damage?: number
  healing?: number
  expired: boolean
  stat?: Stat
}

// ─── Basic Attack ───────────────────────────────────────────────────

export function getBasicAttack(): Ability {
  return BASIC_ATTACK
}

// ─── Cooldown ───────────────────────────────────────────────────────

export function isActiveReady(creature: BattleCreature): boolean {
  return creature.cooldown <= 0
}

// ─── Target Resolution ──────────────────────────────────────────────

export function resolveTarget(
  target: Target,
  caster: BattleCreature,
  ctx: EffectContext,
  rng: SeededRng,
): Array<BattleCreature> {
  const livingEnemies = ctx.allEnemies.filter((e) => e.isAlive)
  const livingAllies = ctx.allAllies.filter((a) => a.isAlive)

  switch (target) {
    case 'self':
      return [caster]

    case 'all_allies':
      return livingAllies

    case 'all_enemies':
      return livingEnemies

    case 'lowest_hp_ally': {
      if (livingAllies.length === 0) return []
      const lowest = livingAllies.reduce((a, b) =>
        a.currentHp / a.maxHp < b.currentHp / b.maxHp ? a : b,
      )
      return [lowest]
    }

    case 'single_enemy': {
      if (livingEnemies.length === 0) return []
      // Check for taunt
      const taunting = livingEnemies.find((e) =>
        e.statusEffects.some((s) => s.kind === 'taunt'),
      )
      if (taunting) return [taunting]
      // Prefer front row
      const frontRow = livingEnemies.filter((e) => e.row === 'front')
      const pool = frontRow.length > 0 ? frontRow : livingEnemies
      // Pick lowest HP% from pool
      const picked = pool.reduce((a, b) =>
        a.currentHp / a.maxHp <= b.currentHp / b.maxHp ? a : b,
      )
      return [picked]
    }

    case 'random_enemy': {
      if (livingEnemies.length === 0) return []
      const idx = rng.nextInt(0, livingEnemies.length - 1)
      return [livingEnemies[idx]]
    }

    case 'attack_target': {
      return ctx.triggerAttackTarget ? [ctx.triggerAttackTarget] : []
    }

    case 'attacker': {
      return ctx.triggerAttacker ? [ctx.triggerAttacker] : []
    }
  }
}

// ─── Condition Evaluation ───────────────────────────────────────────

export function evaluateCondition(
  condition: Condition | undefined,
  owner: BattleCreature,
  ctx: EffectContext,
): boolean {
  if (!condition) return true

  switch (condition.type) {
    case 'in_row':
      return owner.row === condition.row

    case 'target_hp_below': {
      const primary =
        ctx.triggerAttackTarget ??
        (ctx.targets[0] as BattleCreature | undefined)
      if (!primary) return false
      return primary.currentHp < primary.maxHp * (condition.percent / 100)
    }

    case 'per_ally_alive':
    case 'per_dead_ally':
      // These don't gate — they modify magnitude via stack multiplier
      return true
  }
}

export function computeStackMultiplier(
  condition: Condition | undefined,
  owner: BattleCreature,
  ctx: EffectContext,
): number {
  if (!condition) return 1

  switch (condition.type) {
    case 'per_ally_alive':
      return ctx.allAllies.filter((a) => a.id !== owner.id && a.isAlive).length

    case 'per_dead_ally':
      return ctx.allAllies.filter((a) => a.id !== owner.id && !a.isAlive).length

    default:
      return 1
  }
}

function scaleEffect(effect: Effect, multiplier: number): Effect {
  if (multiplier <= 0) return effect
  if (multiplier === 1) return effect
  switch (effect.type) {
    case 'buff':
      return { ...effect, percent: effect.percent * multiplier }
    case 'debuff':
      return { ...effect, percent: effect.percent * multiplier }
    case 'heal':
      return { ...effect, percent: effect.percent * multiplier }
    case 'damage':
      return {
        ...effect,
        multiplier: effect.multiplier * multiplier,
      }
    default:
      return effect
  }
}

// ─── Effect Resolution ──────────────────────────────────────────────

export function resolveEffect(
  effect: Effect,
  caster: BattleCreature,
  target: BattleCreature,
  ctx: EffectContext,
): Array<EffectResolution> {
  switch (effect.type) {
    case 'damage': {
      const result = calculateDamage({
        attacker: caster,
        defender: target,
        effect,
        rng: ctx.rng,
        damageScale: ctx.damageScale,
        defScaling: ctx.defScaling,
      })

      if (result.isDodged) {
        return [{ kind: 'dodged', targetId: target.id }]
      }

      let finalDamage = result.damage
      const resolutions: Array<EffectResolution> = []

      // Shield absorption
      const shieldEffect = target.statusEffects.find((e) => e.kind === 'shield')
      if (shieldEffect && finalDamage > 0) {
        const absorbed = Math.min(finalDamage, shieldEffect.value)
        shieldEffect.value -= absorbed
        finalDamage -= absorbed
        if (shieldEffect.value <= 0) {
          target.statusEffects = target.statusEffects.filter(
            (e) => e !== shieldEffect,
          )
        }
      }

      // Reflect damage
      const reflectEffect = target.statusEffects.find(
        (e) => e.kind === 'reflect',
      )
      if (reflectEffect && finalDamage > 0) {
        const reflectDmg = Math.floor(finalDamage * (reflectEffect.value / 100))
        if (reflectDmg > 0) {
          caster.currentHp = Math.max(0, caster.currentHp - reflectDmg)
          if (caster.currentHp <= 0) caster.isAlive = false
          resolutions.push({
            kind: 'reflect_damage',
            targetId: caster.id,
            sourceId: target.id,
            amount: reflectDmg,
          })
        }
      }

      // Apply damage
      target.currentHp = Math.max(0, target.currentHp - finalDamage)
      if (target.currentHp <= 0) target.isAlive = false

      resolutions.unshift({
        kind: 'damage',
        targetId: target.id,
        amount: finalDamage,
        isCrit: result.isCrit,
        isDodged: false,
      })

      return resolutions
    }

    case 'heal': {
      if (!target.isAlive) return []
      const amount = Math.max(
        1,
        Math.floor(target.maxHp * (effect.percent / 100)),
      )
      target.currentHp = Math.min(target.maxHp, target.currentHp + amount)
      return [
        {
          kind: 'heal',
          targetId: target.id,
          amount,
          newHp: target.currentHp,
        },
      ]
    }

    case 'dot': {
      if (!target.isAlive) return []
      const se: StatusEffect = {
        kind: effect.dotKind,
        sourceCreatureId: caster.id,
        value: effect.percent,
        turnsRemaining: effect.duration,
      }
      target.statusEffects.push(se)
      return [{ kind: 'status_applied', targetId: target.id, effect: se }]
    }

    case 'buff': {
      if (!target.isAlive) return []
      // Replace same-stat buff
      removeExistingStatEffect(target, 'buff', effect.stat)
      applyStatModifier(target, effect.stat, effect.percent)
      const se: StatusEffect = {
        kind: 'buff',
        sourceCreatureId: caster.id,
        value: effect.percent,
        turnsRemaining: effect.duration,
        stat: effect.stat,
      }
      target.statusEffects.push(se)
      return [{ kind: 'status_applied', targetId: target.id, effect: se }]
    }

    case 'debuff': {
      if (!target.isAlive) return []
      // Replace same-stat debuff — undo old modifier first
      removeExistingStatEffect(target, 'debuff', effect.stat)
      applyStatModifier(target, effect.stat, -effect.percent)
      const se: StatusEffect = {
        kind: 'debuff',
        sourceCreatureId: caster.id,
        value: effect.percent,
        turnsRemaining: effect.duration,
        stat: effect.stat,
      }
      target.statusEffects.push(se)
      return [{ kind: 'status_applied', targetId: target.id, effect: se }]
    }

    case 'shield': {
      if (!target.isAlive) return []
      const hp = Math.floor(caster.maxHp * (effect.percent / 100))
      target.statusEffects = target.statusEffects.filter(
        (e) => e.kind !== 'shield',
      )
      const se: StatusEffect = {
        kind: 'shield',
        sourceCreatureId: caster.id,
        value: hp,
        turnsRemaining: effect.duration,
      }
      target.statusEffects.push(se)
      return [{ kind: 'shield_set', targetId: target.id, amount: hp }]
    }

    case 'stun': {
      if (!target.isAlive) return []
      target.isStunned = true
      target.statusEffects = target.statusEffects.filter(
        (e) => e.kind !== 'stun',
      )
      const se: StatusEffect = {
        kind: 'stun',
        sourceCreatureId: caster.id,
        value: 0,
        turnsRemaining: effect.duration,
      }
      target.statusEffects.push(se)
      return [{ kind: 'status_applied', targetId: target.id, effect: se }]
    }

    case 'taunt': {
      // Clear existing taunts on the caster's team
      for (const ally of ctx.allAllies) {
        ally.statusEffects = ally.statusEffects.filter(
          (e) => e.kind !== 'taunt',
        )
      }
      const se: StatusEffect = {
        kind: 'taunt',
        sourceCreatureId: caster.id,
        value: 0,
        turnsRemaining: effect.duration,
      }
      caster.statusEffects.push(se)
      return [{ kind: 'status_applied', targetId: caster.id, effect: se }]
    }

    case 'lifesteal': {
      const dealt = ctx.lastDamageDealt ?? 0
      if (dealt <= 0) return []
      const amount = Math.max(1, Math.floor(dealt * (effect.percent / 100)))
      caster.currentHp = Math.min(caster.maxHp, caster.currentHp + amount)
      return [
        {
          kind: 'heal',
          targetId: caster.id,
          amount,
          newHp: caster.currentHp,
        },
      ]
    }

    case 'reflect': {
      if (!target.isAlive) return []
      target.statusEffects = target.statusEffects.filter(
        (e) => e.kind !== 'reflect',
      )
      const se: StatusEffect = {
        kind: 'reflect',
        sourceCreatureId: caster.id,
        value: effect.percent,
        turnsRemaining: effect.duration,
      }
      target.statusEffects.push(se)
      return [{ kind: 'status_applied', targetId: target.id, effect: se }]
    }

    // 'damage_reduction', 'crit_reduction', 'flat_reduction', 'dodge'
    // are handled by materializeAlwaysPassive(), not resolveEffect()
    default:
      return []
  }
}

// ─── Resolve Full Ability ───────────────────────────────────────────

export function resolveAbilityEffects(
  ability: Ability,
  targets: Array<BattleCreature>,
  ctx: EffectContext,
): Array<EffectResolution> {
  const allResolutions: Array<EffectResolution> = []

  for (const target of targets) {
    let lastDamageDealt = 0
    let targetKilled = false

    for (const effect of ability.effects) {
      // Skip secondary effects on KO'd target (but not lifesteal — it heals caster)
      if (targetKilled && effect.type !== 'lifesteal') continue

      const effectCtx: EffectContext = { ...ctx, lastDamageDealt }
      const resolutions = resolveEffect(effect, ctx.caster, target, effectCtx)
      allResolutions.push(...resolutions)

      for (const res of resolutions) {
        if (res.kind === 'damage') {
          lastDamageDealt = res.amount
          if (!target.isAlive) targetKilled = true
        }
      }
    }
  }

  return allResolutions
}

// ─── Fire Trigger ───────────────────────────────────────────────────

export function fireTrigger(
  eventType: Trigger['type'],
  owner: BattleCreature,
  ctx: EffectContext,
): Array<EffectResolution> {
  const passive = owner.passive as typeof owner.passive | undefined
  if (!passive || passive.effects.length === 0) return []

  // Match trigger type
  if (passive.trigger.type !== eventType) return []

  // For onBattleStart, check the trigger's own condition
  if (passive.trigger.type === 'onBattleStart' && passive.trigger.condition) {
    if (!evaluateCondition(passive.trigger.condition, owner, ctx)) return []
  }

  // Check the ability-level condition
  if (!evaluateCondition(passive.condition, owner, ctx)) return []

  const stackMultiplier = computeStackMultiplier(passive.condition, owner, ctx)

  const resolvedTargets = resolveTarget(passive.target, owner, ctx, ctx.rng)
  const allResolutions: Array<EffectResolution> = []

  for (const target of resolvedTargets) {
    for (const effect of passive.effects) {
      const scaledEffect = scaleEffect(effect, stackMultiplier)
      const resolutions = resolveEffect(scaledEffect, owner, target, ctx)
      allResolutions.push(...resolutions)
    }
  }

  return allResolutions
}

// ─── Materialize Always Passives ────────────────────────────────────
// Called at battle start and each turn for dynamic passives.
// Writes permanent passive values into BattleCreature flat fields.

export function materializeAlwaysPassive(
  creature: BattleCreature,
  allies: Array<BattleCreature>,
): void {
  const passive = creature.passive
  if (passive.trigger.type !== 'always') return

  // Reset materialized fields
  creature.damageReductionPercent = 0
  creature.critReductionPercent = 0
  creature.flatReductionDefPercent = 0
  creature.dodgeBasePercent = 0

  for (const effect of passive.effects) {
    switch (effect.type) {
      case 'damage_reduction':
        creature.damageReductionPercent = effect.percent
        break
      case 'crit_reduction':
        creature.critReductionPercent = effect.percent
        break
      case 'flat_reduction':
        creature.flatReductionDefPercent = effect.scalingPercent
        break
      case 'dodge':
        creature.dodgeBasePercent = effect.basePercent
        break
    }
  }

  // Dynamic: pack_hunter scales with living allies (per_ally_alive)
  if (passive.condition?.type === 'per_ally_alive') {
    const liveAllyCount = allies.filter(
      (a) => a.id !== creature.id && a.isAlive,
    ).length
    // Use a tracking key to compute deltas
    const prevCount = (creature as any).__passiveAllyCount ?? 0
    if (liveAllyCount !== prevCount) {
      for (const effect of passive.effects) {
        if (effect.type === 'buff') {
          const prevBonus = Math.floor(
            creature.baseStats[effect.stat as keyof typeof creature.baseStats] *
              ((effect.percent * prevCount) / 100),
          )
          const newBonus = Math.floor(
            creature.baseStats[effect.stat as keyof typeof creature.baseStats] *
              ((effect.percent * liveAllyCount) / 100),
          )
          const stat = effect.stat
          if (stat === 'atk') creature.atk += newBonus - prevBonus
          else if (stat === 'def') creature.def += newBonus - prevBonus
          else creature.spd += newBonus - prevBonus
        }
      }
      ;(creature as any).__passiveAllyCount = liveAllyCount
    }
  }

  // Dynamic: per_dead_ally (ancient_resilience pattern, reserved for future)
  if (passive.condition?.type === 'per_dead_ally') {
    const deadCount = allies.filter(
      (a) => a.id !== creature.id && !a.isAlive,
    ).length
    const prevCount = (creature as any).__passiveDeadCount ?? 0
    if (deadCount !== prevCount) {
      for (const effect of passive.effects) {
        if (effect.type === 'buff') {
          const prevBonus = Math.floor(
            creature.baseStats[effect.stat as keyof typeof creature.baseStats] *
              ((effect.percent * prevCount) / 100),
          )
          const newBonus = Math.floor(
            creature.baseStats[effect.stat as keyof typeof creature.baseStats] *
              ((effect.percent * deadCount) / 100),
          )
          const stat = effect.stat
          if (stat === 'atk') creature.atk += newBonus - prevBonus
          else if (stat === 'def') creature.def += newBonus - prevBonus
          else creature.spd += newBonus - prevBonus
        }
      }
      ;(creature as any).__passiveDeadCount = deadCount
    }
  }
}

// ─── Status Effect Tick ─────────────────────────────────────────────

export function tickStatusEffects(
  creature: BattleCreature,
): Array<StatusTickResult> {
  const results: Array<StatusTickResult> = []
  const toRemove: Array<StatusEffect> = []

  for (const effect of creature.statusEffects) {
    switch (effect.kind) {
      case 'poison':
      case 'bleed': {
        const tickDmg = Math.max(
          1,
          Math.floor(creature.maxHp * (effect.value / 100)),
        )
        creature.currentHp = Math.max(0, creature.currentHp - tickDmg)
        if (creature.currentHp <= 0) creature.isAlive = false
        effect.turnsRemaining--
        const expired = effect.turnsRemaining <= 0
        if (expired) toRemove.push(effect)
        results.push({ kind: effect.kind, damage: tickDmg, expired })
        break
      }

      case 'hot': {
        const healAmount = Math.max(
          1,
          Math.floor(creature.maxHp * (effect.value / 100)),
        )
        creature.currentHp = Math.min(
          creature.maxHp,
          creature.currentHp + healAmount,
        )
        effect.turnsRemaining--
        const expired = effect.turnsRemaining <= 0
        if (expired) toRemove.push(effect)
        results.push({ kind: 'hot', healing: healAmount, expired })
        break
      }

      case 'buff':
      case 'debuff': {
        effect.turnsRemaining--
        if (effect.turnsRemaining <= 0) {
          if (effect.stat) {
            if (effect.kind === 'buff') {
              removeStatModifier(creature, effect.stat, effect.value)
            } else {
              // Debuff: undo the negative modifier
              removeStatModifier(creature, effect.stat, -effect.value)
            }
          }
          toRemove.push(effect)
          results.push({
            kind: effect.kind,
            expired: true,
            stat: effect.stat,
          })
        }
        break
      }

      case 'shield': {
        effect.turnsRemaining--
        if (effect.turnsRemaining <= 0) {
          toRemove.push(effect)
          results.push({ kind: 'shield', expired: true })
        }
        break
      }

      case 'stun':
        // Stun is consumed when creature skips turn, handled in engine
        break

      case 'taunt': {
        effect.turnsRemaining--
        if (effect.turnsRemaining <= 0) {
          toRemove.push(effect)
          results.push({ kind: 'taunt', expired: true })
        }
        break
      }

      case 'reflect': {
        effect.turnsRemaining--
        if (effect.turnsRemaining <= 0) {
          toRemove.push(effect)
          results.push({ kind: 'reflect', expired: true })
        }
        break
      }
    }
  }

  creature.statusEffects = creature.statusEffects.filter(
    (e) => !toRemove.includes(e),
  )

  return results
}

// ─── Stat Modifier Helpers ──────────────────────────────────────────

function applyStatModifier(
  creature: BattleCreature,
  stat: Stat,
  percentValue: number,
): void {
  const base = creature.baseStats[stat as keyof typeof creature.baseStats]
  const amount = Math.floor(base * (percentValue / 100))
  switch (stat) {
    case 'atk':
      creature.atk += amount
      break
    case 'def':
      creature.def += amount
      break
    case 'spd':
      creature.spd += amount
      break
  }
}

function removeStatModifier(
  creature: BattleCreature,
  stat: Stat,
  percentValue: number,
): void {
  applyStatModifier(creature, stat, -percentValue)
}

function removeExistingStatEffect(
  creature: BattleCreature,
  kind: 'buff' | 'debuff',
  stat: Stat,
): void {
  const existing = creature.statusEffects.find(
    (e) => e.kind === kind && e.stat === stat,
  )
  if (existing) {
    if (kind === 'buff') {
      removeStatModifier(creature, stat, existing.value)
    } else {
      // Debuff: undo the negative modifier
      removeStatModifier(creature, stat, -existing.value)
    }
    creature.statusEffects = creature.statusEffects.filter(
      (e) => e !== existing,
    )
  }
}
