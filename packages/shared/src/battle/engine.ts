import {
  decrementCooldowns,
  resolveAbility,
  tickStatusEffects,
} from './abilities'
import { selectAction } from './ai'
import { ALL_ABILITY_TEMPLATES } from './constants'
import { createRng } from './rng'
import { applySynergies, calculateSynergies } from './synergies'
import type {
  AbilityTemplateData,
  BattleCreature,
  BattleLogEvent,
  BattleResult,
  BattleTeam,
  BattleTeamMember,
  ResolvedAbility,
  SeededRng,
  TeamSide,
} from './types'

const MAX_TURNS = 30

// ─── Public API ────────────────────────────────────────────────────

export function simulateBattle(
  teamA: BattleTeam,
  teamB: BattleTeam,
  options: { seed: number },
): BattleResult {
  const rng = createRng(options.seed)
  const log: BattleLogEvent[] = []

  // 1. Convert team members to battle creatures
  const creaturesA = teamA.members.map((m, i) =>
    hydrateBattleCreature(m, 'A', i, rng),
  )
  const creaturesB = teamB.members.map((m, i) =>
    hydrateBattleCreature(m, 'B', i, rng),
  )

  log.push({
    type: 'battle_start',
    teamA: creaturesA.map((c) => c.name),
    teamB: creaturesB.map((c) => c.name),
    seed: options.seed,
  })

  // 2. Apply always-on passives
  for (const creature of [...creaturesA, ...creaturesB]) {
    applyAlwaysOnPassives(creature, creaturesA, creaturesB, log)
  }

  // 3. Calculate and apply synergies
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

  // 4. Turn loop
  let turnCount = 0
  let winner: TeamSide | null = null

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    turnCount = turn
    log.push({ type: 'turn_start', turn })

    // Sort by SPD desc, ties broken by RNG
    const allCreatures = [...creaturesA, ...creaturesB]
      .filter((c) => c.isAlive)
      .sort((a, b) => {
        if (b.spd !== a.spd) return b.spd - a.spd
        return rng.next() - 0.5
      })

    for (const creature of allCreatures) {
      if (!creature.isAlive) continue

      // Reset per-turn flags
      creature.reflectDamagePercent = creature.statusEffects.some(
        (e) => e.kind === 'reflect',
      )
        ? creature.statusEffects.find((e) => e.kind === 'reflect')!.value
        : 0

      // Decrement cooldowns
      decrementCooldowns(creature)

      // Check stun
      if (creature.isStunned) {
        log.push({ type: 'stun_skip', turn, creatureId: creature.id })
        creature.isStunned = false
        creature.statusEffects = creature.statusEffects.filter(
          (e) => e.kind !== 'stun',
        )
        // Still tick status effects even when stunned
        tickAndLog(creature, turn, log)
        continue
      }

      // Recalculate dynamic passives
      recalcDynamicPassives(creature, creaturesA, creaturesB, turn)

      // Determine allies/enemies
      const allies =
        creature.teamSide === 'A' ? creaturesA : creaturesB
      const enemies =
        creature.teamSide === 'A' ? creaturesB : creaturesA

      // Select action via AI
      const { ability, targets } = selectAction({
        actor: creature,
        allies: allies.filter((a) => a.isAlive),
        enemies: enemies.filter((e) => e.isAlive),
        rng,
      })

      log.push({
        type: 'creature_action',
        turn,
        creatureId: creature.id,
        creatureName: creature.name,
        abilityId: ability.templateId,
        abilityName: ability.displayName,
        targetIds: targets.map((t) => t.id),
      })

      // Resolve ability
      const resolutions = resolveAbility({
        caster: creature,
        ability,
        targets,
        allAllies: allies.filter((a) => a.isAlive),
        allEnemies: enemies.filter((e) => e.isAlive),
        rng,
        turn,
      })

      // Log resolutions
      for (const res of resolutions) {
        if (res.damage !== undefined && res.damage > 0) {
          log.push({
            type: 'damage',
            turn,
            sourceId: creature.id,
            targetId: res.targetId,
            amount: res.damage,
            isCrit: res.isCrit ?? false,
            isDodged: res.isDodged ?? false,
            isDietBonus: res.isDietBonus ?? false,
          })
        }
        if (res.isDodged) {
          log.push({
            type: 'damage',
            turn,
            sourceId: creature.id,
            targetId: res.targetId,
            amount: 0,
            isCrit: false,
            isDodged: true,
            isDietBonus: false,
          })
        }
        if (res.healing !== undefined && res.healing > 0) {
          const target = findCreature(
            res.targetId,
            creaturesA,
            creaturesB,
          )
          log.push({
            type: 'heal',
            turn,
            sourceId: creature.id,
            targetId: res.targetId,
            amount: res.healing,
            newHp: target?.currentHp ?? 0,
          })
        }
        if (res.statusApplied) {
          log.push({
            type: 'status_applied',
            turn,
            targetId: res.targetId,
            effect: res.statusApplied,
          })
        }
        if (res.shieldAmount !== undefined) {
          log.push({
            type: 'shield_absorbed',
            turn,
            targetId: res.targetId,
            absorbed: 0,
            remaining: res.shieldAmount,
          })
        }
        if (res.reflectDamage !== undefined && res.reflectDamage > 0) {
          log.push({
            type: 'reflect_damage',
            turn,
            sourceId: res.targetId,
            targetId: creature.id,
            amount: res.reflectDamage,
          })
        }
      }

      // Handle KOs from damage
      for (const c of [...creaturesA, ...creaturesB]) {
        if (!c.isAlive && c.currentHp <= 0) {
          // Only log if not already logged
          const alreadyLogged = log.some(
            (e) => e.type === 'ko' && e.creatureId === c.id,
          )
          if (!alreadyLogged) {
            log.push({
              type: 'ko',
              turn,
              creatureId: c.id,
              creatureName: c.name,
            })

            // Trigger scavenger passive
            triggerScavenger(c, creaturesA, creaturesB, turn, log)
          }
        }
      }

      // Check reflect KO of attacker
      if (!creature.isAlive) {
        const alreadyLogged = log.some(
          (e) => e.type === 'ko' && e.creatureId === creature.id,
        )
        if (!alreadyLogged) {
          log.push({
            type: 'ko',
            turn,
            creatureId: creature.id,
            creatureName: creature.name,
          })
          triggerScavenger(creature, creaturesA, creaturesB, turn, log)
        }
      }

      // Win check
      winner = checkWinner(creaturesA, creaturesB)
      if (winner) break

      // Tick status effects
      tickAndLog(creature, turn, log)

      // Check DoT KOs
      if (!creature.isAlive) {
        const alreadyLogged = log.some(
          (e) => e.type === 'ko' && e.creatureId === creature.id,
        )
        if (!alreadyLogged) {
          log.push({
            type: 'ko',
            turn,
            creatureId: creature.id,
            creatureName: creature.name,
          })
          triggerScavenger(creature, creaturesA, creaturesB, turn, log)
        }
      }

      winner = checkWinner(creaturesA, creaturesB)
      if (winner) break
    }

    log.push({ type: 'turn_end', turn })

    if (winner) break

    // Regenerative passive: heal 3% at end of turn
    for (const c of [...creaturesA, ...creaturesB]) {
      if (c.isAlive && c.passive.templateId === 'regenerative') {
        const healAmt = Math.max(
          1,
          Math.floor(c.maxHp * ((c.passive.effectValue ?? 3) / 100)),
        )
        c.currentHp = Math.min(c.maxHp, c.currentHp + healAmt)
        log.push({
          type: 'passive_trigger',
          turn,
          creatureId: c.id,
          passiveId: 'regenerative',
          description: `Healed ${healAmt} HP`,
        })
      }
    }
  }

  // 5. Resolution
  if (!winner) {
    // Timeout — compare HP%
    const teamAHp = calcTeamHpPercent(creaturesA)
    const teamBHp = calcTeamHpPercent(creaturesB)
    winner = teamAHp > teamBHp ? 'A' : 'B' // ties favor B (defender)
  }

  const reason = turnCount >= MAX_TURNS && !checkWinner(creaturesA, creaturesB) ? 'timeout' : 'ko'

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
  rng: SeededRng,
): BattleCreature {
  const templateMap = new Map<string, AbilityTemplateData>()
  for (const t of ALL_ABILITY_TEMPLATES) {
    templateMap.set(t.id, t)
  }

  const resolveAbilityFromAssignment = (
    assignment: { templateId: string; displayName: string },
    slot: 'active1' | 'active2' | 'passive',
  ): ResolvedAbility => {
    const template = templateMap.get(assignment.templateId)
    if (!template) {
      throw new Error(
        `Unknown ability template: ${assignment.templateId}`,
      )
    }
    return {
      templateId: template.id,
      displayName: assignment.displayName,
      slot,
      type: template.type,
      category: template.category,
      target: template.target,
      multiplier: template.multiplier,
      cooldown: template.cooldown,
      duration: template.duration,
      statAffected: template.statAffected,
      effectValue: template.effectValue,
    }
  }

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
    abl: member.stats.abl,
    role: 'bruiser', // role is derived from type in constants, not critical at runtime
    diet: member.diet,
    type: member.type,
    era: member.era,
    rarity: member.rarity,
    active1: resolveAbilityFromAssignment(
      member.abilities.active1,
      'active1',
    ),
    active2: resolveAbilityFromAssignment(
      member.abilities.active2,
      'active2',
    ),
    passive: resolveAbilityFromAssignment(
      member.abilities.passive,
      'passive',
    ),
    cooldowns: {},
    statusEffects: [],
    isAlive: true,
    isStunned: false,
    reflectDamagePercent: 0,
  }
}

