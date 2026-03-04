import type {
  BattleCreature,
  DamageCalcResult,
  ResolvedAbility,
  SeededRng,
} from './types'

// ─── Diet Effectiveness ────────────────────────────────────────────

const DIET_ADVANTAGE: Record<string, string[]> = {
  Carnivorous: ['Herbivorous', 'Herbivorous/omnivorous'],
  Herbivorous: ['Omnivorous'],
  'Herbivorous/omnivorous': ['Omnivorous'],
  Omnivorous: ['Carnivorous'],
  Piscivorous: ['Carnivorous'],
}

export function getDietModifier(
  attackerDiet: string,
  defenderDiet: string,
): number {
  const advantages = DIET_ADVANTAGE[attackerDiet]
  if (advantages && advantages.includes(defenderDiet)) return 1.15
  // Check reverse for disadvantage
  const defAdvantages = DIET_ADVANTAGE[defenderDiet]
  if (defAdvantages && defAdvantages.includes(attackerDiet)) return 0.85
  return 1.0
}

// ─── Damage Calculation ────────────────────────────────────────────

export function calculateDamage({
  attacker,
  defender,
  ability,
  rng,
}: {
  attacker: BattleCreature
  defender: BattleCreature
  ability: ResolvedAbility
  rng: SeededRng
}): DamageCalcResult {
  const multiplier = ability.multiplier ?? 1.0
  const isAblScaling = ability.statAffected === 'abl_scaling'
  const stat = isAblScaling ? attacker.abl : attacker.atk

  // Predator instinct: +20% ATK vs targets below 50% HP
  let effectiveStat = stat
  if (
    !isAblScaling &&
    attacker.passive.templateId === 'predator_instinct' &&
    defender.currentHp < defender.maxHp * 0.5
  ) {
    effectiveStat = Math.floor(stat * 1.2)
  }

  let rawDamage = effectiveStat * multiplier

  // Crit check: 10% chance, 1.5x multiplier (before mitigation)
  const critRoll = rng.next()
  let isCrit = critRoll < 0.1

  if (isCrit) {
    let critMultiplier = 1.5
    // Armored plates: halves crit bonus (1.5x → 1.25x)
    if (defender.passive.templateId === 'armored_plates') {
      critMultiplier = 1.25
    }
    rawDamage *= critMultiplier
  }

  // Defense mitigation (dive_attack ignores DEF)
  const ignoreDef = ability.statAffected === 'ignore_def'
  if (!ignoreDef) {
    rawDamage = rawDamage * (100 / (100 + defender.def))
  }

  // ±10% variance
  const variance = rng.nextFloat(0.9, 1.1)
  rawDamage *= variance

  // Thick hide passive: -15% damage taken
  if (defender.passive.templateId === 'thick_hide') {
    rawDamage *= 0.85
  }

  // Diet modifier
  const dietMod = getDietModifier(attacker.diet, defender.diet)
  rawDamage *= dietMod
  const isDietBonus = dietMod !== 1.0

  // Ambush: +0.3x when attacker is in back row
  if (
    ability.statAffected === 'back_row_bonus' &&
    attacker.row === 'back'
  ) {
    rawDamage *= 1 + (ability.effectValue ?? 0.3)
  }

  // Floor, minimum 1
  let finalDamage = Math.max(1, Math.floor(rawDamage))

  // Evasive dodge check: 15% chance
  let isDodged = false
  if (defender.passive.templateId === 'evasive') {
    const dodgeRoll = rng.next()
    if (dodgeRoll < (defender.passive.effectValue ?? 15) / 100) {
      isDodged = true
      finalDamage = 0
      isCrit = false
    }
  }

  return {
    damage: finalDamage,
    isCrit,
    isDodged,
    isDietBonus,
    rawDamage: Math.max(1, Math.floor(rawDamage)),
  }
}
