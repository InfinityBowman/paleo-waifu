import { simulateBattle } from '@paleo-waifu/shared/battle/engine'
import { buildTeamWithRows } from '../runner.ts'
import {
  printRankedList,
  printSubheader,
  roleColor,
} from '../report.ts'
import { ABILITY_NAME_MAP } from './meta-types.ts'
import { getRows } from './meta-utils.ts'
import type { AbilityTemplate } from '@paleo-waifu/shared/battle/types'
import type { Individual, TeamGenome } from './meta-types.ts'

interface ActionStats {
  abilityId: string
  abilityName: string
  useCount: number
  totalDamage: number
  avgDamage: number
}

interface RoleActionProfile {
  role: string
  totalActions: number
  basicAttackPct: number
  topAbilities: Array<ActionStats>
  totalDamageDealt: number
  avgDamagePerAction: number
}

export function analyzeBattleActions(
  population: Array<Individual>,
  templateMap?: Map<string, AbilityTemplate>,
  damageScale?: number,
  defScaling?: number,
  basicAttackMultiplier?: number,
): Array<RoleActionProfile> {
  const sorted = [...population].sort((a, b) => b.fitness - a.fitness)
  const topTeams = sorted.slice(0, Math.ceil(population.length / 4))

  const roleActions = new Map<
    string,
    Map<string, { uses: number; totalDmg: number }>
  >()
  const roleTotalDmg = new Map<string, number>()
  const roleTotalActions = new Map<string, number>()

  // Run each top team against random opponents, analyze both sides
  for (const team of topTeams) {
    for (let m = 0; m < 10; m++) {
      const opp = sorted[Math.floor(Math.random() * sorted.length)]
      const baseSeed = Math.floor(Math.random() * 1_000_000)

      // Play both sides so action analysis isn't side-biased
      for (const asSide of ['A', 'B'] as const) {
        try {
          let teamA, teamB
          if (asSide === 'A') {
            teamA = buildTeamWithRows(
              team.members,
              getRows(team.genome),
              templateMap,
            )
            teamB = buildTeamWithRows(
              opp.members,
              getRows(opp.genome),
              templateMap,
            )
          } else {
            teamA = buildTeamWithRows(
              opp.members,
              getRows(opp.genome),
              templateMap,
            )
            teamB = buildTeamWithRows(
              team.members,
              getRows(team.genome),
              templateMap,
            )
          }

          const result = simulateBattle(teamA, teamB, {
            seed: baseSeed + (asSide === 'B' ? 1 : 0),
            damageScale,
            defScaling,
            basicAttackMultiplier,
          })

          // Only analyze when the top team wins
          if (result.winner !== asSide) continue

          // Build creature->role map for the top team
          const prefix = `${asSide}-`
          const creatureRoleMap = new Map<string, string>()
          for (let i = 0; i < team.members.length; i++) {
            const member = team.members[i]
            const battleId = `${asSide}-${i}-${member.id}-${i}`
            creatureRoleMap.set(battleId, member.role)
          }

          const lastAbilityByCreature = new Map<string, string>()

          for (const event of result.log) {
            if (event.type === 'creature_action') {
              const creatureId = (event as any).creatureId as string
              if (!creatureId.startsWith(prefix)) continue

              const role = creatureRoleMap.get(creatureId)
              if (!role) continue

              const abilityId = (event as any).abilityId as string
              lastAbilityByCreature.set(creatureId, abilityId)

              if (!roleActions.has(role)) roleActions.set(role, new Map())
              const roleMap = roleActions.get(role)!
              const existing = roleMap.get(abilityId) ?? {
                uses: 0,
                totalDmg: 0,
              }
              existing.uses++
              roleMap.set(abilityId, existing)

              roleTotalActions.set(role, (roleTotalActions.get(role) ?? 0) + 1)
            }

            if (event.type === 'damage') {
              const sourceId = (event as any).sourceId as string
              if (!sourceId.startsWith(prefix)) continue

              const role = creatureRoleMap.get(sourceId)
              if (!role) continue

              const dmg = (event as any).amount as number
              if (dmg <= 0) continue

              const abilityId =
                lastAbilityByCreature.get(sourceId) ?? 'basic_attack'
              const roleMap = roleActions.get(role)
              if (roleMap) {
                const existing = roleMap.get(abilityId) ?? {
                  uses: 0,
                  totalDmg: 0,
                }
                existing.totalDmg += dmg
                roleMap.set(abilityId, existing)
              }

              roleTotalDmg.set(role, (roleTotalDmg.get(role) ?? 0) + dmg)
            }
          }
        } catch {
          // skip
        }
      }
    }
  }

  // Build profiles
  const profiles: Array<RoleActionProfile> = []

  for (const [role, actionMap] of roleActions) {
    const totalActions = roleTotalActions.get(role) ?? 0
    const totalDmg = roleTotalDmg.get(role) ?? 0
    const basicAttack = actionMap.get('basic_attack')
    const basicPct = basicAttack ? (basicAttack.uses / totalActions) * 100 : 0

    const topAbilities = [...actionMap.entries()]
      .map(([id, stats]) => ({
        abilityId: id,
        abilityName: ABILITY_NAME_MAP.get(id) ?? id,
        useCount: stats.uses,
        totalDamage: stats.totalDmg,
        avgDamage: stats.uses > 0 ? stats.totalDmg / stats.uses : 0,
      }))
      .sort((a, b) => b.useCount - a.useCount)
      .slice(0, 8)

    profiles.push({
      role,
      totalActions,
      basicAttackPct: basicPct,
      topAbilities,
      totalDamageDealt: totalDmg,
      avgDamagePerAction: totalActions > 0 ? totalDmg / totalActions : 0,
    })
  }

  return profiles.sort((a, b) => b.totalDamageDealt - a.totalDamageDealt)
}

export function renderActionAnalysis(profiles: Array<RoleActionProfile>): void {
  printSubheader('WINNING TEAM ACTION ANALYSIS (by role)')

  for (const profile of profiles) {
    console.log(
      `\n  ${roleColor(profile.role).toUpperCase()} — ${profile.totalActions} actions, ${Math.round(profile.totalDamageDealt)} total dmg, ${profile.avgDamagePerAction.toFixed(1)} avg dmg/action, ${profile.basicAttackPct.toFixed(1)}% basic attacks`,
    )

    printRankedList(
      [
        { header: 'Ability' },
        { header: 'Uses' },
        { header: 'Total Dmg' },
        { header: 'Avg Dmg' },
        { header: '% of Actions' },
      ],
      profile.topAbilities.map((a) => [
        a.abilityName,
        String(a.useCount),
        String(Math.round(a.totalDamage)),
        a.avgDamage.toFixed(1),
        `${((a.useCount / profile.totalActions) * 100).toFixed(1)}%`,
      ]),
    )
  }
}
