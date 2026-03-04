import { calculateDamage, getDietModifier } from './damage'
import type {
  AbilityResolution,
  BattleCreature,
  ResolvedAbility,
  SeededRng,
  StatusEffect,
  StatusTickResult,
} from './types'

// ─── Basic Attack ──────────────────────────────────────────────────

export function getBasicAttack(): ResolvedAbility {
  return {
    templateId: 'basic_attack',
    displayName: 'Basic Attack',
    slot: 'active1',
    type: 'active',
    category: 'damage',
    target: 'single_enemy',
    multiplier: 1.0,
    cooldown: 0,
    duration: null,
    statAffected: null,
    effectValue: null,
  }
}

// ─── Cooldown Helpers ──────────────────────────────────────────────

export function isAbilityReady(
  creature: BattleCreature,
  ability: ResolvedAbility,
): boolean {
  if (ability.templateId === 'basic_attack') return true
  return (creature.cooldowns[ability.templateId] ?? 0) <= 0
}

export function decrementCooldowns(creature: BattleCreature): void {
  for (const key of Object.keys(creature.cooldowns)) {
    if (creature.cooldowns[key] > 0) {
      creature.cooldowns[key]--
    }
  }
}

function putOnCooldown(
  creature: BattleCreature,
  ability: ResolvedAbility,
): void {
  if (ability.cooldown && ability.cooldown > 0) {
    creature.cooldowns[ability.templateId] = ability.cooldown
  }
}

// ─── Ability Resolution ────────────────────────────────────────────

export function resolveAbility({
  caster,
  ability,
  targets,
  allAllies,
  allEnemies,
  rng,
  turn,
}: {
  caster: BattleCreature
  ability: ResolvedAbility
  targets: BattleCreature[]
  allAllies: BattleCreature[]
  allEnemies: BattleCreature[]
  rng: SeededRng
  turn: number
}): AbilityResolution[] {
  putOnCooldown(caster, ability)
  const results: AbilityResolution[] = []

  switch (ability.category) {
    case 'damage':
    case 'aoe_damage':
      resolveDamage(caster, ability, targets, rng, results)
      break
    case 'buff':
      resolveBuff(caster, ability, targets, turn, results)
      break
    case 'debuff':
      resolveDebuff(caster, ability, targets, turn, results)
      break
    case 'heal':
      resolveHeal(caster, ability, targets, allAllies, results)
      break
    case 'shield':
      resolveShield(caster, ability, targets, results)
      break
    case 'stun':
      resolveStun(caster, ability, targets, rng, results)
      break
    case 'dot':
      resolveDot(caster, ability, targets, rng, results)
      break
    case 'taunt':
      resolveTaunt(caster, ability, allAllies, results)
      break
  }

  return results
}

// ─── Category Resolvers ────────────────────────────────────────────

function resolveDamage(
  caster: BattleCreature,
  ability: ResolvedAbility,
  targets: BattleCreature[],
  rng: SeededRng,
  results: AbilityResolution[],
): void {
  for (const target of targets) {
    const dmgResult = calculateDamage({
      attacker: caster,
      defender: target,
      ability,
      rng,
    })

    let finalDamage = dmgResult.damage
    let reflectDmg: number | undefined

    if (!dmgResult.isDodged) {
      // Shield absorption
      const shieldEffect = target.statusEffects.find(
        (e) => e.kind === 'shield',
      )
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
      if (target.reflectDamagePercent > 0 && finalDamage > 0) {
        reflectDmg = Math.floor(
          finalDamage * (target.reflectDamagePercent / 100),
        )
        caster.currentHp = Math.max(0, caster.currentHp - reflectDmg)
        if (caster.currentHp <= 0) caster.isAlive = false
      }

      // Apply damage
      target.currentHp = Math.max(0, target.currentHp - finalDamage)
      if (target.currentHp <= 0) target.isAlive = false

      // Lifesteal
      if (
        ability.statAffected === 'lifesteal' &&
        ability.effectValue &&
        finalDamage > 0
      ) {
        const healAmount = Math.floor(
          finalDamage * (ability.effectValue / 100),
        )
        caster.currentHp = Math.min(
          caster.maxHp,
          caster.currentHp + healAmount,
        )
      }

      // Stun chance (body_slam)
      if (
        ability.statAffected === 'stun_chance' &&
        ability.effectValue &&
        target.isAlive
      ) {
        const stunRoll = rng.next()
        if (stunRoll < ability.effectValue / 100) {
          // Check apex_predator immunity
          if (target.passive.templateId !== 'apex_predator') {
            applyStun(caster, target)
          }
        }
      }

      // Poison on hit (venom_strike)
      if (
        ability.statAffected === 'poison' &&
        ability.effectValue &&
        ability.duration &&
        target.isAlive
      ) {
        applyDotEffect(
          caster,
          target,
          'poison',
          ability.effectValue,
          ability.duration,
        )
      }

      // Constrict slow
      if (
        ability.templateId === 'constrict' &&
        ability.duration &&
        target.isAlive
      ) {
        applyStatDebuff(
          caster,
          target,
          'spd',
          ability.effectValue ?? -20,
          ability.duration,
        )
      }

      // Venomous passive: basic attacks apply poison
      if (
        ability.templateId === 'basic_attack' &&
        caster.passive.templateId === 'venomous' &&
        target.isAlive
      ) {
        applyDotEffect(
          caster,
          target,
          'poison',
          caster.passive.effectValue ?? 3,
          caster.passive.duration ?? 2,
        )
      }
    }

    results.push({
      targetId: target.id,
      damage: dmgResult.isDodged ? 0 : finalDamage,
      isCrit: dmgResult.isCrit,
      isDodged: dmgResult.isDodged,
      isDietBonus: dmgResult.isDietBonus,
      reflectDamage: reflectDmg,
    })
  }
}

