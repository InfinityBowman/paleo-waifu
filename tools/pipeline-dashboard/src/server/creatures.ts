import { readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {  slugify } from '../shared/types'
import type {Creature} from '../shared/types';

export type { Creature }
export { slugify }

const DATA_DIR = resolve(import.meta.dirname, '../../../../python/data')
const JSON_PATH = resolve(DATA_DIR, 'creatures_enriched.json')

export async function readCreatures(): Promise<Array<Creature>> {
  const raw = await readFile(JSON_PATH, 'utf-8')
  return JSON.parse(raw) as Array<Creature>
}

// Serialize all writes to prevent concurrent read-write data loss
let writeQueue = Promise.resolve()

async function atomicWrite(creatures: Array<Creature>): Promise<void> {
  const sorted = [...creatures].sort((a, b) => a.name.localeCompare(b.name))
  const tmp = JSON_PATH + '.tmp'
  await writeFile(tmp, JSON.stringify(sorted, null, 2) + '\n', 'utf-8')
  await rename(tmp, JSON_PATH)
}

export function writeCreatures(creatures: Array<Creature>): Promise<void> {
  const p = writeQueue.then(() => atomicWrite(creatures))
  writeQueue = p.catch(() => {})
  return p
}

/**
 * Atomically read-modify-write a single creature by slug.
 * Serialized behind the write queue to prevent data loss.
 */
export function updateCreature(
  slug: string,
  updates: Partial<Creature>,
): Promise<void> {
  const p = writeQueue.then(async () => {
    const creatures = await readCreatures()
    const creature = creatures.find((c) => slugify(c.scientificName) === slug)
    if (!creature) {
      throw new Error(`Creature not found for slug: ${slug}`)
    }
    Object.assign(creature, updates)
    await atomicWrite(creatures)
  })
  writeQueue = p.catch(() => {})
  return p
}

/**
 * Atomically add a new creature. Serialized behind the write queue.
 * Throws if slug already exists.
 */
export function addCreature(creature: Creature): Promise<void> {
  const p = writeQueue.then(async () => {
    const creatures = await readCreatures()
    const slug = slugify(creature.scientificName)
    if (creatures.some((c) => slugify(c.scientificName) === slug)) {
      throw new Error(`Creature with slug "${slug}" already exists`)
    }
    creatures.push(creature)
    await atomicWrite(creatures)
  })
  writeQueue = p.catch(() => {})
  return p
}

/**
 * Atomically remove a creature by slug. Serialized behind the write queue.
 * Throws if slug not found.
 */
export function removeCreature(slug: string): Promise<void> {
  const p = writeQueue.then(async () => {
    const creatures = await readCreatures()
    const idx = creatures.findIndex((c) => slugify(c.scientificName) === slug)
    if (idx === -1) {
      throw new Error(`Creature not found for slug: ${slug}`)
    }
    creatures.splice(idx, 1)
    await atomicWrite(creatures)
  })
  writeQueue = p.catch(() => {})
  return p
}

export function findBySlug(
  creatures: Array<Creature>,
  slug: string,
): Creature | undefined {
  return creatures.find((c) => slugify(c.scientificName) === slug)
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

export const VALID_RARITIES = new Set([
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
])

export const IMAGES_DIR = resolve(DATA_DIR, 'images')
export const JSON_FILE_PATH = JSON_PATH
