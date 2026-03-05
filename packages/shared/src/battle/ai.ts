import { isActiveReady } from './abilities'
import { BASIC_ATTACK } from './constants'
import type {
  Ability,
  BattleCreature,
  Effect,
  Role,
  SeededRng,
  SelectedAction,
} from './types'

// ─── AI Category ──────────────────────────────────────────────────

type AICategory =
  | 'damage'
  | 'aoe_damage'
  | 'heal'
  | 'buff'
  | 'debuff'
  | 'shield'
  | 'stun'
  | 'taunt'
  | 'dot'

function categorizeAbility(ability: Ability): AICategory {
  const types = new Set(ability.effects.map((e) => e.type))
  if (types.has('stun')) return 'stun'
  if (types.has('taunt')) return 'taunt'
  if (types.has('shield')) return 'shield'
  if (types.has('dot')) return 'dot'
  if (types.has('heal') && !types.has('damage')) return 'heal'
  if (types.has('buff') && !types.has('damage')) return 'buff'
  if (types.has('debuff') && !types.has('damage')) return 'debuff'
  if (types.has('damage') && ability.target === 'all_enemies')
    return 'aoe_damage'
  return 'damage'
}

// ─── Role Weight Multipliers ─────────────────────────────────────

const ROLE_WEIGHTS: Record<Role, Record<AICategory, number>> = {
  striker: {
    damage: 1.3,
    aoe_damage: 1.1,
    heal: 0.7,
    buff: 0.8,
    debuff: 0.9,
    shield: 0.5,
    stun: 0.8,
    taunt: 0.3,
    dot: 1.2,
  },
  tank: {
    damage: 0.7,
    aoe_damage: 0.7,
    heal: 0.9,
    buff: 1.0,
    debuff: 0.8,
    shield: 1.5,
    stun: 1.0,
    taunt: 1.8,
    dot: 0.6,
  },
  support: {
    damage: 0.5,
    aoe_damage: 0.5,
    heal: 1.5,
    buff: 1.4,
    debuff: 1.2,
    shield: 1.0,
    stun: 0.8,
    taunt: 0.7,
    dot: 0.5,
  },
  bruiser: {
    damage: 1.0,
    aoe_damage: 1.0,
    heal: 0.8,
    buff: 0.9,
    debuff: 1.0,
    shield: 0.8,
    stun: 1.0,
    taunt: 0.8,
    dot: 1.0,
  },
}

// ─── Game-State Modifiers ────────────────────────────────────────

interface GameStateModifiers {
  aggression: number
  defensive: number
  urgency: number
  focus: number
}

function getGameStateModifiers(
  allies: Array<BattleCreature>,
  enemies: Array<BattleCreature>,
  turn: number,
): GameStateModifiers {
  const allyHpAvg = avgHpPercent(allies)
  const enemyHpAvg = avgHpPercent(enemies)
  const hpRatio = allyHpAvg / Math.max(enemyHpAvg, 1)
  const enemyCount = enemies.length

  return {
    aggression: hpRatio > 1.3 ? 1.15 : hpRatio < 0.7 ? 0.85 : 1.0,
    defensive: hpRatio < 0.7 ? 1.2 : hpRatio > 1.3 ? 0.8 : 1.0,
    urgency: turn > 20 ? 1.25 : turn > 15 ? 1.1 : 1.0,
    focus: enemyCount === 1 ? 1.3 : 1.0,
  }
}

function avgHpPercent(creatures: Array<BattleCreature>): number {
  if (creatures.length === 0) return 0
  const total = creatures.reduce(
    (sum, c) => sum + c.currentHp / c.maxHp,
    0,
  )
  return (total / creatures.length) * 100
}

// ─── Scoring-Based Action Selection ──────────────────────────────

interface ScoredAction {
  ability: Ability
  score: number
  targets: Array<BattleCreature>
  slotOrder: number
}

