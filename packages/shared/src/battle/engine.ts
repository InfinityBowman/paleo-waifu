import {
  fireTrigger,
  materializeAlwaysPassive,
  resolveAbilityEffects,
  tickStatusEffects,
} from './abilities'
import { selectAction } from './ai'
import { DEFAULT_ROLE, DIET_TO_ROLE, TYPE_TO_ROLE } from './constants'
import { createRng } from './rng'
import { applySynergies, calculateSynergies } from './synergies'
import type {
  BattleCreature,
  BattleLogEvent,
  BattleResult,
  BattleTeam,
  BattleTeamMember,
  EffectContext,
  EffectResolution,
  SeededRng,
  TeamSide,
  Trigger,
} from './types'

const MAX_TURNS = 30

// ─── Public API ────────────────────────────────────────────────────

export function simulateBattle(
  teamA: BattleTeam,
  teamB: BattleTeam,
  options: { seed: number },
): BattleResult {
  const rng = createRng(options.seed)
  const log: Array<BattleLogEvent> = []
  const koLogged = new Set<string>()

  // 1. Hydrate
  const creaturesA = teamA.members.map((m, i) =>
    hydrateBattleCreature(m, 'A', i),
  )
  const creaturesB = teamB.members.map((m, i) =>
    hydrateBattleCreature(m, 'B', i),
  )

  log.push({
    type: 'battle_start',
    teamA: creaturesA.map((c) => c.name),
    teamB: creaturesB.map((c) => c.name),
    seed: options.seed,
  })

  // 2. Materialize always-on passives (thick_hide, evasive, pack_hunter, etc.)
  for (const c of [...creaturesA, ...creaturesB]) {
    const allies = c.teamSide === 'A' ? creaturesA : creaturesB
    materializeAlwaysPassive(c, allies)
  }

  // 3. Fire onBattleStart triggers (e.g., territorial)
  for (const c of [...creaturesA, ...creaturesB]) {
    fireAndLog(
      'onBattleStart',
      c,
      creaturesA,
      creaturesB,
      rng,
      0,
      log,
    )
  }

  // 4. Synergies
  const synergiesA = calculateSynergies(creaturesA)
  const synergiesB = calculateSynergies(creaturesB)
  applySynergies(creaturesA, synergiesA)
  applySynergies(creaturesB, synergiesB)
  for (const syn of synergiesA) {
    log.push({ type: 'synergy_applied', teamSide: 'A', synergy: syn })
  }
  for (const syn of synergiesB) {
    log.push({ type: 'synergy_applied', teamSide: 'B', synergy: syn })
  }

  // 5. Turn loop
  let turnCount = 0
  let winner: TeamSide | null = null

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    turnCount = turn
    log.push({ type: 'turn_start', turn })

    // Weighted initiative: spd × random(0.5, 1.5)
    const turnOrder = [...creaturesA, ...creaturesB]
      .filter((c) => c.isAlive)
      .sort(
        (a, b) =>
          b.spd * rng.nextFloat(0.5, 1.5) -
          a.spd * rng.nextFloat(0.5, 1.5),
      )

    for (const creature of turnOrder) {
      if (!creature.isAlive) continue

      // Decrement active cooldown
      creature.cooldown = Math.max(0, creature.cooldown - 1)

      // Stun check
      if (creature.isStunned) {
        log.push({
          type: 'stun_skip',
          turn,
          creatureId: creature.id,
        })
        creature.isStunned = false
        creature.statusEffects = creature.statusEffects.filter(
          (e) => e.kind !== 'stun',
        )
        tickAndLog(creature, turn, log)
        continue
      }

      const allies =
        creature.teamSide === 'A' ? creaturesA : creaturesB
      const enemies =
        creature.teamSide === 'A' ? creaturesB : creaturesA

      // Re-materialize dynamic passives (pack_hunter ally count changes)
      materializeAlwaysPassive(creature, allies)

      // Fire onTurnStart passives
      fireAndLog(
        'onTurnStart',
        creature,
        creaturesA,
        creaturesB,
        rng,
        turn,
        log,
      )

      // AI selects action
      const livingAllies = allies.filter((a) => a.isAlive)
      const livingEnemies = enemies.filter((e) => e.isAlive)

      const { ability, targets } = selectAction({
        actor: creature,
        allies: livingAllies,
        enemies: livingEnemies,
        rng,
        turn,
      })

      log.push({
        type: 'creature_action',
        turn,
        creatureId: creature.id,
        creatureName: creature.name,
        abilityId: ability.id,
        abilityName: ability.displayName,
        targetIds: targets.map((t) => t.id),
      })

      // Set cooldown for active ability (not basic attack)
      if (
        ability.id !== 'basic_attack' &&
        ability.trigger.type === 'onUse'
      ) {
        creature.cooldown = ability.trigger.cooldown
      }

      // Resolve ability effects
      const ctx = makeCtx(creature, allies, enemies, rng, turn)
      ctx.targets = targets
      const resolutions = resolveAbilityEffects(ability, targets, ctx)
      logResolutions(creature, resolutions, turn, log)

      // Fire onBasicAttack passives (venomous, predator_instinct)
      if (ability.id === 'basic_attack' && targets.length > 0) {
        const attackCtx = makeCtx(
          creature,
          allies,
          enemies,
          rng,
          turn,
        )
        attackCtx.triggerAttackTarget = targets[0]
        const attackRes = fireTrigger(
          'onBasicAttack',
          creature,
          attackCtx,
        )
        if (attackRes.length > 0) {
          log.push({
            type: 'passive_trigger',
            turn,
            creatureId: creature.id,
            passiveId: creature.passive.id,
            triggerKind: 'onBasicAttack',
            description: creature.passive.description,
          })
          logResolutions(creature, attackRes, turn, log)
        }
      }

      // Handle KOs from damage
      processNewKOs(
        creature,
        creaturesA,
        creaturesB,
        koLogged,
        turn,
        log,
        rng,
      )

      winner = checkWinner(creaturesA, creaturesB)
      if (winner) break

      // Tick status effects (DoT, buff/debuff expiry, shield duration)
      tickAndLog(creature, turn, log)

      // Handle KOs from DoT
      processNewKOs(
        creature,
        creaturesA,
        creaturesB,
        koLogged,
        turn,
        log,
        rng,
      )

      winner = checkWinner(creaturesA, creaturesB)
      if (winner) break

      // Fire onTurnEnd passives (regenerative)
      fireAndLog(
        'onTurnEnd',
        creature,
        creaturesA,
        creaturesB,
        rng,
        turn,
        log,
      )

      winner = checkWinner(creaturesA, creaturesB)
      if (winner) break
    }

    log.push({ type: 'turn_end', turn })
    if (winner) break
  }

  // 6. Resolution
  if (!winner) {
    const teamAHp = calcTeamHpPercent(creaturesA)
    const teamBHp = calcTeamHpPercent(creaturesB)
    winner = teamAHp > teamBHp ? 'A' : 'B'
  }

  const reason =
    turnCount >= MAX_TURNS &&
    !checkWinner(creaturesA, creaturesB)
      ? 'timeout'
      : 'ko'

  log.push({
    type: 'battle_end',
    winner,
    reason,
    turns: turnCount,
  })

  return {
    winner,
    reason,
    turns: turnCount,
    teamAHpPercent: calcTeamHpPercent(creaturesA),
    teamBHpPercent: calcTeamHpPercent(creaturesB),
    log,
    finalState: { teamA: creaturesA, teamB: creaturesB },
    seed: options.seed,
  }
}

