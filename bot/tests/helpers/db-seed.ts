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

// ─── HTTP Helpers (call worker's /api/test/* endpoints) ─────────────

function getWorkerUrl(): string {
  const url = process.env.__TEST_WORKER_URL
  if (!url) throw new Error('__TEST_WORKER_URL not set')
  return url
}

async function testQuery<T>(
  sql: string,
  params?: Array<unknown>,
): Promise<Array<T>> {
  const res = await fetch(`${getWorkerUrl()}/api/test/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  })
  if (!res.ok) throw new Error(`Test query failed: ${res.status}`)
  const body: { rows: Array<T> } = await res.json()
  return body.rows
}

async function testExecute(
  sql: string,
  params?: Array<unknown>,
): Promise<void> {
  const res = await fetch(`${getWorkerUrl()}/api/test/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  })
  if (!res.ok) throw new Error(`Test execute failed: ${res.status}`)
}

async function testBatch(
  statements: Array<{ sql: string; params?: Array<unknown> }>,
): Promise<void> {
  const res = await fetch(`${getWorkerUrl()}/api/test/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ statements }),
  })
  if (!res.ok) throw new Error(`Test batch failed: ${res.status}`)
}

// ─── Seed Functions ─────────────────────────────────────────────────

export async function seedTestData() {
  const now = Math.floor(Date.now() / 1000)

  await testBatch([
    // Users
    {
      sql: `INSERT OR REPLACE INTO user (id, name, email, emailVerified, role, banned, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        TEST_APP_USER_ID,
        'TestUser',
        'test@example.com',
        0,
        'user',
        0,
        now,
        now,
      ],
    },
    {
      sql: `INSERT OR REPLACE INTO user (id, name, email, emailVerified, role, banned, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        TEST_APP_USER_ID_2,
        'TestUser2',
        'test2@example.com',
        0,
        'user',
        0,
        now,
        now,
      ],
    },

    // Discord accounts (link Discord ID → app user)
    {
      sql: `INSERT OR REPLACE INTO account (id, accountId, providerId, userId, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: [
        'acc-001',
        TEST_DISCORD_USER_ID,
        'discord',
        TEST_APP_USER_ID,
        now,
        now,
      ],
    },
    {
      sql: `INSERT OR REPLACE INTO account (id, accountId, providerId, userId, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: [
        'acc-002',
        TEST_DISCORD_USER_ID_2,
        'discord',
        TEST_APP_USER_ID_2,
        now,
        now,
      ],
    },

    // Creatures
    {
      sql: `INSERT OR REPLACE INTO creature (id, name, scientific_name, era, diet, rarity, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        TEST_CREATURE_ID,
        'Tyrannosaurus',
        'T. rex',
        'Cretaceous',
        'Carnivore',
        'legendary',
        'The king of dinosaurs',
        now,
      ],
    },
    {
      sql: `INSERT OR REPLACE INTO creature (id, name, scientific_name, era, diet, rarity, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        TEST_CREATURE_ID_2,
        'Triceratops',
        'Triceratops horridus',
        'Cretaceous',
        'Herbivore',
        'common',
        'Three-horned face',
        now,
      ],
    },
    {
      sql: `INSERT OR REPLACE INTO creature (id, name, scientific_name, era, diet, rarity, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        TEST_CREATURE_ID_3,
        'Stegosaurus',
        'Stegosaurus stenops',
        'Jurassic',
        'Herbivore',
        'uncommon',
        'Plated dinosaur',
        now,
      ],
    },
    {
      sql: `INSERT OR REPLACE INTO creature (id, name, scientific_name, era, diet, rarity, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        TEST_CREATURE_ID_4,
        'Velociraptor',
        'V. mongoliensis',
        'Cretaceous',
        'Carnivore',
        'rare',
        'Clever girl',
        now,
      ],
    },
    {
      sql: `INSERT OR REPLACE INTO creature (id, name, scientific_name, era, diet, rarity, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        TEST_CREATURE_ID_5,
        'Spinosaurus',
        'S. aegyptiacus',
        'Cretaceous',
        'Carnivore',
        'epic',
        'Sail-backed predator',
        now,
      ],
    },

    // Banner with creatures
    {
      sql: `INSERT OR REPLACE INTO banner (id, name, starts_at, is_active, rate_up_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: [
        TEST_BANNER_ID,
        'Test Banner',
        now - 86400,
        1,
        TEST_CREATURE_ID,
        now,
      ],
    },
    {
      sql: `INSERT OR REPLACE INTO banner_pool (id, banner_id, creature_id)
            VALUES (?, ?, ?)`,
      params: ['bp-001', TEST_BANNER_ID, TEST_CREATURE_ID],
    },
    {
      sql: `INSERT OR REPLACE INTO banner_pool (id, banner_id, creature_id)
            VALUES (?, ?, ?)`,
      params: ['bp-002', TEST_BANNER_ID, TEST_CREATURE_ID_2],
    },
    {
      sql: `INSERT OR REPLACE INTO banner_pool (id, banner_id, creature_id)
            VALUES (?, ?, ?)`,
      params: ['bp-003', TEST_BANNER_ID, TEST_CREATURE_ID_3],
    },
    {
      sql: `INSERT OR REPLACE INTO banner_pool (id, banner_id, creature_id)
            VALUES (?, ?, ?)`,
      params: ['bp-004', TEST_BANNER_ID, TEST_CREATURE_ID_4],
    },
    {
      sql: `INSERT OR REPLACE INTO banner_pool (id, banner_id, creature_id)
            VALUES (?, ?, ?)`,
      params: ['bp-005', TEST_BANNER_ID, TEST_CREATURE_ID_5],
    },

    // Currency (user 1 starts with 100 fossils, user 2 with 0)
    {
      sql: `INSERT OR REPLACE INTO currency (id, user_id, fossils, updated_at)
            VALUES (?, ?, ?, ?)`,
      params: ['cur-001', TEST_APP_USER_ID, 100, now],
    },
    {
      sql: `INSERT OR REPLACE INTO currency (id, user_id, fossils, updated_at)
            VALUES (?, ?, ?, ?)`,
      params: ['cur-002', TEST_APP_USER_ID_2, 0, now],
    },

    // User creature (for trades)
    {
      sql: `INSERT OR REPLACE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at)
            VALUES (?, ?, ?, ?, ?)`,
      params: [
        TEST_USER_CREATURE_ID,
        TEST_APP_USER_ID,
        TEST_CREATURE_ID_2,
        TEST_BANNER_ID,
        now,
      ],
    },

    // XP
    {
      sql: `INSERT OR REPLACE INTO user_xp (id, user_id, xp, level, updated_at)
            VALUES (?, ?, ?, ?, ?)`,
      params: ['xp-001', TEST_APP_USER_ID, 150, 3, now],
    },
    {
      sql: `INSERT OR REPLACE INTO user_xp (id, user_id, xp, level, updated_at)
            VALUES (?, ?, ?, ?, ?)`,
      params: ['xp-002', TEST_APP_USER_ID_2, 0, 0, now],
    },
  ])
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
  await testBatch([
    { sql: 'PRAGMA foreign_keys = OFF' },
    ...GAME_TABLES.map((table) => ({ sql: `DELETE FROM ${table}` })),
    { sql: 'PRAGMA foreign_keys = ON' },
  ])
}

// ─── Query Helpers ──────────────────────────────────────────────────

export async function queryOne<T>(
  sql: string,
  ...params: Array<unknown>
): Promise<T | undefined> {
  const rows = await testQuery<T>(sql, params)
  return rows[0]
}

export async function queryAll<T>(
  sql: string,
  ...params: Array<unknown>
): Promise<Array<T>> {
  return testQuery<T>(sql, params)
}

/** Run an arbitrary write statement (INSERT, UPDATE, DELETE) */
export async function execute(
  sql: string,
  ...params: Array<unknown>
): Promise<void> {
  await testExecute(sql, params)
}
