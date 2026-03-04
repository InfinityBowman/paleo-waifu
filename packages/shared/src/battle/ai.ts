import { getBasicAttack, isAbilityReady } from './abilities'
import type {
  BattleCreature,
  ResolvedAbility,
  SeededRng,
  SelectedAction,
} from './types'

// ─── Target Selection ──────────────────────────────────────────────

export function selectTarget({
  enemies,
  targetType,
  rng,
}: {
  enemies: BattleCreature[]
  targetType: 'single_enemy' | 'all_enemies' | 'random_enemy'
  rng: SeededRng
}): BattleCreature[] {
  const living = enemies.filter((e) => e.isAlive)
  if (living.length === 0) return []

  if (targetType === 'all_enemies') return living

  // Check for taunt — overrides normal targeting
  const taunting = living.find((e) =>
    e.statusEffects.some((s) => s.kind === 'taunt'),
  )
  if (taunting) return [taunting]

  if (targetType === 'random_enemy') {
    const idx = rng.nextInt(0, living.length - 1)
    return [living[idx]]
  }

  // single_enemy: prefer front row, apply camouflage
  const frontRow = living.filter((e) => e.row === 'front')
  const pool = frontRow.length > 0 ? frontRow : living

  // Apply camouflage: 25% chance to skip each candidate (can't skip all)
  const candidates: BattleCreature[] = []
  for (const enemy of pool) {
    if (enemy.passive.templateId === 'camouflage') {
      const camoRoll = rng.next()
      if (camoRoll < (enemy.passive.effectValue ?? 25) / 100) {
        continue // skipped by camo
      }
    }
    candidates.push(enemy)
  }

  // Can't whiff completely — fall back to original pool
  const finalPool = candidates.length > 0 ? candidates : pool

  // Pick lowest HP% target from pool
  const target = finalPool.reduce((a, b) =>
    a.currentHp / a.maxHp <= b.currentHp / b.maxHp ? a : b,
  )
  return [target]
}

// ─── Action Selection (9-step priority) ────────────────────────────

export function selectAction({
  actor,
  allies,
  enemies,
  rng,
}: {
  actor: BattleCreature
  allies: BattleCreature[]
  enemies: BattleCreature[]
  rng: SeededRng
}): SelectedAction {
  const abilities = [actor.active1, actor.active2]
  const livingEnemies = enemies.filter((e) => e.isAlive)
  const livingAllies = allies.filter((a) => a.isAlive)

  // 1. Heal available AND self HP < 30%
  if (actor.currentHp < actor.maxHp * 0.3) {
    const heal = findReady(actor, abilities, 'heal')
    if (heal) {
      const targets = resolveTargets(heal, actor, livingAllies, livingEnemies, rng)
      return { ability: heal, targets }
    }
  }

  // 2. Shield available AND no active shield
  const hasShield = actor.statusEffects.some((e) => e.kind === 'shield')
  if (!hasShield) {
    const shield = findReady(actor, abilities, 'shield')
    if (shield) {
      const targets = resolveTargets(shield, actor, livingAllies, livingEnemies, rng)
      return { ability: shield, targets }
    }
  }

  // 3. Buff available AND no active buff for that stat on team
  const buff = findReady(actor, abilities, 'buff')
  if (buff && buff.statAffected) {
    const stats = buff.statAffected.split(',').map((s) => s.trim())
    const teamHasBuff = stats.every((stat) =>
      livingAllies.some((a) =>
        a.statusEffects.some(
          (e) => e.kind === 'buff' && e.stat === stat,
        ),
      ),
    )
    if (!teamHasBuff) {
      const targets = resolveTargets(buff, actor, livingAllies, livingEnemies, rng)
      return { ability: buff, targets }
    }
  }

  // 4. Enemy < 20% HP AND single-target damage ready
  const lowEnemy = livingEnemies.find(
    (e) => e.currentHp < e.maxHp * 0.2,
  )
  if (lowEnemy) {
    const finisher = findReadyDamage(actor, abilities, 'single')
    if (finisher) {
      return { ability: finisher, targets: [lowEnemy] }
    }
  }

  // 5. AoE available AND 2+ enemies
  if (livingEnemies.length >= 2) {
    const aoe = findReady(actor, abilities, 'aoe_damage')
    if (aoe) {
      return { ability: aoe, targets: livingEnemies }
    }
  }

  // 6. Debuff available AND strongest enemy has no debuff for that stat
  const debuff = findReady(actor, abilities, 'debuff')
  if (debuff && debuff.statAffected) {
    const strongest = livingEnemies.reduce((a, b) =>
      a.atk >= b.atk ? a : b,
    )
    const stats = debuff.statAffected.split(',').map((s) => s.trim())
    const hasDebuff = stats.some((stat) =>
      strongest.statusEffects.some(
        (e) => e.kind === 'debuff' && e.stat === stat,
      ),
    )
    if (!hasDebuff) {
      const targets =
        debuff.target === 'all_enemies'
          ? livingEnemies
          : [strongest]
      return { ability: debuff, targets }
    }
  }

  // 7. Stun available AND strongest enemy not stunned (and no apex_predator)
  const stun = findReady(actor, abilities, 'stun')
  if (stun && livingEnemies.length > 0) {
    const strongest = livingEnemies.reduce((a, b) =>
      a.atk >= b.atk ? a : b,
    )
    if (
      !strongest.isStunned &&
      strongest.passive.templateId !== 'apex_predator'
    ) {
      return { ability: stun, targets: [strongest] }
    }
  }

  // 8. Highest-multiplier single-target damage off cooldown
  const dmg = findReadyDamage(actor, abilities, 'any')
  if (dmg) {
    const targets = resolveTargets(dmg, actor, livingAllies, livingEnemies, rng)
    return { ability: dmg, targets }
  }

  // 9. Basic attack
  const basicAttack = getBasicAttack()
  const targets = selectTarget({
    enemies: livingEnemies,
    targetType: 'single_enemy',
    rng,
  })
  return { ability: basicAttack, targets }
}

// ─── Helpers ───────────────────────────────────────────────────────

function findReady(
  actor: BattleCreature,
  abilities: ResolvedAbility[],
  category: string,
): ResolvedAbility | undefined {
  return abilities.find(
    (a) => a.category === category && isAbilityReady(actor, a),
  )
}

function findReadyDamage(
  actor: BattleCreature,
  abilities: ResolvedAbility[],
  mode: 'single' | 'any',
): ResolvedAbility | undefined {
  const damageAbilities = abilities
    .filter((a) => {
      if (!isAbilityReady(actor, a)) return false
      if (mode === 'single') return a.category === 'damage'
      return a.category === 'damage' || a.category === 'aoe_damage'
    })
    .sort((a, b) => (b.multiplier ?? 0) - (a.multiplier ?? 0))
  return damageAbilities[0]
}

function resolveTargets(
  ability: ResolvedAbility,
  actor: BattleCreature,
  allies: BattleCreature[],
  enemies: BattleCreature[],
  rng: SeededRng,
): BattleCreature[] {
  switch (ability.target) {
    case 'self':
      return [actor]
    case 'all_allies':
      return allies
    case 'all_enemies':
      return enemies
    case 'single_enemy':
    case 'random_enemy':
      return selectTarget({
        enemies,
        targetType: ability.target,
        rng,
      })
    default:
      return [actor]
  }
}
