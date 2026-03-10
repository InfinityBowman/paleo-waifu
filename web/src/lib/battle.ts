import { and, eq, inArray, ne } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { simulateBattle } from '@paleo-waifu/shared/battle/engine'
import {
  ALL_ABILITY_TEMPLATES,
  BASIC_ATTACK,
  templateToAbility,
} from '@paleo-waifu/shared/battle/constants'
import {
  battleLog,
  battleRating,
  battleTeam,
  creature,
  creatureAbility,
  creatureBattleStats,
  user,
  userCreature,
} from '@paleo-waifu/shared/db/schema'
import type {
  Ability,
  BattleTeam,
  BattleTeamMember,
  Role,
  Row,
} from '@paleo-waifu/shared/battle/types'
import type { Database } from '@paleo-waifu/shared/db/client'

// ─── Template Lookup ──────────────────────────────────────────────

const TEMPLATE_MAP = new Map(ALL_ABILITY_TEMPLATES.map((t) => [t.id, t]))

function resolveAbility(templateId: string, displayName: string): Ability {
  const template = TEMPLATE_MAP.get(templateId)
  if (!template) return BASIC_ATTACK
  return templateToAbility(template, displayName)
}

// ─── Team Hydration ───────────────────────────────────────────────

export interface TeamSlotInput {
  userCreatureId: string
  row: Row
}

/** Hydrate team slots into BattleTeamMember[] by loading creature + stats + abilities from DB */
export async function hydrateTeam(
  db: Database,
  slots: Array<TeamSlotInput>,
  userId: string,
): Promise<Array<BattleTeamMember>> {
  const ucIds = slots.map((s) => s.userCreatureId)

  const rows = await db
    .select({
      ucId: userCreature.id,
      creatureId: creature.id,
      name: creature.name,
      diet: creature.diet,
      type: creature.type,
      era: creature.era,
      rarity: creature.rarity,
      role: creatureBattleStats.role,
      hp: creatureBattleStats.hp,
      atk: creatureBattleStats.atk,
      def: creatureBattleStats.def,
      spd: creatureBattleStats.spd,
    })
    .from(userCreature)
    .innerJoin(creature, eq(creature.id, userCreature.creatureId))
    .innerJoin(
      creatureBattleStats,
      eq(creatureBattleStats.creatureId, creature.id),
    )
    .where(
      and(eq(userCreature.userId, userId), inArray(userCreature.id, ucIds)),
    )
    .all()

  if (rows.length !== 3) {
    throw new Error('Not all creatures are battle-ready or owned by this user')
  }

  const creatureIds = rows.map((r) => r.creatureId)
  const abilities = await db
    .select({
      creatureId: creatureAbility.creatureId,
      templateId: creatureAbility.templateId,
      slot: creatureAbility.slot,
      displayName: creatureAbility.displayName,
    })
    .from(creatureAbility)
    .where(inArray(creatureAbility.creatureId, creatureIds))
    .all()

  const abilityMap = new Map<string, { active?: Ability; passive?: Ability }>()
  for (const a of abilities) {
    const entry = abilityMap.get(a.creatureId) ?? {}
    if (a.slot === 'active') {
      entry.active = resolveAbility(a.templateId, a.displayName)
    } else {
      entry.passive = resolveAbility(a.templateId, a.displayName)
    }
    abilityMap.set(a.creatureId, entry)
  }

  const rowMap = new Map(slots.map((s) => [s.userCreatureId, s.row]))
  return rows.map((r) => {
    const abs = abilityMap.get(r.creatureId) ?? {}
    return {
      creatureId: r.creatureId,
      name: r.name,
      role: r.role as Role,
      stats: { hp: r.hp, atk: r.atk, def: r.def, spd: r.spd },
      active: abs.active ?? BASIC_ATTACK,
      passive: abs.passive ?? {
        ...BASIC_ATTACK,
        id: 'none',
        name: 'None',
        displayName: 'None',
        trigger: { type: 'always' as const },
        effects: [],
        description: 'No passive ability.',
      },
      diet: r.diet,
      type: r.type ?? '',
      era: r.era,
      rarity: r.rarity,
      row: rowMap.get(r.ucId)!,
    }
  })
}