export function selectAction({
  actor,
  allies,
  enemies,
  rng,
  turn,
}: {
  actor: BattleCreature
  allies: Array<BattleCreature>
  enemies: Array<BattleCreature>
  rng: SeededRng
  turn?: number
}): SelectedAction {
  const livingEnemies = enemies.filter((e) => e.isAlive)
  const livingAllies = allies.filter((a) => a.isAlive)
  const currentTurn = turn ?? 1

  const modifiers = getGameStateModifiers(
    livingAllies,
    livingEnemies,
    currentTurn,
  )
  const roleWeights = ROLE_WEIGHTS[actor.role]

  const candidates: Array<ScoredAction> = []

  // Score active ability if ready
  if (isActiveReady(actor)) {
    const category = categorizeAbility(actor.active)
    const { score, targets } = scoreAbility(
      actor.active,
      category,
      actor,
      livingAllies,
      livingEnemies,
      currentTurn,
    )
    const roleMultiplier = roleWeights[category]
    const finalScore = applyGameStateToScore(
      score * roleMultiplier,
      category,
      modifiers,
    )
    candidates.push({
      ability: actor.active,
      score: finalScore,
      targets,
      slotOrder: 0,
    })
  }

  // Always include basic attack
  const basicCategory = categorizeAbility(BASIC_ATTACK)
  const { score: basicScore, targets: basicTargets } = scoreAbility(
    BASIC_ATTACK,
    basicCategory,
    actor,
    livingAllies,
    livingEnemies,
    currentTurn,
  )
  const basicRoleMultiplier = roleWeights[basicCategory]
  const basicFinal = applyGameStateToScore(
    basicScore * basicRoleMultiplier,
    basicCategory,
    modifiers,
  )
  candidates.push({
    ability: BASIC_ATTACK,
    score: basicFinal,
    targets: basicTargets,
    slotOrder: 1,
  })

  // Pick highest score; deterministic tiebreak by slot order
  candidates.sort(
    (a, b) => b.score - a.score || a.slotOrder - b.slotOrder,
  )

  const chosen = candidates[0]

  // Fallback targets if empty
  let targets = chosen.targets
  if (targets.length === 0 && livingEnemies.length > 0) {
    targets = resolveTargetsSimple(
      chosen.ability,
      actor,
      livingAllies,
      livingEnemies,
      rng,
    )
  }

  return { ability: chosen.ability, targets }
}

// ─── Apply Game-State Modifiers to Score ─────────────────────────

function applyGameStateToScore(
  score: number,
  category: AICategory,
  modifiers: GameStateModifiers,
): number {
  switch (category) {
    case 'damage':
    case 'aoe_damage':
    case 'dot':
    case 'stun':
      return (
        score *
        modifiers.aggression *
        modifiers.urgency *
        modifiers.focus
      )
    case 'heal':
    case 'shield':
    case 'taunt':
      return score * modifiers.defensive
    case 'buff':
      return (
        score *
        modifiers.defensive *
        (modifiers.urgency > 1.0 ? 0.9 : 1.0)
      )
    case 'debuff':
      return score * modifiers.aggression
  }
}

// ─── Core Scoring ────────────────────────────────────────────────

function scoreAbility(
  ability: Ability,
  category: AICategory,
  actor: BattleCreature,
  allies: Array<BattleCreature>,
  enemies: Array<BattleCreature>,
  turn: number,
): { score: number; targets: Array<BattleCreature> } {
  switch (category) {
    case 'damage':
      return scoreDamage(ability, actor, enemies)
    case 'aoe_damage':
      return scoreAoeDamage(ability, enemies)
    case 'dot':
      return scoreDot(ability, actor, enemies)
    case 'heal':
      return scoreHeal(ability, actor, allies)
    case 'buff':
      return scoreBuff(ability, actor, allies)
    case 'debuff':
      return scoreDebuff(ability, enemies, turn)
    case 'shield':
      return scoreShield(ability, actor, allies)
    case 'stun':
      return scoreStun(ability, actor, enemies)
    case 'taunt':
      return scoreTaunt(actor, allies, enemies)
  }
}

// ─── Category Scorers ────────────────────────────────────────────