// ─── Hydration ─────────────────────────────────────────────────────

function hydrateBattleCreature(
  member: BattleTeamMember,
  teamSide: TeamSide,
  index: number,
): BattleCreature {
  return {
    id: `${teamSide}-${index}-${member.creatureId}`,
    creatureId: member.creatureId,
    name: member.name,
    teamSide,
    row: member.row,
    baseStats: { ...member.stats },
    maxHp: member.stats.hp,
    currentHp: member.stats.hp,
    atk: member.stats.atk,
    def: member.stats.def,
    spd: member.stats.spd,
    role:
      TYPE_TO_ROLE[member.type] ??
      DIET_TO_ROLE[member.diet] ??
      DEFAULT_ROLE,
    diet: member.diet,
    type: member.type,
    era: member.era,
    rarity: member.rarity,
    active: member.active,
    passive: member.passive,
    cooldown: 0,
    statusEffects: [],
    isAlive: true,
    isStunned: false,
    damageReductionPercent: 0,
    critReductionPercent: 0,
    flatReductionDefPercent: 0,
    dodgeBasePercent: 0,
  }
}

// ─── Trigger Helper ───────────────────────────────────────────────

function makeCtx(
  caster: BattleCreature,
  allies: Array<BattleCreature>,
  enemies: Array<BattleCreature>,
  rng: SeededRng,
  turn: number,
): EffectContext {
  return {
    caster,
    targets: [],
    allAllies: allies.filter((a) => a.isAlive),
    allEnemies: enemies.filter((e) => e.isAlive),
    rng,
    turn,
  }
}

function fireAndLog(
  triggerKind: Trigger['type'],
  creature: BattleCreature,
  creaturesA: Array<BattleCreature>,
  creaturesB: Array<BattleCreature>,
  rng: SeededRng,
  turn: number,
  log: Array<BattleLogEvent>,
): void {
  const allies =
    creature.teamSide === 'A' ? creaturesA : creaturesB
  const enemies =
    creature.teamSide === 'A' ? creaturesB : creaturesA
  const ctx = makeCtx(creature, allies, enemies, rng, turn)
  const resolutions = fireTrigger(triggerKind, creature, ctx)
  if (resolutions.length > 0) {
    log.push({
      type: 'passive_trigger',
      turn,
      creatureId: creature.id,
      passiveId: creature.passive.id,
      triggerKind,
      description: creature.passive.description,
    })
    logResolutions(creature, resolutions, turn, log)
  }
}

