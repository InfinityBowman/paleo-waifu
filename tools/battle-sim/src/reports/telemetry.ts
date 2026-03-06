import type { BattleResult } from '@paleo-waifu/shared/battle/types'

export interface TelemetryResult {
  roleHpCurves: Record<string, { wins: Array<number>; losses: Array<number> }>
  roleContributions: Record<
    string,
    {
      avgDamageDealt: number
      avgDamageTaken: number
      avgHealingDone: number
      avgShieldsApplied: number
      avgDebuffsLanded: number
    }
  >
  roleWinRates: Record<string, number>
  abilityUsage: Array<{
    abilityId: string
    name: string
    uses: number
    totalDamage: number
    avgDamagePerUse: number
  }>
}

const DEBUFF_KINDS = new Set(['poison', 'bleed', 'debuff', 'stun'])

export function collectBattleTelemetry(
  result: BattleResult,
  hpCurveAcc: Map<string, { turnSums: Array<number>; turnCounts: Array<number> }>,
  contribAcc: Map<string, { damageDealt: number; damageTaken: number; healingDone: number; shieldsApplied: number; debuffsLanded: number }>,
  roleWinAcc: Map<string, { wins: number; losses: number }>,
  abilityAcc: Map<string, { name: string; uses: number; totalDamage: number }>,
): void {
  // Track role wins/losses
  if (result.winner) {
    const winTeam = result.winner === 'A' ? result.finalState.teamA : result.finalState.teamB
    const loseTeam = result.winner === 'A' ? result.finalState.teamB : result.finalState.teamA
    for (const c of winTeam) {
      const acc = roleWinAcc.get(c.role) ?? { wins: 0, losses: 0 }
      acc.wins++
      roleWinAcc.set(c.role, acc)
    }
    for (const c of loseTeam) {
      const acc = roleWinAcc.get(c.role) ?? { wins: 0, losses: 0 }
      acc.losses++
      roleWinAcc.set(c.role, acc)
    }
  }
  // Build creature→role and creature→teamSide maps from finalState
  const creatureRole = new Map<string, string>()
  const creatureTeam = new Map<string, 'A' | 'B'>()
  const creatureMaxHp = new Map<string, number>()

  for (const c of result.finalState.teamA) {
    creatureRole.set(c.id, c.role)
    creatureTeam.set(c.id, 'A')
    creatureMaxHp.set(c.id, c.maxHp)
  }
  for (const c of result.finalState.teamB) {
    creatureRole.set(c.id, c.role)
    creatureTeam.set(c.id, 'B')
    creatureMaxHp.set(c.id, c.maxHp)
  }

  // Track current HP per creature for HP curve snapshots
  const currentHp = new Map<string, number>()
  for (const [id, maxHp] of creatureMaxHp) {
    currentHp.set(id, maxHp)
  }

  // Determine outcome per creature based on winner
  const winner = result.winner // 'A' | 'B' | null

  // Track last acting creature for attributing shield events and damage to abilities
  let lastActorId: string | null = null
  const lastAbilityByCreature = new Map<string, string>()

  // Walk log events
  for (const event of result.log) {
    switch (event.type) {
      case 'creature_action': {
        lastActorId = event.creatureId
        lastAbilityByCreature.set(event.creatureId, event.abilityId)
        // Track ability usage
        const abilityEntry = abilityAcc.get(event.abilityId) ?? { name: event.abilityName, uses: 0, totalDamage: 0 }
        abilityEntry.uses++
        abilityAcc.set(event.abilityId, abilityEntry)
        break
      }

      case 'damage': {
        // Update HP tracking
        const prevHp = currentHp.get(event.targetId) ?? 0
        currentHp.set(event.targetId, Math.max(0, prevHp - event.amount))

        // Contribution: damage dealt by source role
        const sourceRole = creatureRole.get(event.sourceId)
        if (sourceRole) {
          const acc = contribAcc.get(sourceRole) ?? { damageDealt: 0, damageTaken: 0, healingDone: 0, shieldsApplied: 0, debuffsLanded: 0 }
          acc.damageDealt += event.amount
          contribAcc.set(sourceRole, acc)
        }

        // Contribution: damage taken by target role
        const targetRole = creatureRole.get(event.targetId)
        if (targetRole) {
          const acc = contribAcc.get(targetRole) ?? { damageDealt: 0, damageTaken: 0, healingDone: 0, shieldsApplied: 0, debuffsLanded: 0 }
          acc.damageTaken += event.amount
          contribAcc.set(targetRole, acc)
        }

        // Attribute damage to the ability that caused it
        const dmgAbilityId = lastAbilityByCreature.get(event.sourceId) ?? 'basic_attack'
        const dmgAbilityEntry = abilityAcc.get(dmgAbilityId)
        if (dmgAbilityEntry) {
          dmgAbilityEntry.totalDamage += event.amount
        }
        break
      }

      case 'heal': {
        currentHp.set(event.targetId, event.newHp)
        // Contribution: healing done by source role
        const healSourceRole = creatureRole.get(event.sourceId)
        if (healSourceRole) {
          const acc = contribAcc.get(healSourceRole) ?? { damageDealt: 0, damageTaken: 0, healingDone: 0, shieldsApplied: 0, debuffsLanded: 0 }
          acc.healingDone += event.amount
          contribAcc.set(healSourceRole, acc)
        }
        break
      }

      case 'status_tick': {
        currentHp.set(event.targetId, event.newHp)
        break
      }

      case 'ko': {
        currentHp.set(event.creatureId, 0)
        break
      }

      case 'status_applied': {
        const statusSourceRole = creatureRole.get(event.effect.sourceCreatureId)
        if (statusSourceRole && DEBUFF_KINDS.has(event.effect.kind)) {
          const acc = contribAcc.get(statusSourceRole) ?? { damageDealt: 0, damageTaken: 0, healingDone: 0, shieldsApplied: 0, debuffsLanded: 0 }
          acc.debuffsLanded++
          contribAcc.set(statusSourceRole, acc)
        }
        break
      }

      case 'shield_absorbed': {
        // absorbed === 0 means a shield was just applied (remaining = shield HP)
        // Attribute to the last acting creature (the caster)
        if (event.absorbed === 0 && event.remaining > 0 && lastActorId) {
          const shieldSourceRole = creatureRole.get(lastActorId)
          if (shieldSourceRole) {
            const acc = contribAcc.get(shieldSourceRole) ?? { damageDealt: 0, damageTaken: 0, healingDone: 0, shieldsApplied: 0, debuffsLanded: 0 }
            acc.shieldsApplied += event.remaining
            contribAcc.set(shieldSourceRole, acc)
          }
        }
        break
      }

      case 'turn_end': {
        const turn = event.turn

        // Snapshot HP% per creature, grouped by role and outcome
        for (const [creatureId, hp] of currentHp) {
          const role = creatureRole.get(creatureId)
          const team = creatureTeam.get(creatureId)
          const maxHp = creatureMaxHp.get(creatureId)
          if (!role || !team || !maxHp) continue

          const outcome = winner === null ? 'draw' : winner === team ? 'win' : 'loss'
          if (outcome === 'draw') continue // skip draws for clarity

          const key = `${role}-${outcome}`
          const bucket = hpCurveAcc.get(key) ?? { turnSums: [], turnCounts: [] }

          // Extend arrays if needed
          while (bucket.turnSums.length <= turn) {
            bucket.turnSums.push(0)
            bucket.turnCounts.push(0)
          }

          bucket.turnSums[turn] += hp / maxHp
          bucket.turnCounts[turn]++
          hpCurveAcc.set(key, bucket)
        }
        break
      }
    }
  }
}

