import { simulateBattle } from '@paleo-waifu/shared/battle/engine'
import {
  ALL_ABILITY_TEMPLATES,
  templateToAbility,
} from '@paleo-waifu/shared/battle/constants'
import type {
  Ability,
  BattleTeam,
  BattleTeamMember,
  Row,
} from '@paleo-waifu/shared/battle/types'
import type { CreatureRecord } from './db.ts'

// ─── Types ────────────────────────────────────────────────────────

export interface TrialResult {
  winner: 'A' | 'B' | null
  turns: number
  teamAHpPercent: number
  teamBHpPercent: number
}

export interface TrialSummary {
  winsA: number
  winsB: number
  winRateA: number
  avgTurns: number
}

// ─── Template Resolution ─────────────────────────────────────────

const TEMPLATE_MAP = new Map(
  ALL_ABILITY_TEMPLATES.map((t) => [t.id, t]),
)

function resolveAbility(assignment: {
  templateId: string
  displayName: string
}): Ability {
  const template = TEMPLATE_MAP.get(assignment.templateId)
  if (!template) {
    throw new Error(
      `Unknown ability template: ${assignment.templateId}`,
    )
  }
  return templateToAbility(template, assignment.displayName)
}

// ─── Row Assignment ───────────────────────────────────────────────

export function assignRow(role: string): 'front' | 'back' {
  return role === 'tank' || role === 'bruiser' ? 'front' : 'back'
}

// ─── Team Building ────────────────────────────────────────────────

function toMember(
  record: CreatureRecord,
  index: number,
): BattleTeamMember {
  return {
    creatureId: `${record.id}-${index}`,
    name: record.name,
    stats: {
      hp: record.hp,
      atk: record.atk,
      def: record.def,
      spd: record.spd,
    },
    active: resolveAbility(record.active),
    passive: resolveAbility(record.passive),
    diet: record.diet,
    type: record.type,
    era: record.era,
    rarity: record.rarity,
    row: assignRow(record.role),
  }
}

export function buildTeam(
  members: [CreatureRecord, CreatureRecord, CreatureRecord],
): BattleTeam {
  const teamMembers = members.map((m, i) => toMember(m, i)) as [
    BattleTeamMember,
    BattleTeamMember,
    BattleTeamMember,
  ]

  // Ensure at least one front-row member
  const hasFront = teamMembers.some((m) => m.row === 'front')
  if (!hasFront) {
    teamMembers[0].row = 'front'
  }

  return { members: teamMembers }
}

// ─── Battle Trials ────────────────────────────────────────────────

export function runTrials(
  teamAMembers: [CreatureRecord, CreatureRecord, CreatureRecord],
  teamBMembers: [CreatureRecord, CreatureRecord, CreatureRecord],
  trials: number,
): TrialResult[] {
  const results: TrialResult[] = []

  for (let i = 1; i <= trials; i++) {
    const teamA = buildTeam(teamAMembers)
    const teamB = buildTeam(teamBMembers)

    try {
      const result = simulateBattle(teamA, teamB, { seed: i })
      results.push({
        winner: result.winner,
        turns: result.turns,
        teamAHpPercent: result.teamAHpPercent,
        teamBHpPercent: result.teamBHpPercent,
      })
    } catch {
      // Skip trials that fail (bad ability data)
    }
  }

  return results
}

// ─── Team Building with Explicit Rows ────────────────────────────

export function buildTeamWithRows(
  members: [CreatureRecord, CreatureRecord, CreatureRecord],
  rows: [Row, Row, Row],
): BattleTeam {
  const teamMembers = members.map((m, i) => {
    const member = toMember(m, i)
    member.row = rows[i]!
    return member
  }) as [BattleTeamMember, BattleTeamMember, BattleTeamMember]

  const hasFront = teamMembers.some((m) => m.row === 'front')
  if (!hasFront) {
    teamMembers[0]!.row = 'front'
  }

  return { members: teamMembers }
}

// ─── Random Team Sampling ─────────────────────────────────────────

export function sampleTeam(
  creatures: CreatureRecord[],
): [CreatureRecord, CreatureRecord, CreatureRecord] {
  const n = creatures.length
  const i = Math.floor(Math.random() * n)
  let j = Math.floor(Math.random() * (n - 1))
  if (j >= i) j++
  let k = Math.floor(Math.random() * (n - 2))
  if (k >= Math.min(i, j)) k++
  if (k >= Math.max(i, j)) k++

  return [creatures[i]!, creatures[j]!, creatures[k]!]
}

export function summarizeTrials(
  results: TrialResult[],
): TrialSummary {
  if (results.length === 0) {
    return { winsA: 0, winsB: 0, winRateA: 0, avgTurns: 0 }
  }

  let winsA = 0
  let winsB = 0
  let totalTurns = 0

  for (const r of results) {
    if (r.winner === 'A') winsA++
    else if (r.winner === 'B') winsB++
    totalTurns += r.turns
  }

  return {
    winsA,
    winsB,
    winRateA: winsA / results.length,
    avgTurns: totalTurns / results.length,
  }
}
