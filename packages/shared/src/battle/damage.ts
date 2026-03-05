import type {
  BattleCreature,
  DamageCalcResult,
  Effect,
  SeededRng,
} from './types'
import { COMBAT_DAMAGE_SCALE } from './constants'

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
  const defAdvantages = DIET_ADVANTAGE[defenderDiet]
  if (defAdvantages && defAdvantages.includes(attackerDiet)) return 0.85
  return 1.0
}

// ─── Damage Calculation ────────────────────────────────────────────

export function calculateDamage({
  attacker,
  defender,
  effect,
  rng,
}: {
  attacker: BattleCreature
  defender: BattleCreature
  effect: Effect & { type: 'damage' }
  rng: SeededRng
}): DamageCalcResult {
  const stat =
    effect.scaling === 'def' ? attacker.def : attacker.atk

  let rawDamage = stat * effect.multiplier

  // Crit check: 10% chance, 1.5x multiplier
  const critRoll = rng.next()
  let isCrit = critRoll < 0.1

  if (isCrit) {
    // Crit reduction from Armored Plates passive
    const critBonus = 0.5 * (1 - defender.critReductionPercent / 100)
    rawDamage *= 1 + critBonus
  }

  // DEF mitigation: 100 / (100 + DEF)
  rawDamage = rawDamage * (100 / (100 + defender.def))

  // Variance: +/- 10%
  rawDamage *= rng.nextFloat(0.9, 1.1)

  // Damage reduction passive (Thick Hide)
  if (defender.damageReductionPercent > 0) {
    rawDamage *= 1 - defender.damageReductionPercent / 100
  }

  // Flat reduction passive (Ironclad) — % of DEF as flat reduction
  if (defender.flatReductionDefPercent > 0) {
    const flatReduction = Math.floor(
      defender.def * (defender.flatReductionDefPercent / 100),
    )
    rawDamage = Math.max(1, rawDamage - flatReduction)
  }

  // Diet modifier
  const dietMod = getDietModifier(attacker.diet, defender.diet)
  rawDamage *= dietMod
  const isDietBonus = dietMod !== 1.0

  // Global damage scaling
  rawDamage *= COMBAT_DAMAGE_SCALE

  // Floor, minimum 1
  let finalDamage = Math.max(1, Math.floor(rawDamage))

  // Dodge check (Evasive passive) — scales with SPD ratio
  let isDodged = false
  if (defender.dodgeBasePercent > 0) {
    const baseDodge = defender.dodgeBasePercent / 100
    const spdRatio =
      attacker.spd > 0 ? defender.spd / attacker.spd : 1
    const dodgeChance = Math.min(
      0.4,
      Math.max(0.03, baseDodge * spdRatio),
    )
    if (rng.next() < dodgeChance) {
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
  }
}