function resolveBuff(
  caster: BattleCreature,
  ability: ResolvedAbility,
  targets: BattleCreature[],
  turn: number,
  results: AbilityResolution[],
): void {
  // Handle reflect as a special case
  if (ability.statAffected === 'reflect') {
    for (const target of targets) {
      target.reflectDamagePercent = ability.effectValue ?? 0
      const effect: StatusEffect = {
        kind: 'reflect',
        sourceCreatureId: caster.id,
        value: ability.effectValue ?? 0,
        turnsRemaining: ability.duration ?? 1,
      }
      target.statusEffects.push(effect)
      results.push({
        targetId: target.id,
        statusApplied: effect,
      })
    }
    return
  }

  const stats = (ability.statAffected ?? '').split(',')
  const duration = ability.duration ?? 2
  const value = ability.effectValue ?? 0

  for (const target of targets) {
    for (const stat of stats) {
      const trimmed = stat.trim()
      // Same-stat buff replaces previous
      target.statusEffects = target.statusEffects.filter(
        (e) => !(e.kind === 'buff' && e.stat === trimmed),
      )

      const effect: StatusEffect = {
        kind: 'buff',
        sourceCreatureId: caster.id,
        stat: trimmed,
        value,
        turnsRemaining: duration,
      }
      target.statusEffects.push(effect)
      applyStatModifier(target, trimmed, value)

      results.push({
        targetId: target.id,
        statusApplied: effect,
      })
    }
  }
}

function resolveDebuff(
  caster: BattleCreature,
  ability: ResolvedAbility,
  targets: BattleCreature[],
  turn: number,
  results: AbilityResolution[],
): void {
  const stats = (ability.statAffected ?? '').split(',')
  const duration = ability.duration ?? 2
  const value = ability.effectValue ?? 0

  for (const target of targets) {
    // thermal_regulation: immune to debuffs for first N turns
    if (target.passive.templateId === 'thermal_regulation') {
      const immuneTurns = target.passive.duration ?? 2
      if (turn <= immuneTurns) continue
    }

    for (const stat of stats) {
      const trimmed = stat.trim()
      // Same-stat debuff replaces previous — undo old modifier first
      const existing = target.statusEffects.find(
        (e) => e.kind === 'debuff' && e.stat === trimmed,
      )
      if (existing) {
        removeStatModifier(target, trimmed, existing.value)
        target.statusEffects = target.statusEffects.filter(
          (e) => e !== existing,
        )
      }

      const effect: StatusEffect = {
        kind: 'debuff',
        sourceCreatureId: caster.id,
        stat: trimmed,
        value,
        turnsRemaining: duration,
      }
      target.statusEffects.push(effect)
      applyStatModifier(target, trimmed, value)

      results.push({
        targetId: target.id,
        statusApplied: effect,
      })
    }
  }
}

