import { and, count, eq, inArray, lt, or } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { simulateBattle } from '@paleo-waifu/shared/battle/engine'
import {
  ALL_ABILITY_TEMPLATES,
  BASIC_ATTACK,
  templateToAbility,
} from '@paleo-waifu/shared/battle/constants'
import {
  battleChallenge,
  battleRating,
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

  // Load user creatures with joined creature + battle stats
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

  // Load abilities for these creatures
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

  // Build BattleTeamMember array in slot order
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

// ─── Challenge Validation ─────────────────────────────────────────

const MAX_OUTGOING = 3
const MAX_INCOMING = 5
const CHALLENGE_TTL_MS = 24 * 60 * 60 * 1000

export async function validateChallenge(
  db: Database,
  challengerId: string,
  defenderId: string,
): Promise<string | null> {
  if (challengerId === defenderId) return 'You cannot challenge yourself.'

  // Check defender exists
  const defender = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, defenderId))
    .get()
  if (!defender) return 'User not found.'

  // Count outgoing pending challenges
  const [outgoing] = await db
    .select({ total: count() })
    .from(battleChallenge)
    .where(
      and(
        eq(battleChallenge.challengerId, challengerId),
        eq(battleChallenge.status, 'pending'),
      ),
    )
  if (outgoing.total >= MAX_OUTGOING)
    return `You already have ${MAX_OUTGOING} active challenges. Cancel one first.`

  // Count incoming pending challenges for defender
  const [incoming] = await db
    .select({ total: count() })
    .from(battleChallenge)
    .where(
      and(
        eq(battleChallenge.defenderId, defenderId),
        eq(battleChallenge.status, 'pending'),
      ),
    )
  if (incoming.total >= MAX_INCOMING)
    return 'That player has too many pending challenges.'

  // Check for existing pending challenge between these two
  const existing = await db
    .select({ id: battleChallenge.id })
    .from(battleChallenge)
    .where(
      and(
        eq(battleChallenge.status, 'pending'),
        or(
          and(
            eq(battleChallenge.challengerId, challengerId),
            eq(battleChallenge.defenderId, defenderId),
          ),
          and(
            eq(battleChallenge.challengerId, defenderId),
            eq(battleChallenge.defenderId, challengerId),
          ),
        ),
      ),
    )
    .get()
  if (existing) return 'A challenge already exists between you and this player.'

  return null
}

// ─── Challenge Creation ───────────────────────────────────────────

export async function createChallenge(
  db: Database,
  challengerId: string,
  defenderId: string,
  team: Array<TeamSlotInput>,
): Promise<{ id: string }> {
  const id = nanoid()
  await db.insert(battleChallenge).values({
    id,
    challengerId,
    defenderId,
    status: 'pending',
    challengerTeam: JSON.stringify(team),
  })
  return { id }
}

// ─── Battle Resolution ────────────────────────────────────────────

const RATING_WIN = 25
const RATING_LOSS = 20

export async function resolveBattle(
  db: Database,
  challengeId: string,
  defenderId: string,
  defenderTeam: Array<TeamSlotInput>,
): Promise<
  { success: true; battleId: string } | { success: false; error: string }
