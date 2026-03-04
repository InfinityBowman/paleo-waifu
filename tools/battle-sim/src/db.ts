import Database from 'better-sqlite3'
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// ─── Types ────────────────────────────────────────────────────────

export interface CreatureRecord {
  id: string
  name: string
  era: string
  diet: string
  rarity: string
  type: string
  role: string
  hp: number
  atk: number
  def: number
  spd: number
  abl: number
  active1: { templateId: string; displayName: string }
  active2: { templateId: string; displayName: string }
  passive: { templateId: string; displayName: string }
}

// ─── DB Path Resolution ───────────────────────────────────────────

function getRepoRoot(): string {
  // src/db.ts → tools/battle-sim/src/ → tools/battle-sim/ → tools/ → repo root
  const thisDir = fileURLToPath(new URL('.', import.meta.url))
  return join(thisDir, '..', '..', '..')
}

function resolveDbPath(): string {
  const root = getRepoRoot()
  const d1Dir = join(root, '.wrangler', 'state', 'v3', 'd1')

  if (!existsSync(d1Dir)) {
    throw new Error(
      `No local D1 database found at ${d1Dir}\n` +
        'Run: pnpm db:migrate:local && pnpm db:seed:battle:local',
    )
  }

  // Search for .sqlite files recursively (one level of subdirs)
  const subdirs = readdirSync(d1Dir, { withFileTypes: true })
  for (const sub of subdirs) {
    if (!sub.isDirectory()) continue
    const subPath = join(d1Dir, sub.name)
    const files = readdirSync(subPath)
    const sqliteFile = files.find((f) => f.endsWith('.sqlite'))
    if (sqliteFile) {
      return join(subPath, sqliteFile)
    }
  }

  throw new Error(
    `No .sqlite file found in ${d1Dir}\n` +
      'Run: pnpm db:migrate:local && pnpm db:seed:battle:local',
  )
}

// ─── Data Loading ─────────────────────────────────────────────────

interface RawRow {
  id: string
  name: string
  era: string
  diet: string
  rarity: string
  type: string
  role: string
  hp: number
  atk: number
  def: number
  spd: number
  abl: number
  active1_template: string
  active1_name: string
  active2_template: string
  active2_name: string
  passive_template: string
  passive_name: string
}

const QUERY = `
  SELECT
    c.id, c.name, c.era, c.diet, c.rarity, c.type,
    cbs.role, cbs.hp, cbs.atk, cbs.def, cbs.spd, cbs.abl,
    a1.template_id AS active1_template, a1.display_name AS active1_name,
    a2.template_id AS active2_template, a2.display_name AS active2_name,
    ap.template_id AS passive_template, ap.display_name AS passive_name
  FROM creature c
  JOIN creature_battle_stats cbs ON cbs.creature_id = c.id
  JOIN creature_ability a1 ON a1.creature_id = c.id AND a1.slot = 'active1'
  JOIN creature_ability a2 ON a2.creature_id = c.id AND a2.slot = 'active2'
  JOIN creature_ability ap ON ap.creature_id = c.id AND ap.slot = 'passive'
`

export function loadCreatures(): CreatureRecord[] {
  const dbPath = resolveDbPath()
  const db = new Database(dbPath, { readonly: true })

  try {
    const rows = db.prepare(QUERY).all() as RawRow[]

    if (rows.length < 3) {
      throw new Error(
        `Only ${rows.length} battle-ready creatures found. Need at least 3.\n` +
          'Run: pnpm db:seed:battle:local',
      )
    }

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      era: row.era ?? 'Unknown',
      diet: row.diet ?? 'Unknown',
      rarity: row.rarity,
      type: row.type ?? 'Unknown',
      role: row.role,
      hp: row.hp,
      atk: row.atk,
      def: row.def,
      spd: row.spd,
      abl: row.abl,
      active1: {
        templateId: row.active1_template,
        displayName: row.active1_name,
      },
      active2: {
        templateId: row.active2_template,
        displayName: row.active2_name,
      },
      passive: {
        templateId: row.passive_template,
        displayName: row.passive_name,
      },
    }))
  } finally {
    db.close()
  }
}