// ─── Team CRUD ────────────────────────────────────────────────────

export async function setTeam(
  db: Database,
  userId: string,
  slot: 'offense' | 'defense',
  members: Array<TeamSlotInput>,
): Promise<{ id: string }> {
  const id = nanoid()
  await db
    .insert(battleTeam)
    .values({
      id,
      userId,
      slot,
      members: JSON.stringify(members),
    })
    .onConflictDoUpdate({
      target: [battleTeam.userId, battleTeam.slot],
      set: {
        members: JSON.stringify(members),
        updatedAt: new Date(),
      },
    })
  return { id }
}

export async function deleteTeam(
  db: Database,
  userId: string,
  slot: 'offense' | 'defense',
): Promise<boolean> {
  const deleted = await db
    .delete(battleTeam)
    .where(and(eq(battleTeam.userId, userId), eq(battleTeam.slot, slot)))
    .returning({ id: battleTeam.id })
  return deleted.length > 0
}

export async function getTeams(
  db: Database,
  userId: string,
): Promise<{
  offense: Array<TeamSlotInput> | null
  defense: Array<TeamSlotInput> | null
}> {
  const rows = await db
    .select({ slot: battleTeam.slot, members: battleTeam.members })
    .from(battleTeam)
    .where(eq(battleTeam.userId, userId))
    .all()

  let offense: Array<TeamSlotInput> | null = null
  let defense: Array<TeamSlotInput> | null = null
  for (const r of rows) {
    const members = JSON.parse(r.members) as Array<TeamSlotInput>
    if (r.slot === 'offense') offense = members
    else if (r.slot === 'defense') defense = members
  }
  return { offense, defense }
}

// ─── Arena Matchmaking ───────────────────────────────────────────

const ARENA_DAILY_LIMIT = 5
const RATING_RANGE = 300

export { ARENA_DAILY_LIMIT }

export interface ArenaOpponent {
  userId: string
  name: string
  image: string | null
  rating: number
  tier: string
  defenseTeam: Array<TeamSlotInput>
}

/** Find ~4 opponents near the attacker's rating who have defense teams */
export async function findArenaOpponents(
  db: Database,
  attackerId: string,
  attackerRating: number,
): Promise<Array<ArenaOpponent>> {
  // Find users with defense teams, excluding the attacker
  const opponents = await db
    .select({
      userId: battleTeam.userId,
      members: battleTeam.members,
      name: user.name,
      image: user.image,
    })
    .from(battleTeam)
    .innerJoin(user, eq(user.id, battleTeam.userId))
    .where(
      and(eq(battleTeam.slot, 'defense'), ne(battleTeam.userId, attackerId)),
    )
    .all()

  if (opponents.length === 0) return []

  // Get ratings for all opponent candidates
  const opponentIds = opponents.map((o) => o.userId)
  const ratings = await db
    .select({ userId: battleRating.userId, rating: battleRating.rating })
    .from(battleRating)
    .where(inArray(battleRating.userId, opponentIds))
    .all()
  const ratingMap = new Map(ratings.map((r) => [r.userId, r.rating]))

  // Score by rating proximity, shuffle within range
  const scored = opponents.map((o) => {
    const rating = ratingMap.get(o.userId) ?? 0
    const distance = Math.abs(rating - attackerRating)
    return { ...o, rating, distance }
  })

  // Filter to within range, then take closest 4 (with some randomness)
  const inRange = scored.filter((o) => o.distance <= RATING_RANGE)
  const pool = inRange.length >= 4 ? inRange : scored

  // Shuffle and take 4
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }

  return pool.slice(0, 4).map((o) => ({
    userId: o.userId,
    name: o.name,
    image: o.image,
    rating: o.rating,
    tier: getArenaTier(o.rating),
    defenseTeam: JSON.parse(o.members) as Array<TeamSlotInput>,
  }))
}