> {
  // Atomically claim the challenge to prevent double resolution
  const claimed = await db
    .update(battleChallenge)
    .set({ status: 'resolving' })
    .where(
      and(
        eq(battleChallenge.id, challengeId),
        eq(battleChallenge.defenderId, defenderId),
        eq(battleChallenge.status, 'pending'),
      ),
    )
    .returning()

  if (!claimed.length)
    return { success: false, error: 'Challenge not found or already resolved.' }

  const challenge = claimed[0]

  // Check expiry
  if (
    challenge.createdAt &&
    Date.now() - challenge.createdAt.getTime() > CHALLENGE_TTL_MS
  ) {
    await db
      .update(battleChallenge)
      .set({ status: 'expired' })
      .where(eq(battleChallenge.id, challengeId))
    return { success: false, error: 'Challenge has expired.' }
  }

  // Hydrate both teams
  let challengerMembers: Array<BattleTeamMember>
  let defenderMembers: Array<BattleTeamMember>
  try {
    const challengerSlots: Array<TeamSlotInput> = JSON.parse(
      challenge.challengerTeam,
    )
    ;[challengerMembers, defenderMembers] = await Promise.all([
      hydrateTeam(db, challengerSlots, challenge.challengerId),
      hydrateTeam(db, defenderTeam, defenderId),
    ])
  } catch {
    // Revert status back to pending if hydration fails (e.g., creature traded away)
    await db
      .update(battleChallenge)
      .set({ status: 'pending' })
      .where(eq(battleChallenge.id, challengeId))
    return {
      success: false,
      error: 'One or more creatures are no longer available.',
    }
  }

  const teamA: BattleTeam = {
    members: challengerMembers as [
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

  // Run battle
  const seed = Math.floor(Math.random() * 2 ** 31)
  const result = simulateBattle(teamA, teamB, { seed })

  const winnerId =
    result.winner === 'A'
      ? challenge.challengerId
      : result.winner === 'B'
        ? defenderId
        : null
  // Read current ratings
  const [ratingA, ratingB] = await Promise.all([
    db
      .select()
      .from(battleRating)
      .where(eq(battleRating.userId, challenge.challengerId))
      .get(),
    db
      .select()
      .from(battleRating)
      .where(eq(battleRating.userId, defenderId))
      .get(),
  ])

  const challengerRating = ratingA?.rating ?? 0
  const defenderRating = ratingB?.rating ?? 0

  // Compute new ratings
  let newChallengerRating = challengerRating
  let newDefenderRating = defenderRating
  let challengerWins = ratingA?.wins ?? 0
  let challengerLosses = ratingA?.losses ?? 0
  let defenderWins = ratingB?.wins ?? 0
  let defenderLosses = ratingB?.losses ?? 0

  if (winnerId === challenge.challengerId) {
    newChallengerRating = challengerRating + RATING_WIN
    newDefenderRating = Math.max(0, defenderRating - RATING_LOSS)
    challengerWins++
    defenderLosses++
  } else if (winnerId === defenderId) {
    newDefenderRating = defenderRating + RATING_WIN
    newChallengerRating = Math.max(0, challengerRating - RATING_LOSS)
    defenderWins++
    challengerLosses++
  }

  const now = new Date()

  // Batch update: challenge result + ratings
  await db.batch([
    db
      .update(battleChallenge)
      .set({
        defenderTeam: JSON.stringify(defenderTeam),
        result: JSON.stringify(result),
        status: 'resolved',
        winnerId,
        resolvedAt: now,
      })
      .where(eq(battleChallenge.id, challengeId)),
    // Upsert challenger rating
    db
      .insert(battleRating)
      .values({
        userId: challenge.challengerId,
        rating: newChallengerRating,
        wins: challengerWins,
        losses: challengerLosses,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: battleRating.userId,
        set: {
          rating: newChallengerRating,
          wins: challengerWins,
          losses: challengerLosses,
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

  return { success: true, battleId: challengeId }
}

// ─── Expire Stale Challenges ──────────────────────────────────────

export async function expireStaleChallenges(db: Database): Promise<void> {
  const cutoff = new Date(Date.now() - CHALLENGE_TTL_MS)
  await db
    .update(battleChallenge)
    .set({ status: 'expired' })
    .where(
      and(
        eq(battleChallenge.status, 'pending'),
        lt(battleChallenge.createdAt, cutoff),
      ),
    )
}

// ─── Arena Tier ───────────────────────────────────────────────────

export function getArenaTier(rating: number): string {
  if (rating >= 2000) return 'Apex'
  if (rating >= 1500) return 'Diamond'
  if (rating >= 1000) return 'Gold'
  if (rating >= 500) return 'Silver'
  return 'Bronze'
}