// ─── KO Processing ────────────────────────────────────────────────

function processNewKOs(
  attacker: BattleCreature,
  creaturesA: Array<BattleCreature>,
  creaturesB: Array<BattleCreature>,
  koLogged: Set<string>,
  turn: number,
  log: Array<BattleLogEvent>,
  rng: SeededRng,
): void {
  for (const c of [...creaturesA, ...creaturesB]) {
    if (!c.isAlive && !koLogged.has(c.id)) {
      koLogged.add(c.id)
      log.push({
        type: 'ko',
        turn,
        creatureId: c.id,
        creatureName: c.name,
      })

      // onKill for the attacker
      if (attacker.isAlive && attacker.id !== c.id) {
        fireAndLog(
          'onKill',
          attacker,
          creaturesA,
          creaturesB,
          rng,
          turn,
          log,
        )
      }

      // onEnemyKO for opponents of the dead creature
      const opponents =
        c.teamSide === 'A' ? creaturesB : creaturesA
      for (const opp of opponents) {
        if (!opp.isAlive) continue
        fireAndLog(
          'onEnemyKO',
          opp,
          creaturesA,
          creaturesB,
          rng,
          turn,
          log,
        )
      }

      // onAllyKO for allies of the dead creature
      const deadAllies =
        c.teamSide === 'A' ? creaturesA : creaturesB
      for (const ally of deadAllies) {
        if (!ally.isAlive || ally.id === c.id) continue
        fireAndLog(
          'onAllyKO',
          ally,
          creaturesA,
          creaturesB,
          rng,
          turn,
          log,
        )
      }
    }
  }
}

// ─── Resolution Logging ──────────────────────────────────────────

function logResolutions(
  source: BattleCreature,
  resolutions: Array<EffectResolution>,
  turn: number,
  log: Array<BattleLogEvent>,
): void {
  for (const res of resolutions) {
    switch (res.kind) {
      case 'damage':
        log.push({
          type: 'damage',
          turn,
          sourceId: source.id,
          targetId: res.targetId,
          amount: res.amount,
          isCrit: res.isCrit,
          isDodged: false,
          isDietBonus: res.isDietBonus,
        })
        break
      case 'dodged':
        log.push({
          type: 'damage',
          turn,
          sourceId: source.id,
          targetId: res.targetId,
          amount: 0,
          isCrit: false,
          isDodged: true,
          isDietBonus: false,
        })
        break
      case 'heal':
        log.push({
          type: 'heal',
          turn,
          sourceId: source.id,
          targetId: res.targetId,
          amount: res.amount,
          newHp: res.newHp,
        })
        break
      case 'status_applied':
        log.push({
          type: 'status_applied',
          turn,
          targetId: res.targetId,
          effect: res.effect,
        })
        break
      case 'shield_set':
        log.push({
          type: 'shield_absorbed',
          turn,
          targetId: res.targetId,
          absorbed: 0,
          remaining: res.amount,
        })
        break
      case 'reflect_damage':
        log.push({
          type: 'reflect_damage',
          turn,
          sourceId: res.sourceId,
          targetId: res.targetId,
          amount: res.amount,
        })
        break
    }
  }
}

// ─── Status Tick Logging ─────────────────────────────────────────

function tickAndLog(
  creature: BattleCreature,
  turn: number,
  log: Array<BattleLogEvent>,
): void {
  const results = tickStatusEffects(creature)
  for (const result of results) {
    if (result.damage !== undefined) {
      log.push({
        type: 'status_tick',
        turn,
        targetId: creature.id,
        kind: result.kind,
        damage: result.damage,
        newHp: creature.currentHp,
      })
    }
    if (result.healing !== undefined) {
      log.push({
        type: 'status_tick',
        turn,
        targetId: creature.id,
        kind: result.kind,
        damage: -result.healing,
        newHp: creature.currentHp,
      })
    }
    if (result.expired) {
      log.push({
        type: 'status_expired',
        turn,
        targetId: creature.id,
        kind: result.kind,
        stat: result.stat,
      })
    }
  }
}

// ─── Helpers ───────────────────────────────────────────────────────

function checkWinner(
  teamA: Array<BattleCreature>,
  teamB: Array<BattleCreature>,
): TeamSide | null {
  const aAlive = teamA.some((c) => c.isAlive)
  const bAlive = teamB.some((c) => c.isAlive)
  if (!aAlive && !bAlive) return 'B' // simultaneous wipe favors defender
  if (!aAlive) return 'B'
  if (!bAlive) return 'A'
  return null
}

function calcTeamHpPercent(team: Array<BattleCreature>): number {
  const totalMax = team.reduce((sum, c) => sum + c.maxHp, 0)
  if (totalMax === 0) return 0
  const totalCurrent = team.reduce(
    (sum, c) => sum + Math.max(0, c.currentHp),
    0,
  )
  return (totalCurrent / totalMax) * 100
}
