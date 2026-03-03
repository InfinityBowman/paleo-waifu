import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { readCreatures, type Creature } from './creatures'

const execFileAsync = promisify(execFile)

const PROJECT_ROOT = resolve(import.meta.dirname, '../../../..')
const SEED_PATH = resolve(PROJECT_ROOT, 'seed.sql')

function nanoid(name: string): string {
  return createHash('sha256').update(name).digest('hex').slice(0, 21)
}

function escapeSql(s: string): string {
  return s.replace(/'/g, "''")
}

function sqlStr(val: string | null | undefined): string {
  if (!val) return 'NULL'
  return `'${escapeSql(val)}'`
}

function sqlNum(val: number | null | undefined): string {
  if (val == null) return 'NULL'
  return String(val)
}

export function generateSeedSql(creatures: Creature[]): string {
  const lines: string[] = []
  const creatureIds: string[] = []

  for (const c of creatures) {
    const cid = nanoid(c.scientificName)
    creatureIds.push(cid)
    const funFacts = JSON.stringify(c.funFacts ?? [])

    lines.push(
      `INSERT OR REPLACE INTO creature (id, name, scientific_name, era, period, diet, ` +
        `size_meters, weight_kg, rarity, description, fun_facts, image_url, image_aspect_ratio) VALUES (` +
        `'${cid}', ` +
        `${sqlStr(c.name)}, ` +
        `${sqlStr(c.scientificName)}, ` +
        `${sqlStr(c.era || 'Unknown')}, ` +
        `${sqlStr(c.period)}, ` +
        `${sqlStr(c.diet || 'Unknown')}, ` +
        `${sqlNum(c.sizeMeters)}, ` +
        `${sqlNum(c.weightKg)}, ` +
        `${sqlStr(c.rarity || 'common')}, ` +
        `'${escapeSql(c.description || '')}', ` +
        `${sqlStr(funFacts)}, ` +
        `${sqlStr(c.imageUrl)}, ` +
        `${sqlNum(c.imageAspectRatio)}` +
        `);`,
    )
  }

  // Default banner
  const bannerId = nanoid('default-banner')
  lines.push('')
  lines.push(
    `INSERT OR REPLACE INTO banner (id, name, description, starts_at, is_active) VALUES (` +
      `'${bannerId}', ` +
      `'Mesozoic Mayhem', ` +
      `'All prehistoric creatures available!', ` +
      `0, ` +
      `1);`,
  )

  // Banner pool
  for (const cid of creatureIds) {
    const poolId = nanoid(`pool-${bannerId}-${cid}`)
    lines.push(
      `INSERT OR REPLACE INTO banner_pool (id, banner_id, creature_id) VALUES (` +
        `'${poolId}', '${bannerId}', '${cid}');`,
    )
  }

  return lines.join('\n') + '\n'
}

export async function seedDatabase(
  target: 'local' | 'prod',
): Promise<{ ok: boolean; creatureCount: number; output: string }> {
  const creatures = await readCreatures()
  const sql = generateSeedSql(creatures)
  await writeFile(SEED_PATH, sql, 'utf-8')

  const args =
    target === 'prod' ? ['db:seed:prod'] : ['db:seed:local']

  try {
    const { stdout, stderr } = await execFileAsync('pnpm', args, {
      cwd: PROJECT_ROOT,
      timeout: 60_000,
    })
    return {
      ok: true,
      creatureCount: creatures.length,
      output: stdout + (stderr ? '\n' + stderr : ''),
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      creatureCount: creatures.length,
      output: msg,
    }
  }
}
