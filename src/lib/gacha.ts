import { and, eq, gte, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import {
  banner,
  bannerPool,
  creature,
  currency,
  pityCounter,
  userCreature,
} from './db/schema'
import {
  BASE_RATES,
  DAILY_FOSSILS,
  HARD_PITY_THRESHOLD,
  NEW_USER_BONUS,
  RATE_UP_SHARE,
  SOFT_PITY_THRESHOLD,
} from './types'
import type { Rarity } from './types'
import type { Database } from './db/client'

/** Ensure new user gets their starter Fossils */
export async function ensureUserCurrency(db: Database, userId: string) {
  await db
    .insert(currency)
    .values({
      id: nanoid(),
      userId,
      fossils: NEW_USER_BONUS,
    })
    .onConflictDoNothing()
}

/** Get user's current fossil count */
export async function getFossils(
  db: Database,
  userId: string,
): Promise<number> {
  const row = await db
    .select({ fossils: currency.fossils })
    .from(currency)
    .where(eq(currency.userId, userId))
    .get()
  return row?.fossils ?? 0
}

/** Deduct fossils atomically — returns false if insufficient */
export async function deductFossils(
  db: Database,
  userId: string,
  amount: number,
): Promise<boolean> {
  const result = await db
    .update(currency)
    .set({
      fossils: sql`${currency.fossils} - ${amount}`,
      updatedAt: sql`(unixepoch())`,
    })
    .where(and(eq(currency.userId, userId), gte(currency.fossils, amount)))
    .returning({ fossils: currency.fossils })

  return result.length > 0
}

/** Refund fossils (used when pulls fail after deduction) */
export async function refundFossils(
  db: Database,
  userId: string,
  amount: number,
): Promise<void> {
  await db
    .update(currency)
    .set({
      fossils: sql`${currency.fossils} + ${amount}`,
      updatedAt: sql`(unixepoch())`,
    })
    .where(eq(currency.userId, userId))
}

/** Claim daily fossils if not already claimed today */
export async function claimDaily(
  db: Database,
  userId: string,
): Promise<{ claimed: boolean; fossils: number }> {
  const now = Math.floor(Date.now() / 1000)
  const startOfDay = now - (now % 86400)

  // Try to update only if last claim was before today
  const result = await db
    .update(currency)
    .set({
      fossils: sql`${currency.fossils} + ${DAILY_FOSSILS}`,
      lastDailyClaim: sql`(unixepoch())`,
      updatedAt: sql`(unixepoch())`,
    })
    .where(
      and(
        eq(currency.userId, userId),
        sql`(${currency.lastDailyClaim} IS NULL OR ${currency.lastDailyClaim} < ${startOfDay})`,
      ),
    )
    .returning({ fossils: currency.fossils })

  if (result.length > 0) {
    return { claimed: true, fossils: result[0].fossils }
  }

  const current = await getFossils(db, userId)
  return { claimed: false, fossils: current }
}

/** Calculate adjusted rarity rates based on pity */
function calculateRarity(
  pullsSinceRare: number,
  pullsSinceLegendary: number,
): Rarity {
  const rand = Math.random()

  // Hard pity: guaranteed legendary at 90
  if (pullsSinceLegendary >= HARD_PITY_THRESHOLD) {
    return 'legendary'
  }

  // Soft pity for legendary: double rate each pull past threshold
  let legendaryRate = BASE_RATES.legendary
  if (pullsSinceLegendary >= SOFT_PITY_THRESHOLD) {
    const extraPulls = pullsSinceLegendary - SOFT_PITY_THRESHOLD
    legendaryRate = BASE_RATES.legendary * Math.pow(2, extraPulls + 1)
  }

  // Soft pity for rare+: after 50 pulls with no rare, double rate
  let rareRate = BASE_RATES.rare
  let epicRate = BASE_RATES.epic
  if (pullsSinceRare >= SOFT_PITY_THRESHOLD) {
    const extraPulls = pullsSinceRare - SOFT_PITY_THRESHOLD
    const multiplier = Math.pow(2, extraPulls + 1)
    rareRate = BASE_RATES.rare * multiplier
    epicRate = BASE_RATES.epic * multiplier
  }

  // Normalize and roll
  const total =
    BASE_RATES.common +
    BASE_RATES.uncommon +
    rareRate +
    epicRate +
    legendaryRate
  const commonNorm = BASE_RATES.common / total
  const uncommonNorm = BASE_RATES.uncommon / total
  const rareNorm = rareRate / total
  const epicNorm = epicRate / total

  if (rand < commonNorm) return 'common'
  if (rand < commonNorm + uncommonNorm) return 'uncommon'
  if (rand < commonNorm + uncommonNorm + rareNorm) return 'rare'
  if (rand < commonNorm + uncommonNorm + rareNorm + epicNorm) return 'epic'
  return 'legendary'
}

/** Select a creature from the banner pool at the given rarity, respecting rate-up */
async function selectCreature(
  db: Database,
  bannerId: string,
  rarity: Rarity,
  rateUpId: string | null,
): Promise<string> {
  // Get all creatures of this rarity in the banner pool
  const pool = await db
    .select({ creatureId: bannerPool.creatureId })
    .from(bannerPool)
    .innerJoin(creature, eq(creature.id, bannerPool.creatureId))
    .where(and(eq(bannerPool.bannerId, bannerId), eq(creature.rarity, rarity)))
    .all()

  if (pool.length === 0) {
    // Fallback: any creature of this rarity
    const fallback = await db
      .select({ id: creature.id })
      .from(creature)
      .where(eq(creature.rarity, rarity))
      .all()
    if (fallback.length === 0)
      throw new Error(`No creatures of rarity: ${rarity}`)
    return fallback[Math.floor(Math.random() * fallback.length)].id
  }

  // Rate-up: featured creature gets 50% of its rarity's share
  if (rateUpId) {
    const isRateUpInPool = pool.some((p) => p.creatureId === rateUpId)
    const rateUpCreature = await db
      .select({ rarity: creature.rarity })
      .from(creature)
      .where(eq(creature.id, rateUpId))
      .get()

    if (isRateUpInPool && rateUpCreature?.rarity === rarity) {
      if (Math.random() < RATE_UP_SHARE) {
        return rateUpId
      }
      // Otherwise pick from the rest
      const others = pool.filter((p) => p.creatureId !== rateUpId)
      if (others.length > 0) {
        return others[Math.floor(Math.random() * others.length)].creatureId
      }
    }
  }

  return pool[Math.floor(Math.random() * pool.length)].creatureId
}

export interface PullResult {
  userCreatureId: string
  creatureId: string
  name: string
  scientificName: string
  rarity: Rarity
  imageUrl: string | null
  description: string
  era: string
  isNew: boolean
}

/** Execute a single gacha pull */
export async function executePull(
  db: Database,
  userId: string,
  bannerId: string,
): Promise<PullResult> {
  // Get banner details
  const bannerRow = await db
    .select()
    .from(banner)
    .where(and(eq(banner.id, bannerId), eq(banner.isActive, true)))
    .get()

  if (!bannerRow) throw new Error('Banner not found or inactive')

  // Get or create pity counter (INSERT ON CONFLICT DO NOTHING to avoid race condition)
  await db
    .insert(pityCounter)
    .values({
      id: nanoid(),
      userId,
      bannerId,
      pullsSinceRare: 0,
      pullsSinceLegendary: 0,
      totalPulls: 0,
    })
    .onConflictDoNothing()

  const pity = await db
    .select()
    .from(pityCounter)
    .where(
      and(eq(pityCounter.userId, userId), eq(pityCounter.bannerId, bannerId)),
    )
    .get()

  if (!pity) throw new Error('Failed to create pity counter')

  // Roll rarity
  const rarity = calculateRarity(pity.pullsSinceRare, pity.pullsSinceLegendary)

  // Select creature
  const creatureId = await selectCreature(
    db,
    bannerId,
    rarity,
    bannerRow.rateUpId,
  )

  // Create user creature instance
  const userCreatureId = nanoid()
  await db.insert(userCreature).values({
    id: userCreatureId,
    userId,
    creatureId,
    bannerId,
  })

  // Check if this is a new species for the user
  const existingCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(userCreature)
    .where(
      and(
        eq(userCreature.userId, userId),
        eq(userCreature.creatureId, creatureId),
      ),
    )
    .get()
  const isNew = (existingCount?.count ?? 0) <= 1

  // Update pity counter
  const isRarePlus = ['rare', 'epic', 'legendary'].includes(rarity)
  const isLegendary = rarity === 'legendary'

  await db
    .update(pityCounter)
    .set({
      pullsSinceRare: isRarePlus ? 0 : sql`${pityCounter.pullsSinceRare} + 1`,
      pullsSinceLegendary: isLegendary
        ? 0
        : sql`${pityCounter.pullsSinceLegendary} + 1`,
      totalPulls: sql`${pityCounter.totalPulls} + 1`,
    })
    .where(eq(pityCounter.id, pity.id))

  // Get full creature data
  const creatureData = await db
    .select()
    .from(creature)
    .where(eq(creature.id, creatureId))
    .get()

  if (!creatureData) throw new Error('Creature not found')

  return {
    userCreatureId,
    creatureId,
    name: creatureData.name,
    scientificName: creatureData.scientificName,
    rarity: creatureData.rarity as Rarity,
    imageUrl: creatureData.imageUrl,
    description: creatureData.description,
    era: creatureData.era,
    isNew,
  }
}