// ─── Daily Limit ─────────────────────────────────────────────────

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function checkDailyLimit(
  db: Database,
  userId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const row = await db
    .select({
      arenaAttacksToday: battleRating.arenaAttacksToday,
      lastAttackDate: battleRating.lastAttackDate,
    })
    .from(battleRating)
    .where(eq(battleRating.userId, userId))
    .get()

  const today = todayUTC()
  const attacks =
    row && row.lastAttackDate === today ? row.arenaAttacksToday : 0
  const remaining = ARENA_DAILY_LIMIT - attacks
  return { allowed: remaining > 0, remaining: Math.max(0, remaining) }
}

// ─── Battle Execution ────────────────────────────────────────────

const RATING_WIN = 25
const RATING_LOSS = 20

interface BattleExecResult {
  success: true
  battleId: string
  winnerId: string | null
  turns: number
  reason: string
  attackerRatingAfter: number
  defenderRatingAfter: number
  attackerDelta: number
  defenderDelta: number
}

interface BattleExecError {
  success: false
  error: string
}

/** Execute an arena battle — updates ratings and daily counter */
export async function executeArenaBattle(
  db: Database,
  attackerId: string,
  defenderId: string,
  attackerSlots: Array<TeamSlotInput>,
  defenderSlots: Array<TeamSlotInput>,
): Promise<BattleExecResult | BattleExecError> {
  // Check daily limit
  const limit = await checkDailyLimit(db, attackerId)
  if (!limit.allowed) {
    return {
      success: false,
      error: 'You have no arena attacks remaining today.',
    }
  }

  // Hydrate teams
  let attackerMembers: Array<BattleTeamMember>
  let defenderMembers: Array<BattleTeamMember>
  try {
    ;[attackerMembers, defenderMembers] = await Promise.all([
      hydrateTeam(db, attackerSlots, attackerId),
      hydrateTeam(db, defenderSlots, defenderId),
    ])
  } catch {
    return {
      success: false,
      error: 'One or more creatures are no longer available.',
    }
  }

  const teamA: BattleTeam = {
    members: attackerMembers as [
      BattleTeamMember,
      BattleTeamMember,
      BattleTeamMember,
    ],
  }
  const teamB: BattleTeam = {
    members: defenderMembers as [
      BattleTeamMember,
      BattleTeamMember,
      BattleTeamMember,
    ],
  }

  const seed = Math.floor(Math.random() * 2 ** 31)
  const result = simulateBattle(teamA, teamB, { seed })

  const winnerId =
    result.winner === 'A'
      ? attackerId
      : result.winner === 'B'
        ? defenderId
        : null

  // Read current ratings
  const [ratingA, ratingB] = await Promise.all([
    db
      .select()
      .from(battleRating)
      .where(eq(battleRating.userId, attackerId))
      .get(),
    db
      .select()
      .from(battleRating)
      .where(eq(battleRating.userId, defenderId))
      .get(),
  ])

  const attackerRating = ratingA?.rating ?? 0
  const defenderRating = ratingB?.rating ?? 0

  let newAttackerRating = attackerRating
  let newDefenderRating = defenderRating
  let attackerWins = ratingA?.wins ?? 0
  let attackerLosses = ratingA?.losses ?? 0
  let defenderWins = ratingB?.wins ?? 0
  let defenderLosses = ratingB?.losses ?? 0

  let attackerDelta = 0
  let defenderDelta = 0

  if (winnerId === attackerId) {
    attackerDelta = RATING_WIN
    defenderDelta = -RATING_LOSS
    newAttackerRating = attackerRating + RATING_WIN
    newDefenderRating = Math.max(0, defenderRating - RATING_LOSS)
    attackerWins++
    defenderLosses++
  } else if (winnerId === defenderId) {
    attackerDelta = -RATING_LOSS
    defenderDelta = RATING_WIN
    newAttackerRating = Math.max(0, attackerRating - RATING_LOSS)
    newDefenderRating = defenderRating + RATING_WIN
    defenderWins++
    attackerLosses++
  }

  const now = new Date()
  const today = todayUTC()
  const battleId = nanoid()

  // Daily attack counter
  const prevAttacks =
    ratingA && ratingA.lastAttackDate === today ? ratingA.arenaAttacksToday : 0

  await db.batch([
    // Insert battle log
    db.insert(battleLog).values({
      id: battleId,
      attackerId,
      defenderId,
      mode: 'arena',
      attackerTeam: JSON.stringify(attackerSlots),
      defenderTeam: JSON.stringify(defenderSlots),
      result: JSON.stringify(result),
      winnerId,
      ratingChange: attackerDelta,
      createdAt: now,
    }),
    // Upsert attacker rating + daily counter
    db
      .insert(battleRating)
      .values({
        userId: attackerId,
        rating: newAttackerRating,
        wins: attackerWins,
        losses: attackerLosses,
        arenaAttacksToday: prevAttacks + 1,
        lastAttackDate: today,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: battleRating.userId,
        set: {
          rating: newAttackerRating,
          wins: attackerWins,
          losses: attackerLosses,
          arenaAttacksToday: prevAttacks + 1,
          lastAttackDate: today,
          updatedAt: now,
        },
      }),
    // Upsert defender rating
    db
      .insert(battleRating)
      .values({
        userId: defenderId,
        rating: newDefenderRating,
        wins: defenderWins,
        losses: defenderLosses,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: battleRating.userId,
        set: {
          rating: newDefenderRating,
          wins: defenderWins,
          losses: defenderLosses,
          updatedAt: now,
        },
      }),
  ])

  return {
    success: true,
    battleId,
    winnerId,
    turns: result.turns,
    reason: result.reason,
    attackerRatingAfter: newAttackerRating,
    defenderRatingAfter: newDefenderRating,
    attackerDelta,
    defenderDelta,
  }
}