export function finalizeTelemetry(
  hpCurveAcc: Map<string, { turnSums: Array<number>; turnCounts: Array<number> }>,
  contribAcc: Map<string, { damageDealt: number; damageTaken: number; healingDone: number; shieldsApplied: number; debuffsLanded: number }>,
  roleWinAcc: Map<string, { wins: number; losses: number }>,
  abilityAcc: Map<string, { name: string; uses: number; totalDamage: number }>,
  battleCount: number,
): TelemetryResult {
  // Build roleHpCurves
  const roleHpCurves: Record<string, { wins: Array<number>; losses: Array<number> }> = {}

  for (const [key, bucket] of hpCurveAcc) {
    const [role, outcome] = key.split('-') as [string, string]
    if (!(role in roleHpCurves)) {
      roleHpCurves[role] = { wins: [], losses: [] }
    }
    const averaged = bucket.turnSums.map((sum, i) =>
      bucket.turnCounts[i] > 0 ? sum / bucket.turnCounts[i] : 0,
    )
    if (outcome === 'win') {
      roleHpCurves[role].wins = averaged
    } else {
      roleHpCurves[role].losses = averaged
    }
  }

  // Build roleContributions (averaged per battle)
  const roleContributions: Record<
    string,
    {
      avgDamageDealt: number
      avgDamageTaken: number
      avgHealingDone: number
      avgShieldsApplied: number
      avgDebuffsLanded: number
    }
  > = {}

  if (battleCount > 0) {
    for (const [role, acc] of contribAcc) {
      roleContributions[role] = {
        avgDamageDealt: acc.damageDealt / battleCount,
        avgDamageTaken: acc.damageTaken / battleCount,
        avgHealingDone: acc.healingDone / battleCount,
        avgShieldsApplied: acc.shieldsApplied / battleCount,
        avgDebuffsLanded: acc.debuffsLanded / battleCount,
      }
    }
  }

  // Build roleWinRates
  const roleWinRates: Record<string, number> = {}
  for (const [role, acc] of roleWinAcc) {
    const total = acc.wins + acc.losses
    roleWinRates[role] = total > 0 ? acc.wins / total : 0.5
  }

  // Build abilityUsage sorted by uses descending
  const abilityUsage = [...abilityAcc.entries()]
    .map(([id, acc]) => ({
      abilityId: id,
      name: acc.name,
      uses: acc.uses,
      totalDamage: acc.totalDamage,
      avgDamagePerUse: acc.uses > 0 ? acc.totalDamage / acc.uses : 0,
    }))
    .sort((a, b) => b.uses - a.uses)

  return { roleHpCurves, roleContributions, roleWinRates, abilityUsage }
}