function scoreDamage(
  ability: Ability,
  actor: BattleCreature,
  enemies: Array<BattleCreature>,
): { score: number; targets: Array<BattleCreature> } {
  if (enemies.length === 0) return { score: 0, targets: [] }

  const multiplier = getDamageMultiplier(ability)
  let bestScore = -Infinity
  let bestTarget: BattleCreature = enemies[0]

  for (const enemy of enemies) {
    let score = multiplier * 100

    const estimatedDmg = estimateDamage(actor, enemy, ability)
    const wouldKill = estimatedDmg >= enemy.currentHp

    // Finish bonus: prefer killing blows
    if (wouldKill) score += 30

    // Overkill penalty: don't waste cooldowns on targets a basic could kill
    const cd =
      ability.trigger.type === 'onUse'
        ? ability.trigger.cooldown
        : 0
    if (wouldKill && cd >= 2) {
      const basicEstimate = estimateDamage(
        actor,
        enemy,
        BASIC_ATTACK,
      )
      if (basicEstimate >= enemy.currentHp) {
        score -= 30 * cd
      }
    }

    // Slight preference for low-HP targets (focus fire)
    score += (1 - enemy.currentHp / enemy.maxHp) * 15

    // Venomous synergy: basic attack benefits from poison application
    if (
      ability.id === 'basic_attack' &&
      actor.passive.trigger.type === 'onBasicAttack'
    ) {
      const hasPoison = enemy.statusEffects.some(
        (e) => e.kind === 'poison',
      )
      if (!hasPoison) score += 20
    }

    if (score > bestScore) {
      bestScore = score
      bestTarget = enemy
    }
  }

  return { score: bestScore, targets: [bestTarget] }
}

function scoreAoeDamage(
  ability: Ability,
  enemies: Array<BattleCreature>,
): { score: number; targets: Array<BattleCreature> } {
  if (enemies.length === 0) return { score: 0, targets: [] }

  const base = getDamageMultiplier(ability) * 100
  const score = base * enemies.length * 0.6

  return { score, targets: enemies }
}

function scoreDot(
  ability: Ability,
  _actor: BattleCreature,
  enemies: Array<BattleCreature>,
): { score: number; targets: Array<BattleCreature> } {
  if (enemies.length === 0) return { score: 0, targets: [] }

  const multiplier = getDamageMultiplier(ability)
  const dotParams = getDotParams(ability)

  let bestScore = -Infinity
  let bestTarget: BattleCreature = enemies[0]

  for (const enemy of enemies) {
    let score = multiplier * 80

    if (dotParams) {
      score += dotParams.percent * dotParams.duration * 8
    }

    const hpPercent = enemy.currentHp / enemy.maxHp
    const hasDoT = enemy.statusEffects.some(
      (e) => e.kind === 'bleed' || e.kind === 'poison',
    )

    if (hpPercent > 0.6 && !hasDoT) score += 25
    if (hpPercent < 0.25) score -= 50
    if (hasDoT) score -= 20

    if (score > bestScore) {
      bestScore = score
      bestTarget = enemy
    }
  }

  return { score: bestScore, targets: [bestTarget] }
}

function scoreHeal(
  ability: Ability,
  actor: BattleCreature,
  allies: Array<BattleCreature>,
): { score: number; targets: Array<BattleCreature> } {
  if (allies.length === 0) return { score: 0, targets: [] }

  let score = 0

  const mostWounded = allies.reduce((worst, a) =>
    a.currentHp / a.maxHp < worst.currentHp / worst.maxHp ? a : worst,
  )
  const worstAllyHpPct = mostWounded.currentHp / mostWounded.maxHp

  if (ability.target === 'self') {
    const actorHpPct = actor.currentHp / actor.maxHp
    if (actorHpPct < 0.25) score += 80
    else if (actorHpPct < 0.4) score += 50
    else if (actorHpPct < 0.6) score += 20
    return { score, targets: [actor] }
  }

  if (ability.target === 'lowest_hp_ally') {
    if (worstAllyHpPct < 0.3) score += 70
    else if (worstAllyHpPct < 0.45) score += 50
    else if (worstAllyHpPct < 0.6) score += 25
    return { score, targets: [mostWounded] }
  }

  // all_allies team heal
  if (worstAllyHpPct < 0.3) score += 70
  else if (worstAllyHpPct < 0.45) score += 50
  else if (worstAllyHpPct < 0.6) score += 30

  const healthyAllies = allies.filter(
    (a) => a.currentHp / a.maxHp > 0.8,
  )
  score -= healthyAllies.length * 10

  return { score, targets: allies }
}

