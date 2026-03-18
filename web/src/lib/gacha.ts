import { and, eq, gte, inArray, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import {
  banner,
  bannerPool,
  creature,
  creatureBattleStats,
  currency,
  pityCounter,
  userCreature,
} from '@paleo-waifu/shared/db/schema'
import {
  DAILY_FOSSILS,
  MULTI_PULL_COUNT,
  NEW_USER_BONUS,
  PULL_COST_MULTI,
  PULL_COST_SINGLE,
} from '@paleo-waifu/shared/types'
import {
  calculateRarity,
  selectCreatureFromPool,
} from '@paleo-waifu/shared/gacha'
import type { PoolCreature } from '@paleo-waifu/shared/gacha'
import type { Rarity } from '@paleo-waifu/shared/types'
import type { Database } from '@paleo-waifu/shared/db/client'

function secureRandom(): number {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return array[0] / (0xffffffff + 1)
}

// ---------------------------------------------------------------------------
// Currency operations
// ---------------------------------------------------------------------------

/** Ensure new user gets their starter Fossils */
async function ensureUserCurrency(db: Database, userId: string) {
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
async function getFossils(db: Database, userId: string): Promise<number> {
  const row = await db
    .select({ fossils: currency.fossils })
    .from(currency)
    .where(eq(currency.userId, userId))
    .get()
  return row?.fossils ?? 0
}

/** Deduct fossils atomically — returns new balance, or null if insufficient */
async function deductFossils(
  db: Database,
  userId: string,
  amount: number,
): Promise<number | null> {
  const result = await db
    .update(currency)
    .set({
      fossils: sql`${currency.fossils} - ${amount}`,
      updatedAt: sql`(unixepoch())`,
    })
    .where(and(eq(currency.userId, userId), gte(currency.fossils, amount)))
    .returning({ fossils: currency.fossils })

  return result.length > 0 ? result[0].fossils : null
}

/** Grant fossils as a reward (e.g. level-up bonus) */
async function grantFossils(
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
async function refundFossils(
  db: Database,
  userId: string,
  amount: number,
): Promise<void> {
  await grantFossils(db, userId, amount)
}

export const fossils = {
  ensure: ensureUserCurrency,
  get: getFossils,
  deduct: deductFossils,
  grant: grantFossils,
  refund: refundFossils,
}

// ---------------------------------------------------------------------------
// Daily claim
// ---------------------------------------------------------------------------

/** Claim daily fossils if not already claimed today */
export async function claimDaily(
  db: Database,
  userId: string,
): Promise<{ claimed: boolean; fossils: number }> {
  const now = Math.floor(Date.now() / 1000)
  const startOfDay = now - (now % 86400)

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

// ---------------------------------------------------------------------------
// Pull types
// ---------------------------------------------------------------------------

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
  isBattleReady: boolean
}

export type PullOutcome =
  | { ok: true; results: Array<PullResult>; fossils: number }
  | { ok: false; reason: 'insufficient_fossils'; fossils: number }
  | { ok: false; reason: 'banner_not_found' }
  | { ok: false; reason: 'pull_error'; fossils: number }

export interface PullOptions {
  mode: 'single' | 'multi'
  bannerId: string
  /** Pass toCdnUrl for web; omit for bot (identity) */
  transformImageUrl?: (url: string | null) => string | null
  /** Injectable RNG for testing; defaults to secureRandom() */
  rng?: () => number
}

// ---------------------------------------------------------------------------
// Pull orchestration
// ---------------------------------------------------------------------------

/** Full pull flow: validate banner → deduct fossils → execute batch → refund on error */
export async function pull(
  db: Database,
  userId: string,
  options: PullOptions,
): Promise<PullOutcome> {
  const { mode, bannerId, transformImageUrl, rng } = options

  // Validate banner exists and is active, fetch rateUpId
  const bannerRow = await db
    .select({ id: banner.id, rateUpId: banner.rateUpId })
    .from(banner)
    .where(and(eq(banner.id, bannerId), eq(banner.isActive, true)))
    .get()

  if (!bannerRow) {
    return { ok: false, reason: 'banner_not_found' }
  }

  const isMulti = mode === 'multi'
  const cost = isMulti ? PULL_COST_MULTI : PULL_COST_SINGLE
  const pullCount = isMulti ? MULTI_PULL_COUNT : 1

  // Deduct currency
  const afterDeduct = await deductFossils(db, userId, cost)
  if (afterDeduct == null) {
    const balance = await getFossils(db, userId)
    return { ok: false, reason: 'insufficient_fossils', fossils: balance }
  }

  // Execute batched pulls — pity + creature inserts are atomic,
  // so on failure nothing is written and we only need to refund fossils
  try {
    const results = await executePullBatch(
      db,
      userId,
      bannerId,
      bannerRow.rateUpId,
      pullCount,
      transformImageUrl,
      rng,
    )
    return { ok: true, results, fossils: afterDeduct }
  } catch {
    await refundFossils(db, userId, cost)
    const balance = await getFossils(db, userId)
    return { ok: false, reason: 'pull_error', fossils: balance }
  }
}

// ---------------------------------------------------------------------------
// Internal batch execution
// ---------------------------------------------------------------------------

/** Execute a batch of gacha pulls with minimal D1 round-trips (~7 vs ~90 for 10-pull) */
async function executePullBatch(
  db: Database,
  userId: string,
  bannerId: string,
  rateUpId: string | null,
  count: number,
  transformImageUrl?: (url: string | null) => string | null,
  rng?: () => number,
): Promise<Array<PullResult>> {
  const random = rng ?? secureRandom
  const transformUrl = transformImageUrl ?? ((u: string | null) => u)

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
        isBattleReady:
          sql<boolean>`${creatureBattleStats.creatureId} IS NOT NULL`.as(
            'is_battle_ready',
          ),
      })
      .from(bannerPool)
      .innerJoin(creature, eq(creature.id, bannerPool.creatureId))
      .leftJoin(
        creatureBattleStats,
        eq(creatureBattleStats.creatureId, creature.id),
      )
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

  // 3. In-memory pull loop — no DB queries (except rare fallback)
  let pullsSinceRare = preBatchRare
  let pullsSinceLegendary = preBatchLegendary

  const pullData: Array<{
    userCreatureId: string
    creatureId: string
    rarity: Rarity
  }> = []

  for (let i = 0; i < count; i++) {
    // Increment BEFORE check so the counter represents "this is your Nth pull"
    pullsSinceRare++
    pullsSinceLegendary++

    const rarity = calculateRarity(pullsSinceRare, pullsSinceLegendary, random)

    let creatureId = selectCreatureFromPool(
      poolByRarity,
      rarity,
      rateUpId,
      random,
    )

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
          isBattleReady:
            sql<boolean>`${creatureBattleStats.creatureId} IS NOT NULL`.as(
              'is_battle_ready',
            ),
        })
        .from(creature)
        .leftJoin(
          creatureBattleStats,
          eq(creatureBattleStats.creatureId, creature.id),
        )
        .where(eq(creature.rarity, rarity))
        .all()
      if (fallback.length === 0)
        throw new Error(`No creatures of rarity: ${rarity}`)
      const picked = fallback[Math.floor(random() * fallback.length)]
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
        isBattleReady: picked.isBattleReady,
      })
    }

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
      imageUrl: transformUrl(data.imageUrl),
      imageAspectRatio: data.imageAspectRatio,
      description: data.description,
      era: data.era,
      isNew,
      isBattleReady: data.isBattleReady,
    }
  })
}
