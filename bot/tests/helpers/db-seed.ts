import Database from 'better-sqlite3'
import { findDbPath } from '../setup'

// ─── Test Constants ─────────────────────────────────────────────────

export const TEST_DISCORD_USER_ID = '111111111111111111'
export const TEST_DISCORD_USER_ID_2 = '222222222222222222'
export const UNLINKED_DISCORD_USER_ID = '999999999999999999'

export const TEST_APP_USER_ID = 'test-user-001'
export const TEST_APP_USER_ID_2 = 'test-user-002'

export const TEST_CREATURE_ID = 'creature-001' // legendary
export const TEST_CREATURE_ID_2 = 'creature-002' // common
export const TEST_CREATURE_ID_3 = 'creature-003' // uncommon
export const TEST_CREATURE_ID_4 = 'creature-004' // rare
export const TEST_CREATURE_ID_5 = 'creature-005' // epic

export const TEST_BANNER_ID = 'banner-001'
export const TEST_USER_CREATURE_ID = 'uc-001'

// ─── Database Access ────────────────────────────────────────────────
// Open a fresh connection each time to avoid holding WAL locks that
// conflict with miniflare's D1 connection during worker processing.

let dbPath: string | null = null

export async function getDb(): Promise<Database.Database> {
  if (!dbPath) {
    dbPath = await findDbPath()
  }
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return db
}

/** No-op for compatibility — connections are now ephemeral */
export function closeDb() {}

