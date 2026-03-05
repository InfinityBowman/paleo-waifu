import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

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
  active: { templateId: string; displayName: string }
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
  const d1Dir = join(root, 'web', '.wrangler', 'state', 'v3', 'd1')

  if (!existsSync(d1Dir)) {
    throw new Error(
      `No local D1 database found at ${d1Dir}\n` +
        'Run: pnpm db:migrate:local && pnpm db:seed:battle:local',
    )
  }

  // Search for .sqlite files recursively (one level of subdirs)
  // Pick the largest file when multiple exist (empty/new DBs will be smaller)
  const candidates: Array<{ path: string; size: number }> = []
  const subdirs = readdirSync(d1Dir, { withFileTypes: true })
  for (const sub of subdirs) {
    if (!sub.isDirectory()) continue
    const subPath = join(d1Dir, sub.name)
    const files = readdirSync(subPath)
    for (const f of files) {
      if (f.endsWith('.sqlite')) {
        const fullPath = join(subPath, f)
        candidates.push({ path: fullPath, size: statSync(fullPath).size })
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.size - a.size)
    if (candidates.length > 1) {
      console.log(
        `  Found ${candidates.length} SQLite files, using largest (${(candidates[0].size / 1024).toFixed(0)}KB)`,
      )
    }
    return candidates[0].path
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
  era: string | null
  diet: string | null
  rarity: string
  type: string | null
  role: string
  hp: number
  atk: number
  def: number
  spd: number
  active_template: string
  active_name: string
  passive_template: string
  passive_name: string
}

const QUERY = `
  SELECT
    c.id, c.name, c.era, c.diet, c.rarity, c.type,
    cbs.role, cbs.hp, cbs.atk, cbs.def, cbs.spd,
    a_act.template_id AS active_template, a_act.display_name AS active_name,
    a_pas.template_id AS passive_template, a_pas.display_name AS passive_name
  FROM creature c
  JOIN creature_battle_stats cbs ON cbs.creature_id = c.id
  JOIN creature_ability a_act ON a_act.creature_id = c.id AND a_act.slot = 'active'
  JOIN creature_ability a_pas ON a_pas.creature_id = c.id AND a_pas.slot = 'passive'
`

export function loadCreatures(): Array<CreatureRecord> {
  const dbPath = resolveDbPath()
  const db = new Database(dbPath, { readonly: true })

  try {
    const rows = db.prepare(QUERY).all() as Array<RawRow>

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
      active: {
        templateId: row.active_template,
        displayName: row.active_name,
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