function resolveHeal(
  caster: BattleCreature,
  ability: ResolvedAbility,
  targets: BattleCreature[],
  allAllies: BattleCreature[],
  results: AbilityResolution[],
): void {
  const pct = ability.effectValue ?? 0

  // Handle HoT (regenerate)
  if (ability.statAffected === 'hot') {
    for (const target of targets) {
      const effect: StatusEffect = {
        kind: 'hot',
        sourceCreatureId: caster.id,
        value: pct,
        turnsRemaining: ability.duration ?? 3,
      }
      // Replace existing HoT
      target.statusEffects = target.statusEffects.filter(
        (e) => e.kind !== 'hot',
      )
      target.statusEffects.push(effect)
      results.push({ targetId: target.id, statusApplied: effect })
    }
    return
  }

  // Mend: targets lowest HP ally specifically
  if (ability.templateId === 'mend') {
    const livingAllies = allAllies.filter((a) => a.isAlive)
    if (livingAllies.length === 0) return
    const lowestHpAlly = livingAllies.reduce((a, b) =>
      a.currentHp / a.maxHp < b.currentHp / b.maxHp ? a : b,
    )
    const healAmount = Math.floor(lowestHpAlly.maxHp * (pct / 100))
    lowestHpAlly.currentHp = Math.min(
      lowestHpAlly.maxHp,
      lowestHpAlly.currentHp + healAmount,
    )
    results.push({
      targetId: lowestHpAlly.id,
      healing: healAmount,
    })
    return
  }

  for (const target of targets) {
    if (!target.isAlive) continue
    const healAmount = Math.floor(target.maxHp * (pct / 100))
    target.currentHp = Math.min(
      target.maxHp,
      target.currentHp + healAmount,
    )
    results.push({
      targetId: target.id,
      healing: healAmount,
    })
  }
}

function resolveShield(
  caster: BattleCreature,
  ability: ResolvedAbility,
  targets: BattleCreature[],
  results: AbilityResolution[],
): void {
  const pct = ability.effectValue ?? 0
  for (const target of targets) {
    const shieldHp = Math.floor(target.maxHp * (pct / 100))
    // Remove existing shield
    target.statusEffects = target.statusEffects.filter(
      (e) => e.kind !== 'shield',
    )
    const effect: StatusEffect = {
      kind: 'shield',
      sourceCreatureId: caster.id,
      value: shieldHp,
      turnsRemaining: ability.duration ?? 2,
    }
    target.statusEffects.push(effect)
    results.push({
      targetId: target.id,
      shieldAmount: shieldHp,
      statusApplied: effect,
    })
  }
}

function resolveStun(
  caster: BattleCreature,
  ability: ResolvedAbility,
  targets: BattleCreature[],
  rng: SeededRng,
  results: AbilityResolution[],
): void {
  for (const target of targets) {
    // Headbutt does damage + guaranteed stun
    if (ability.multiplier && ability.multiplier > 0) {
      const dmgResult = calculateDamage({
        attacker: caster,
        defender: target,
        ability,
        rng,
      })
      if (!dmgResult.isDodged) {
        target.currentHp = Math.max(0, target.currentHp - dmgResult.damage)
        if (target.currentHp <= 0) target.isAlive = false
      }
      results.push({
        targetId: target.id,
        damage: dmgResult.isDodged ? 0 : dmgResult.damage,
        isCrit: dmgResult.isCrit,
        isDodged: dmgResult.isDodged,
      })
    }

    if (target.isAlive) {
      // apex_predator: immune to stun
      if (target.passive.templateId === 'apex_predator') {
        continue
      }
      const stunEffect = applyStun(caster, target)
      results.push({
        targetId: target.id,
        statusApplied: stunEffect,
      })
    }
  }
}

function resolveDot(
  caster: BattleCreature,
  ability: ResolvedAbility,
  targets: BattleCreature[],
  rng: SeededRng,
  results: AbilityResolution[],
): void {
  for (const target of targets) {
    // Bleed does initial damage + DoT
    if (ability.multiplier && ability.multiplier > 0) {
      const dmgResult = calculateDamage({
        attacker: caster,
        defender: target,
        ability,
        rng,
      })
      if (!dmgResult.isDodged) {
        target.currentHp = Math.max(0, target.currentHp - dmgResult.damage)
        if (target.currentHp <= 0) target.isAlive = false
      }
      results.push({
        targetId: target.id,
        damage: dmgResult.isDodged ? 0 : dmgResult.damage,
        isCrit: dmgResult.isCrit,
        isDodged: dmgResult.isDodged,
      })
    }

    if (target.isAlive && ability.statAffected && ability.effectValue) {
      const dotKind =
        ability.statAffected === 'bleed' ? 'bleed' : 'poison'
      const effect = applyDotEffect(
        caster,
        target,
        dotKind,
        ability.effectValue,
        ability.duration ?? 3,
      )
      results.push({
        targetId: target.id,
        statusApplied: effect,
      })
    }
  }
}