// ─── Passives ──────────────────────────────────────────────────────

function applyAlwaysOnPassives(
  creature: BattleCreature,
  teamA: BattleCreature[],
  teamB: BattleCreature[],
  log: BattleLogEvent[],
): void {
  const passive = creature.passive

  switch (passive.templateId) {
    case 'aquatic_adaptation': {
      // +20% SPD, note: description says -10% DEF but effectValue is 20
      // We apply +20% SPD and -10% DEF as described
      creature.spd += Math.floor(creature.baseStats.spd * 0.2)
      creature.def -= Math.floor(creature.baseStats.def * 0.1)
      log.push({
        type: 'passive_trigger',
        turn: 0,
        creatureId: creature.id,
        passiveId: 'aquatic_adaptation',
        description: '+20% SPD, -10% DEF',
      })
      break
    }

    case 'territorial': {
      // +15% ATK and DEF when in front row
      if (creature.row === 'front') {
        const pct = (passive.effectValue ?? 15) / 100
        creature.atk += Math.floor(creature.baseStats.atk * pct)
        creature.def += Math.floor(creature.baseStats.def * pct)
        log.push({
          type: 'passive_trigger',
          turn: 0,
          creatureId: creature.id,
          passiveId: 'territorial',
          description: '+15% ATK and DEF (front row)',
        })
      }
      break
    }

    case 'apex_predator': {
      // +10% ATK, stun immunity handled at resolution time
      const pct = (passive.effectValue ?? 10) / 100
      creature.atk += Math.floor(creature.baseStats.atk * pct)
      log.push({
        type: 'passive_trigger',
        turn: 0,
        creatureId: creature.id,
        passiveId: 'apex_predator',
        description: '+10% ATK, stun immune',
      })
      break
    }

    case 'pack_hunter': {
      // +10% ATK per ally alive (initial = 2 allies)
      const allies =
        creature.teamSide === 'A' ? teamA : teamB
      const allyCount = allies.filter(
        (a) => a.id !== creature.id && a.isAlive,
      ).length
      const pct = ((passive.effectValue ?? 10) * allyCount) / 100
      creature.atk += Math.floor(creature.baseStats.atk * pct)
      log.push({
        type: 'passive_trigger',
        turn: 0,
        creatureId: creature.id,
        passiveId: 'pack_hunter',
        description: `+${allyCount * (passive.effectValue ?? 10)}% ATK (${allyCount} allies)`,
      })
      break
    }

    case 'herd_mentality': {
      // +10% all stats per ally of same creature type
      const allies =
        creature.teamSide === 'A' ? teamA : teamB
      const sameTypeCount = allies.filter(
        (a) => a.id !== creature.id && a.type === creature.type,
      ).length
      if (sameTypeCount > 0) {
        const pct =
          ((passive.effectValue ?? 10) * sameTypeCount) / 100
        creature.maxHp += Math.floor(creature.baseStats.hp * pct)
        creature.currentHp = creature.maxHp
        creature.atk += Math.floor(creature.baseStats.atk * pct)
        creature.def += Math.floor(creature.baseStats.def * pct)
        creature.spd += Math.floor(creature.baseStats.spd * pct)
        creature.abl += Math.floor(creature.baseStats.abl * pct)
        log.push({
          type: 'passive_trigger',
          turn: 0,
          creatureId: creature.id,
          passiveId: 'herd_mentality',
          description: `+${sameTypeCount * (passive.effectValue ?? 10)}% all stats (${sameTypeCount} same-type allies)`,
        })
      }
      break
    }
  }
}