function scoreBuff(
  ability: Ability,
  actor: BattleCreature,
  allies: Array<BattleCreature>,
): { score: number; targets: Array<BattleCreature> } {
  let score = 30

  const buffStats = ability.effects
    .filter(
      (e): e is Effect & { type: 'buff' } => e.type === 'buff',
    )
    .map((e) => e.stat)

  const allBuffed = buffStats.every((stat) =>
    allies.every((a) =>
      a.statusEffects.some(
        (e) => e.kind === 'buff' && e.stat === stat,
      ),
    ),
  )
  const someBuffed = buffStats.some((stat) =>
    allies.some((a) =>
      a.statusEffects.some(
        (e) => e.kind === 'buff' && e.stat === stat,
      ),
    ),
  )

  if (allBuffed) score -= 60
  else if (!someBuffed) score += 40
  else score += 15

  if (ability.target === 'all_allies' && allies.length >= 3)
    score += 15

  if (ability.target === 'all_allies')
    return { score, targets: allies }
  return { score, targets: [actor] }
}

function scoreDebuff(
  ability: Ability,
  enemies: Array<BattleCreature>,
  _turn: number,
): { score: number; targets: Array<BattleCreature> } {
  if (enemies.length === 0) return { score: 0, targets: [] }

  const debuffStats = ability.effects
    .filter(
      (e): e is Effect & { type: 'debuff' } => e.type === 'debuff',
    )
    .map((e) => e.stat)

  let bestScore = -Infinity
  let bestTarget: BattleCreature = enemies[0]

  for (const enemy of enemies) {
    let score = 40

    // Higher priority on supports/healers
    if (hasHealAbility(enemy)) score += 25

    // Higher priority on high-DPS enemies
    const highestAtk = enemies.reduce((a, b) =>
      a.atk >= b.atk ? a : b,
    )
    if (enemy.id === highestAtk.id) score += 15

    // Penalty if already debuffed in that stat
    const alreadyDebuffed = debuffStats.some((stat) =>
      enemy.statusEffects.some(
        (e) => e.kind === 'debuff' && e.stat === stat,
      ),
    )
    if (alreadyDebuffed) score -= 40

    if (score > bestScore) {
      bestScore = score
      bestTarget = enemy
    }
  }

  const targets =
    ability.target === 'all_enemies' ? enemies : [bestTarget]
  return { score: bestScore, targets }
}

function scoreShield(
  ability: Ability,
  actor: BattleCreature,
  allies: Array<BattleCreature>,
): { score: number; targets: Array<BattleCreature> } {
  if (ability.target === 'lowest_hp_ally') {
    if (allies.length === 0) return { score: 0, targets: [] }

    const lowestHpAlly = allies.reduce((a, b) =>
      a.currentHp / a.maxHp < b.currentHp / b.maxHp ? a : b,
    )
    let score = 25
    const allyHpPct =
      lowestHpAlly.currentHp / lowestHpAlly.maxHp

    if (allyHpPct < 0.4) score += 50
    else if (allyHpPct < 0.6) score += 30
    else if (allyHpPct < 0.8) score += 10

    const hasShield = lowestHpAlly.statusEffects.some(
      (e) => e.kind === 'shield',
    )
    if (hasShield) score -= 30

    return { score, targets: [lowestHpAlly] }
  }

  let score = 20
  const hasShield = actor.statusEffects.some(
    (e) => e.kind === 'shield',
  )
  if (hasShield) {
    score -= 40
  } else {
    score += 30
    const hpPct = actor.currentHp / actor.maxHp
    if (hpPct < 0.6) score += 20
  }

  return { score, targets: [actor] }
}