function resolveTaunt(
  caster: BattleCreature,
  ability: ResolvedAbility,
  allAllies: BattleCreature[],
  results: AbilityResolution[],
): void {
  // Remove existing taunts from allies
  for (const ally of allAllies) {
    ally.statusEffects = ally.statusEffects.filter(
      (e) => e.kind !== 'taunt',
    )
  }
  const effect: StatusEffect = {
    kind: 'taunt',
    sourceCreatureId: caster.id,
    value: 0,
    turnsRemaining: ability.duration ?? 2,
  }
  caster.statusEffects.push(effect)
  results.push({
    targetId: caster.id,
    statusApplied: effect,
  })
}

// ─── Status Effect Helpers ─────────────────────────────────────────

function applyStun(
  caster: BattleCreature,
  target: BattleCreature,
): StatusEffect {
  target.isStunned = true
  // Remove existing stun and add fresh
  target.statusEffects = target.statusEffects.filter(
    (e) => e.kind !== 'stun',
  )
  const effect: StatusEffect = {
    kind: 'stun',
    sourceCreatureId: caster.id,
    value: 0,
    turnsRemaining: 1,
  }
  target.statusEffects.push(effect)
  return effect
}

function applyDotEffect(
  caster: BattleCreature,
  target: BattleCreature,
  kind: 'poison' | 'bleed',
  pctPerTurn: number,
  duration: number,
): StatusEffect {
  // Stack DoTs — multiple sources can apply
  const effect: StatusEffect = {
    kind,
    sourceCreatureId: caster.id,
    value: pctPerTurn,
    turnsRemaining: duration,
  }
  target.statusEffects.push(effect)
  return effect
}

function applyStatDebuff(
  caster: BattleCreature,
  target: BattleCreature,
  stat: string,
  value: number,
  duration: number,
): void {
  // Same-stat debuff replaces
  const existing = target.statusEffects.find(
    (e) => e.kind === 'debuff' && e.stat === stat,
  )
  if (existing) {
    removeStatModifier(target, stat, existing.value)
    target.statusEffects = target.statusEffects.filter(
      (e) => e !== existing,
    )
  }
  target.statusEffects.push({
    kind: 'debuff',
    sourceCreatureId: caster.id,
    stat,
    value,
    turnsRemaining: duration,
  })
  applyStatModifier(target, stat, value)
}

function applyStatModifier(
  creature: BattleCreature,
  stat: string,
  percentValue: number,
): void {
  const amount = Math.floor(
    creature.baseStats[stat as keyof typeof creature.baseStats] *
      (percentValue / 100),
  )
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
    case 'abl':
      creature.abl += amount
      break
  }
}

function removeStatModifier(
  creature: BattleCreature,
  stat: string,
  percentValue: number,
): void {
  applyStatModifier(creature, stat, -percentValue)
}

// ─── Status Effect Tick ────────────────────────────────────────────

export function tickStatusEffects(
  creature: BattleCreature,
  _turn: number,
): StatusTickResult[] {
  const results: StatusTickResult[] = []
  const toRemove: StatusEffect[] = []

  for (const effect of creature.statusEffects) {
    switch (effect.kind) {
      case 'poison':
      case 'bleed': {
        // Tick damage: % of max HP, ignores DEF
        const tickDmg = Math.max(
          1,
          Math.floor(creature.maxHp * (effect.value / 100)),
        )
        creature.currentHp = Math.max(0, creature.currentHp - tickDmg)
        if (creature.currentHp <= 0) creature.isAlive = false

        effect.turnsRemaining--
        const expired = effect.turnsRemaining <= 0
        if (expired) toRemove.push(effect)

        results.push({
          kind: effect.kind,
          damage: tickDmg,
          expired,
        })
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
        // Buffs/debuffs decrement when affected creature acts
        // (called at end of creature's turn)
        effect.turnsRemaining--
        if (effect.turnsRemaining <= 0) {
          // Remove stat modifier
          if (effect.stat) {
            if (effect.kind === 'buff') {
              removeStatModifier(creature, effect.stat, effect.value)
            } else {
              removeStatModifier(creature, effect.stat, effect.value)
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

      case 'stun': {
        // Stun is consumed when the creature skips its turn
        // It's handled in the engine turn loop, not here
        break
      }

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
          creature.reflectDamagePercent = 0
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
