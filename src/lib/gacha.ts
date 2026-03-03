import { and, eq, gte, inArray, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import {
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
import { toCdnUrl } from './utils'
import type { Rarity } from './types'
import type { Database } from './db/client'

function secureRandom(): number {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return array[0] / (0xffffffff + 1)
}

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

/** Grant fossils as a reward (e.g. level-up bonus) */
export async function grantFossils(
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
  const rand = secureRandom()

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

interface PoolCreature {
  creatureId: string
  rarity: string
  name: string
  scientificName: string
  imageUrl: string | null
  description: string
  era: string
  imageAspectRatio: number | null
}

/** Select a creature from pre-fetched pool data (no DB queries) */
function selectCreatureFromPool(
  poolByRarity: Map<string, Array<PoolCreature>>,
  rarity: Rarity,
  rateUpId: string | null,
): string | null {
  const pool = poolByRarity.get(rarity)
  if (!pool || pool.length === 0) return null

  if (rateUpId) {
    // Rate-up rarity is derived from pool data — no extra DB query needed
    const isRateUpInPool = pool.some((p) => p.creatureId === rateUpId)
    if (isRateUpInPool) {
      if (secureRandom() < RATE_UP_SHARE) return rateUpId
      const others = pool.filter((p) => p.creatureId !== rateUpId)
      if (others.length > 0) {
        return others[Math.floor(secureRandom() * others.length)].creatureId
      }
    }
  }

  return pool[Math.floor(secureRandom() * pool.length)].creatureId
}

export interface PullResult {
  userCreatureId: string
  creatureId: string
  name: string
  scientificName: string
  rarity: Rarity
  imageUrl: string | null
  imageAspectRatio: number | null
  description: string
  era: string
  isNew: boolean
}

/** Execute a batch of gacha pulls with minimal D1 round-trips (~7 vs ~90 for 10-pull) */
export async function executePullBatch(
  db: Database,
  userId: string,
  bannerId: string,
  rateUpId: string | null,
  count: number,
): Promise<Array<PullResult>> {
  // 1. Ensure pity counter exists
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

  // 2. Atomically claim pity slots for this batch (prevents race conditions)
  //    and fetch pool with creature data in parallel
  const [pityRows, poolRows] = await Promise.all([
    db
      .update(pityCounter)
      .set({
        pullsSinceRare: sql`${pityCounter.pullsSinceRare} + ${count}`,
        pullsSinceLegendary: sql`${pityCounter.pullsSinceLegendary} + ${count}`,
        totalPulls: sql`${pityCounter.totalPulls} + ${count}`,
      })
      .where(
        and(eq(pityCounter.userId, userId), eq(pityCounter.bannerId, bannerId)),
      )
      .returning({
        id: pityCounter.id,
        pullsSinceRare: pityCounter.pullsSinceRare,
        pullsSinceLegendary: pityCounter.pullsSinceLegendary,
        totalPulls: pityCounter.totalPulls,
      }),
    db
      .select({
        creatureId: bannerPool.creatureId,
        rarity: creature.rarity,
        name: creature.name,
        scientificName: creature.scientificName,
        imageUrl: creature.imageUrl,
        description: creature.description,
        era: creature.era,
        imageAspectRatio: creature.imageAspectRatio,
      })
      .from(bannerPool)
      .innerJoin(creature, eq(creature.id, bannerPool.creatureId))
      .where(eq(bannerPool.bannerId, bannerId))
      .all(),
  ])

  if (pityRows.length === 0) throw new Error('Failed to update pity counter')
  const pityAfterBatch = pityRows[0]

  // Derive pre-batch pity values from the post-increment returned values
  const preBatchRare = pityAfterBatch.pullsSinceRare - count
  const preBatchLegendary = pityAfterBatch.pullsSinceLegendary - count

  // Group pool by rarity for O(1) lookup
  const poolByRarity = new Map<string, Array<PoolCreature>>()
  for (const row of poolRows) {
    if (!poolByRarity.has(row.rarity)) poolByRarity.set(row.rarity, [])
    poolByRarity.get(row.rarity)!.push(row)
  }

  // Creature data cache from pool
  const creatureCache = new Map<string, PoolCreature>(
    poolRows.map((p) => [p.creatureId, p]),
  )

  // 3. In-memory pull loop — no DB queries
  let pullsSinceRare = preBatchRare
  let pullsSinceLegendary = preBatchLegendary

  const pullData: Array<{
    userCreatureId: string
    creatureId: string
    rarity: Rarity
  }> = []

  for (let i = 0; i < count; i++) {
    const rarity = calculateRarity(pullsSinceRare, pullsSinceLegendary)

    let creatureId = selectCreatureFromPool(poolByRarity, rarity, rateUpId)

    // Fallback: pool missing this rarity (rare edge case)
    if (!creatureId) {
      const fallback = await db
        .select({
          id: creature.id,
          name: creature.name,
          scientificName: creature.scientificName,
          imageUrl: creature.imageUrl,
          description: creature.description,
          era: creature.era,
          rarity: creature.rarity,
          imageAspectRatio: creature.imageAspectRatio,
        })
        .from(creature)
        .where(eq(creature.rarity, rarity))
        .all()
      if (fallback.length === 0)
        throw new Error(`No creatures of rarity: ${rarity}`)
      const picked = fallback[Math.floor(secureRandom() * fallback.length)]
      creatureId = picked.id
      creatureCache.set(creatureId, {
        creatureId,
        rarity: picked.rarity,
        name: picked.name,
        scientificName: picked.scientificName,
        imageUrl: picked.imageUrl,
        description: picked.description,
        era: picked.era,
        imageAspectRatio: picked.imageAspectRatio,
      })
    }

    pullsSinceRare++
    pullsSinceLegendary++

    if (['rare', 'epic', 'legendary'].includes(rarity)) pullsSinceRare = 0
    if (rarity === 'legendary') pullsSinceLegendary = 0

    pullData.push({ userCreatureId: nanoid(), creatureId, rarity })
  }

  // 4. Check isNew for all unique creatures BEFORE inserting (1 query)
  const uniqueCreatureIds = [...new Set(pullData.map((p) => p.creatureId))]
  const existingCounts = await db
    .select({
      creatureId: userCreature.creatureId,
      count: sql<number>`count(*)`,
    })
    .from(userCreature)
    .where(
      and(
        eq(userCreature.userId, userId),
        inArray(userCreature.creatureId, uniqueCreatureIds),
      ),
    )
    .groupBy(userCreature.creatureId)
    .all()
  const existingMap = new Map(
    existingCounts.map((e) => [e.creatureId, e.count]),
  )

  // 5. Write final pity state (with resets) + insert all creatures atomically
  //    The initial atomic increment claimed our slots; now we correct for any resets
  await db.batch([
    db
      .update(pityCounter)
      .set({ pullsSinceRare, pullsSinceLegendary })
      .where(eq(pityCounter.id, pityAfterBatch.id)),
    db.insert(userCreature).values(
      pullData.map((p) => ({
        id: p.userCreatureId,
        userId,
        creatureId: p.creatureId,
        bannerId,
      })),
    ),
  ])

  // 6. Build results from cache
  const seenInBatch = new Map<string, number>()

  return pullData.map((p) => {
    const batchCount = seenInBatch.get(p.creatureId) ?? 0
    seenInBatch.set(p.creatureId, batchCount + 1)

    const isNew = (existingMap.get(p.creatureId) ?? 0) === 0 && batchCount === 0

    const data = creatureCache.get(p.creatureId)
    if (!data) throw new Error(`Creature ${p.creatureId} not found in cache`)

    return {
      userCreatureId: p.userCreatureId,
      creatureId: p.creatureId,
      name: data.name,
      scientificName: data.scientificName,
      rarity: p.rarity,
      imageUrl: toCdnUrl(data.imageUrl),
      imageAspectRatio: data.imageAspectRatio,
      description: data.description,
      era: data.era,
      isNew,
    }
  })
}