/** Run a function with a DB connection that's auto-closed after */
async function withDb<T>(fn: (db: Database.Database) => T): Promise<T> {
  const db = await getDb()
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

// ─── Seed Functions ─────────────────────────────────────────────────

export async function seedTestData() {
  await withDb((db) => {
    const now = Math.floor(Date.now() / 1000)

    // Users
    db.prepare(
      `INSERT OR REPLACE INTO user (id, name, email, emailVerified, role, banned, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(TEST_APP_USER_ID, 'TestUser', 'test@example.com', 0, 'user', 0, now, now)

    db.prepare(
      `INSERT OR REPLACE INTO user (id, name, email, emailVerified, role, banned, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(TEST_APP_USER_ID_2, 'TestUser2', 'test2@example.com', 0, 'user', 0, now, now)

    // Discord accounts (link Discord ID → app user)
    db.prepare(
      `INSERT OR REPLACE INTO account (id, accountId, providerId, userId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('acc-001', TEST_DISCORD_USER_ID, 'discord', TEST_APP_USER_ID, now, now)

    db.prepare(
      `INSERT OR REPLACE INTO account (id, accountId, providerId, userId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('acc-002', TEST_DISCORD_USER_ID_2, 'discord', TEST_APP_USER_ID_2, now, now)

    // Creatures
    db.prepare(
      `INSERT OR REPLACE INTO creature (id, name, scientific_name, era, diet, rarity, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(TEST_CREATURE_ID, 'Tyrannosaurus', 'T. rex', 'Cretaceous', 'Carnivore', 'legendary', 'The king of dinosaurs', now)

    db.prepare(
      `INSERT OR REPLACE INTO creature (id, name, scientific_name, era, diet, rarity, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(TEST_CREATURE_ID_2, 'Triceratops', 'Triceratops horridus', 'Cretaceous', 'Herbivore', 'common', 'Three-horned face', now)

    db.prepare(
      `INSERT OR REPLACE INTO creature (id, name, scientific_name, era, diet, rarity, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(TEST_CREATURE_ID_3, 'Stegosaurus', 'Stegosaurus stenops', 'Jurassic', 'Herbivore', 'uncommon', 'Plated dinosaur', now)

    db.prepare(
      `INSERT OR REPLACE INTO creature (id, name, scientific_name, era, diet, rarity, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(TEST_CREATURE_ID_4, 'Velociraptor', 'V. mongoliensis', 'Cretaceous', 'Carnivore', 'rare', 'Clever girl', now)

    db.prepare(
      `INSERT OR REPLACE INTO creature (id, name, scientific_name, era, diet, rarity, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(TEST_CREATURE_ID_5, 'Spinosaurus', 'S. aegyptiacus', 'Cretaceous', 'Carnivore', 'epic', 'Sail-backed predator', now)

    // Banner with creatures
    db.prepare(
      `INSERT OR REPLACE INTO banner (id, name, starts_at, is_active, rate_up_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(TEST_BANNER_ID, 'Test Banner', now - 86400, 1, TEST_CREATURE_ID, now)

    db.prepare(
      `INSERT OR REPLACE INTO banner_pool (id, banner_id, creature_id)
       VALUES (?, ?, ?)`,
    ).run('bp-001', TEST_BANNER_ID, TEST_CREATURE_ID)

    db.prepare(
      `INSERT OR REPLACE INTO banner_pool (id, banner_id, creature_id)
       VALUES (?, ?, ?)`,
    ).run('bp-002', TEST_BANNER_ID, TEST_CREATURE_ID_2)

    db.prepare(
      `INSERT OR REPLACE INTO banner_pool (id, banner_id, creature_id)
       VALUES (?, ?, ?)`,
    ).run('bp-003', TEST_BANNER_ID, TEST_CREATURE_ID_3)

    db.prepare(
      `INSERT OR REPLACE INTO banner_pool (id, banner_id, creature_id)
       VALUES (?, ?, ?)`,
    ).run('bp-004', TEST_BANNER_ID, TEST_CREATURE_ID_4)

    db.prepare(
      `INSERT OR REPLACE INTO banner_pool (id, banner_id, creature_id)
       VALUES (?, ?, ?)`,
    ).run('bp-005', TEST_BANNER_ID, TEST_CREATURE_ID_5)

    // Currency (user 1 starts with 100 fossils, user 2 with 0)
    db.prepare(
      `INSERT OR REPLACE INTO currency (id, user_id, fossils, updated_at)
       VALUES (?, ?, ?, ?)`,
    ).run('cur-001', TEST_APP_USER_ID, 100, now)

    db.prepare(
      `INSERT OR REPLACE INTO currency (id, user_id, fossils, updated_at)
       VALUES (?, ?, ?, ?)`,
    ).run('cur-002', TEST_APP_USER_ID_2, 0, now)

    // User creature (for trades/battles)
    db.prepare(
      `INSERT OR REPLACE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(TEST_USER_CREATURE_ID, TEST_APP_USER_ID, TEST_CREATURE_ID_2, TEST_BANNER_ID, now)

    // XP
    db.prepare(
      `INSERT OR REPLACE INTO user_xp (id, user_id, xp, level, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('xp-001', TEST_APP_USER_ID, 150, 3, now)

    db.prepare(
      `INSERT OR REPLACE INTO user_xp (id, user_id, xp, level, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('xp-002', TEST_APP_USER_ID_2, 0, 0, now)
  })
}

// ─── Game table names to reset between tests ───────────────────────

const GAME_TABLES = [
  'battle_team_preset',
  'battle_rating',
  'battle_challenge',
  'creature_ability',
  'creature_battle_stats',
  'wishlist',
  'trade_proposal',
  'trade_history',
  'trade_offer',
  'pity_counter',
  'user_creature',
  'currency',
  'user_xp',
  'banner_pool',
  'banner',
  'creature',
  'session',
  'account',
  'user',
]

export async function resetTestData() {
  await withDb((db) => {
    db.pragma('foreign_keys = OFF')
    for (const table of GAME_TABLES) {
      db.prepare(`DELETE FROM ${table}`).run()
    }
    db.pragma('foreign_keys = ON')
  })
}

// ─── Query Helpers ──────────────────────────────────────────────────

export async function queryOne<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
  return withDb((db) => db.prepare(sql).get(...params) as T | undefined)
}

export async function queryAll<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  return withDb((db) => db.prepare(sql).all(...params) as T[])
}

/** Run an arbitrary write statement (INSERT, UPDATE, DELETE) */
export async function execute(sql: string, ...params: unknown[]): Promise<void> {
  await withDb((db) => {
    db.prepare(sql).run(...params)
  })
}