/** Execute a friendly battle — no rating change, no daily limit */
export async function executeFriendlyBattle(
  db: Database,
  attackerId: string,
  defenderId: string,
  attackerSlots: Array<TeamSlotInput>,
  defenderSlots: Array<TeamSlotInput>,
): Promise<BattleExecResult | BattleExecError> {
  // Hydrate teams
  let attackerMembers: Array<BattleTeamMember>
  let defenderMembers: Array<BattleTeamMember>
  try {
    ;[attackerMembers, defenderMembers] = await Promise.all([
      hydrateTeam(db, attackerSlots, attackerId),
      hydrateTeam(db, defenderSlots, defenderId),
    ])
  } catch {
    return {
      success: false,
      error: 'One or more creatures are no longer available.',
    }
  }

  const teamA: BattleTeam = {
    members: attackerMembers as [
      BattleTeamMember,
      BattleTeamMember,
      BattleTeamMember,
    ],
  }
  const teamB: BattleTeam = {
    members: defenderMembers as [
      BattleTeamMember,
      BattleTeamMember,
      BattleTeamMember,
    ],
  }

  const seed = Math.floor(Math.random() * 2 ** 31)
  const result = simulateBattle(teamA, teamB, { seed })

  const winnerId =
    result.winner === 'A'
      ? attackerId
      : result.winner === 'B'
        ? defenderId
        : null

  const battleId = nanoid()

  await db.insert(battleLog).values({
    id: battleId,
    attackerId,
    defenderId,
    mode: 'friendly',
    attackerTeam: JSON.stringify(attackerSlots),
    defenderTeam: JSON.stringify(defenderSlots),
    result: JSON.stringify(result),
    winnerId,
    ratingChange: null,
    createdAt: new Date(),
  })

  // Read ratings for display (not modified)
  const [ratingA, ratingB] = await Promise.all([
    db
      .select()
      .from(battleRating)
      .where(eq(battleRating.userId, attackerId))
      .get(),
    db
      .select()
      .from(battleRating)
      .where(eq(battleRating.userId, defenderId))
      .get(),
  ])

  return {
    success: true,
    battleId,
    winnerId,
    turns: result.turns,
    reason: result.reason,
    attackerRatingAfter: ratingA?.rating ?? 0,
    defenderRatingAfter: ratingB?.rating ?? 0,
    attackerDelta: 0,
    defenderDelta: 0,
  }
}

// ─── Arena Tier ───────────────────────────────────────────────────

export function getArenaTier(rating: number): string {
  if (rating >= 2000) return 'Apex'
  if (rating >= 1500) return 'Diamond'
  if (rating >= 1000) return 'Gold'
  if (rating >= 500) return 'Silver'
  return 'Bronze'
}
