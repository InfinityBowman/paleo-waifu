import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { slugify } from '../shared/types'
import { schema } from './db'
import type { EditorDatabase } from './db'
import type { Creature } from '../shared/types'

export type { Creature }
export { slugify }

type CreatureRow = typeof schema.creature.$inferSelect

export const VALID_RARITIES = new Set([
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
])

// ─── In-memory cache ──────────────────────────────────────────────────
// Reduces D1 REST API calls since findRowBySlug does a full table scan.

const CACHE_TTL = 60_000 // 1 minute
let cachedRows: Array<CreatureRow> | null = null
let cacheTime = 0

async function getAllRows(db: EditorDatabase): Promise<Array<CreatureRow>> {
  const now = Date.now()
  if (cachedRows && now - cacheTime < CACHE_TTL) {
    return cachedRows
  }
  cachedRows = await db
    .select()
    .from(schema.creature)
    .orderBy(schema.creature.name)
  cacheTime = now
  return cachedRows
}

function invalidateCache() {
  cachedRows = null
  cacheTime = 0
}

function creatureId(scientificName: string): string {
  return createHash('sha256').update(scientificName).digest('hex').slice(0, 21)
}

function rowToCreature(row: CreatureRow): Creature {
  return {
    name: row.name,
    scientificName: row.scientificName,
    era: row.era,
    period: row.period ?? null,
    diet: row.diet,
    sizeMeters: row.sizeMeters ?? null,
    weightKg: row.weightKg ?? null,
    rarity: row.rarity as Creature['rarity'],
    description: row.description,
    funFacts: JSON.parse(row.funFacts ?? '[]') as Array<string>,
    imageUrl: row.imageUrl ?? null,
    imageAspectRatio: row.imageAspectRatio ?? null,
    source: row.source ?? 'manual',
    type: row.type ?? '',
    foundIn: row.foundIn ?? null,
    nameMeaning: row.nameMeaning ?? null,
    pronunciation: row.pronunciation ?? null,
    wikipediaImageUrl: row.wikipediaImageUrl ?? null,
  }
}

/**
 * Find a creature row by slug. Since slugs are derived from scientificName
 * and D1/SQLite lacks a native slugify, we fetch all rows and filter in JS.
 * Uses the in-memory cache to avoid hitting the D1 REST API on every call.
 * TODO: Add a `slug` column to the schema and use WHERE slug = ? instead.
 */
async function findRowBySlug(
  db: EditorDatabase,
  slug: string,
): Promise<CreatureRow | undefined> {
  const rows = await getAllRows(db)
  return rows.find((r: CreatureRow) => slugify(r.scientificName) === slug)
}

export async function listCreatures(
  db: EditorDatabase,
): Promise<Array<Creature>> {
  const rows = await getAllRows(db)
  return rows.map(rowToCreature)
}

export async function getCreatureBySlug(
  db: EditorDatabase,
  slug: string,
): Promise<Creature | undefined> {
  const row = await findRowBySlug(db, slug)
  return row ? rowToCreature(row) : undefined
}

export async function insertCreature(
  db: EditorDatabase,
  data: Creature,
): Promise<void> {
  const id = creatureId(data.scientificName)
  const slug = slugify(data.scientificName)

  const existing = await findRowBySlug(db, slug)
  if (existing) {
    throw new Error(`Creature with slug "${slug}" already exists`)
  }

  await db.insert(schema.creature).values({
    id,
    name: data.name,
    scientificName: data.scientificName,
    era: data.era,
    period: data.period,
    diet: data.diet || 'Unknown',
    sizeMeters: data.sizeMeters,
    weightKg: data.weightKg,
    rarity: data.rarity,
    description: data.description || '',
    funFacts: JSON.stringify(data.funFacts),
    imageUrl: data.imageUrl,
    imageAspectRatio: data.imageAspectRatio,
    source: data.source || 'manual',
    type: data.type || '',
    foundIn: data.foundIn,
    nameMeaning: data.nameMeaning,
    pronunciation: data.pronunciation,
    wikipediaImageUrl: data.wikipediaImageUrl,
  })
  invalidateCache()
}

export async function updateCreatureBySlug(
  db: EditorDatabase,
  slug: string,
  updates: Partial<Creature>,
): Promise<void> {
  const match = await findRowBySlug(db, slug)
  if (!match) throw new Error(`Creature not found for slug: ${slug}`)

  const values: Record<string, unknown> = {}
  if (updates.name !== undefined) values.name = updates.name
  if (updates.scientificName !== undefined)
    values.scientificName = updates.scientificName
  if (updates.era !== undefined) values.era = updates.era
  if (updates.period !== undefined) values.period = updates.period
  if (updates.diet !== undefined) values.diet = updates.diet
  if (updates.sizeMeters !== undefined) values.sizeMeters = updates.sizeMeters
  if (updates.weightKg !== undefined) values.weightKg = updates.weightKg
  if (updates.rarity !== undefined) values.rarity = updates.rarity
  if (updates.description !== undefined)
    values.description = updates.description
  if (updates.funFacts !== undefined)
    values.funFacts = JSON.stringify(updates.funFacts)
  if (updates.source !== undefined) values.source = updates.source
  if (updates.type !== undefined) values.type = updates.type
  if (updates.foundIn !== undefined) values.foundIn = updates.foundIn
  if (updates.nameMeaning !== undefined)
    values.nameMeaning = updates.nameMeaning
  if (updates.pronunciation !== undefined)
    values.pronunciation = updates.pronunciation
  if (updates.wikipediaImageUrl !== undefined)
    values.wikipediaImageUrl = updates.wikipediaImageUrl

  if (Object.keys(values).length === 0) return

  await db
    .update(schema.creature)
    .set(values)
    .where(eq(schema.creature.id, match.id))
  invalidateCache()
}

export async function updateCreatureImage(
  db: EditorDatabase,
  slug: string,
  imageUrl: string,
  imageAspectRatio: number,
): Promise<void> {
  const match = await findRowBySlug(db, slug)
  if (!match) throw new Error(`Creature not found for slug: ${slug}`)

  await db
    .update(schema.creature)
    .set({ imageUrl, imageAspectRatio })
    .where(eq(schema.creature.id, match.id))
  invalidateCache()
}

export async function deleteCreatureBySlug(
  db: EditorDatabase,
  slug: string,
): Promise<void> {
  const match = await findRowBySlug(db, slug)
  if (!match) throw new Error(`Creature not found for slug: ${slug}`)

  await db.delete(schema.creature).where(eq(schema.creature.id, match.id))
  invalidateCache()
}

export function getStats(creatures: Array<Creature>) {
  const byRarity: Record<string, number> = {}
  const byEra: Record<string, number> = {}
  const byDiet: Record<string, number> = {}
  const byType: Record<string, number> = {}

  for (const c of creatures) {
    byRarity[c.rarity] = (byRarity[c.rarity] || 0) + 1
    byEra[c.era] = (byEra[c.era] || 0) + 1
    if (c.diet) byDiet[c.diet] = (byDiet[c.diet] || 0) + 1
    if (c.type) byType[c.type] = (byType[c.type] || 0) + 1
  }

  return {
    total: creatures.length,
    byRarity,
    byEra,
    byDiet,
    byType,
    missingImages: creatures.filter((c) => !c.imageUrl).length,
  }
}