function scoreStun(
  ability: Ability,
  _actor: BattleCreature,
  enemies: Array<BattleCreature>,
): { score: number; targets: Array<BattleCreature> } {
  if (enemies.length === 0) return { score: 0, targets: [] }

  const multiplier = getDamageMultiplier(ability)
  let bestScore = -Infinity
  let bestTarget: BattleCreature = enemies[0]

  for (const enemy of enemies) {
    let score = 50

    if (hasHealAbility(enemy)) score += 25
    if (enemies.length >= 3) score += 20
    if (enemy.isStunned) score -= 40
    if (multiplier > 0) score += multiplier * 20

    if (score > bestScore) {
      bestScore = score
      bestTarget = enemy
    }
  }

  return { score: bestScore, targets: [bestTarget] }
}

function scoreTaunt(
  actor: BattleCreature,
  allies: Array<BattleCreature>,
  enemies: Array<BattleCreature>,
): { score: number; targets: Array<BattleCreature> } {
  let score = 25

  if (enemies.length <= 1) score -= 50

  const teamHasTaunt = allies.some((a) =>
    a.statusEffects.some((e) => e.kind === 'taunt'),
  )
  if (teamHasTaunt) score -= 50
  if (!teamHasTaunt && enemies.length >= 2) score += 50

  const hasSquishyAlly = allies.some(
    (a) => a.id !== actor.id && a.def < actor.def * 0.7,
  )
  if (hasSquishyAlly) score += 25

  return { score, targets: [actor] }
}

// ─── Helpers ───────────────────────────────────────────────────────

function getDamageMultiplier(ability: Ability): number {
  for (const e of ability.effects) {
    if (e.type === 'damage') return e.multiplier
  }
  return 0
}

function getDotParams(
  ability: Ability,
): { percent: number; duration: number } | null {
  for (const e of ability.effects) {
    if (e.type === 'dot')
      return { percent: e.percent, duration: e.duration }
  }
  return null
}

function estimateDamage(
  attacker: BattleCreature,
  defender: BattleCreature,
  ability: Ability,
): number {
  let scaling: 'atk' | 'def' = 'atk'
  let multiplier = 0
  for (const e of ability.effects) {
    if (e.type === 'damage') {
      scaling = e.scaling
      multiplier = e.multiplier
      break
    }
  }
  if (multiplier === 0) return 0

  const stat = scaling === 'def' ? attacker.def : attacker.atk
  const raw = stat * multiplier
  return Math.floor(raw * (100 / (100 + defender.def)))
}

function hasHealAbility(creature: BattleCreature): boolean {
  return creature.active.effects.some((e) => e.type === 'heal')
}

function resolveTargetsSimple(
  ability: Ability,
  actor: BattleCreature,
  allies: Array<BattleCreature>,
  enemies: Array<BattleCreature>,
  rng: SeededRng,
): Array<BattleCreature> {
  switch (ability.target) {
    case 'self':
      return [actor]
    case 'all_allies':
      return allies
    case 'all_enemies':
      return enemies
    case 'lowest_hp_ally': {
      if (allies.length === 0) return []
      return [
        allies.reduce((a, b) =>
          a.currentHp / a.maxHp < b.currentHp / b.maxHp ? a : b,
        ),
      ]
    }
    case 'single_enemy': {
      if (enemies.length === 0) return []
      const taunting = enemies.find((e) =>
        e.statusEffects.some((s) => s.kind === 'taunt'),
      )
      if (taunting) return [taunting]
      const frontRow = enemies.filter((e) => e.row === 'front')
      const pool = frontRow.length > 0 ? frontRow : enemies
      return [
        pool.reduce((a, b) =>
          a.currentHp / a.maxHp <= b.currentHp / b.maxHp ? a : b,
        ),
      ]
    }
    case 'random_enemy': {
      if (enemies.length === 0) return []
      return [enemies[rng.nextInt(0, enemies.length - 1)]]
    }
    default:
      return [actor]
  }
}