function recalcDynamicPassives(
  creature: BattleCreature,
  teamA: BattleCreature[],
  teamB: BattleCreature[],
  turn: number,
): void {
  const passive = creature.passive

  // Use cooldowns map with reserved keys to track previously applied bonuses
  // This ensures we only apply the delta, not the full amount each turn

  if (passive.templateId === 'ancient_resilience') {
    // +5% all stats per KO'd ally
    const allies =
      creature.teamSide === 'A' ? teamA : teamB
    const deadCount = allies.filter(
      (a) => a.id !== creature.id && !a.isAlive,
    ).length
    const prevDeadCount = creature.cooldowns['__ar_dead'] ?? 0

    if (deadCount !== prevDeadCount) {
      const pct = ((passive.effectValue ?? 5) * deadCount) / 100
      const prevPct = ((passive.effectValue ?? 5) * prevDeadCount) / 100

      creature.atk +=
        Math.floor(creature.baseStats.atk * pct) -
        Math.floor(creature.baseStats.atk * prevPct)
      creature.def +=
        Math.floor(creature.baseStats.def * pct) -
        Math.floor(creature.baseStats.def * prevPct)
      creature.spd +=
        Math.floor(creature.baseStats.spd * pct) -
        Math.floor(creature.baseStats.spd * prevPct)
      creature.abl +=
        Math.floor(creature.baseStats.abl * pct) -
        Math.floor(creature.baseStats.abl * prevPct)

      creature.cooldowns['__ar_dead'] = deadCount
    }
  }

  if (passive.templateId === 'pack_hunter') {
    const allies =
      creature.teamSide === 'A' ? teamA : teamB
    const currentAllyCount = allies.filter(
      (a) => a.id !== creature.id && a.isAlive,
    ).length
    const prevAllyCount = creature.cooldowns['__ph_allies'] ?? currentAllyCount

    if (currentAllyCount !== prevAllyCount) {
      const currentPct =
        ((passive.effectValue ?? 10) * currentAllyCount) / 100
      const prevPct =
        ((passive.effectValue ?? 10) * prevAllyCount) / 100

      creature.atk +=
        Math.floor(creature.baseStats.atk * currentPct) -
        Math.floor(creature.baseStats.atk * prevPct)

      creature.cooldowns['__ph_allies'] = currentAllyCount
    }
  }
}

// ─── Helpers ───────────────────────────────────────────────────────

function tickAndLog(
  creature: BattleCreature,
  turn: number,
  log: BattleLogEvent[],
): void {
  const tickResults = tickStatusEffects(creature, turn)
  for (const result of tickResults) {
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
        damage: -(result.healing),
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

function triggerScavenger(
  deadCreature: BattleCreature,
  teamA: BattleCreature[],
  teamB: BattleCreature[],
  turn: number,
  log: BattleLogEvent[],
): void {
  // Scavenger: opponents of the dead creature heal 15% when enemy KO'd
  const opposingTeam =
    deadCreature.teamSide === 'A' ? teamB : teamA
  for (const c of opposingTeam) {
    if (c.isAlive && c.passive.templateId === 'scavenger') {
      const healAmt = Math.floor(
        c.maxHp * ((c.passive.effectValue ?? 15) / 100),
      )
      c.currentHp = Math.min(c.maxHp, c.currentHp + healAmt)
      log.push({
        type: 'passive_trigger',
        turn,
        creatureId: c.id,
        passiveId: 'scavenger',
        description: `Healed ${healAmt} HP from enemy KO`,
      })
    }
  }
}

function checkWinner(
  teamA: BattleCreature[],
  teamB: BattleCreature[],
): TeamSide | null {
  const aAlive = teamA.some((c) => c.isAlive)
  const bAlive = teamB.some((c) => c.isAlive)
  if (!aAlive && !bAlive) return 'B' // simultaneous wipe favors defender
  if (!aAlive) return 'B'
  if (!bAlive) return 'A'
  return null
}

function calcTeamHpPercent(team: BattleCreature[]): number {
  const totalMax = team.reduce((sum, c) => sum + c.maxHp, 0)
  if (totalMax === 0) return 0
  const totalCurrent = team.reduce(
    (sum, c) => sum + Math.max(0, c.currentHp),
    0,
  )
  return (totalCurrent / totalMax) * 100
}

function findCreature(
  id: string,
  teamA: BattleCreature[],
  teamB: BattleCreature[],
): BattleCreature | undefined {
  return (
    teamA.find((c) => c.id === id) ?? teamB.find((c) => c.id === id)
  )
}
