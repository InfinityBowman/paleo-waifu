// ─── Test Constants ─────────────────────────────────────────────────

export const TEST_USER_ID = 'e2e-user-001'
export const TEST_USER_ID_2 = 'e2e-user-002'
export const TEST_ADMIN_ID = 'e2e-admin-001'

export const TEST_CREATURE_ID = 'e2e-creature-001' // legendary
export const TEST_CREATURE_ID_2 = 'e2e-creature-002' // common
export const TEST_CREATURE_ID_3 = 'e2e-creature-003' // uncommon
export const TEST_CREATURE_ID_4 = 'e2e-creature-004' // rare
export const TEST_CREATURE_ID_5 = 'e2e-creature-005' // epic
export const TEST_CREATURE_ID_6 = 'e2e-creature-006' // common (extra)

export const TEST_BANNER_ID = 'e2e-banner-001'

// User creatures — 3 per user for battle teams + trade tests
export const TEST_UC_ID_1 = 'e2e-uc-001' // user-001 owns creature-001 (legendary)
export const TEST_UC_ID_2 = 'e2e-uc-002' // user-001 owns creature-002 (common)
export const TEST_UC_ID_3 = 'e2e-uc-003' // user-001 owns creature-003 (uncommon)
export const TEST_UC_ID_4 = 'e2e-uc-004' // user-002 owns creature-004 (rare)
export const TEST_UC_ID_5 = 'e2e-uc-005' // user-002 owns creature-005 (epic)
export const TEST_UC_ID_6 = 'e2e-uc-006' // user-002 owns creature-006 (common)

// ─── HTTP Helpers (call worker's /api/test endpoint) ────────────────

function getWorkerUrl(): string {
  const url = process.env.__TEST_WORKER_URL
  if (!url) throw new Error('__TEST_WORKER_URL not set')
  return url
}

async function testQuery<T>(
  sql: string,
  params?: Array<unknown>,
): Promise<Array<T>> {
  const res = await fetch(`${getWorkerUrl()}/api/test?action=query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Test query failed (${res.status}): ${text}`)
  }
  const body: { rows: Array<T> } = await res.json()
  return body.rows
}

async function testExecute(
  sql: string,
  params?: Array<unknown>,
): Promise<void> {
  const res = await fetch(`${getWorkerUrl()}/api/test?action=execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Test execute failed (${res.status}): ${text}`)
  }
}

async function testBatch(
  statements: Array<{ sql: string; params?: Array<unknown> }>,
): Promise<void> {
  const res = await fetch(`${getWorkerUrl()}/api/test?action=batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ statements }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Test batch failed (${res.status}): ${text}`)
  }
}

// ─── Seed Functions ─────────────────────────────────────────────────

export async function seedTestData() {
  const now = Math.floor(Date.now() / 1000)

  await testBatch([
    // ── Users ──────────────────────────────────────────────────────
    {
      sql: `INSERT OR REPLACE INTO user (id, name, email, emailVerified, role, banned, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        TEST_USER_ID,
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
        TEST_USER_ID_2,
        'TestUser2',
        'test2@example.com',
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
        TEST_ADMIN_ID,
        'AdminUser',
        'admin@example.com',
        0,
        'admin',
        0,
        now,
        now,
      ],
    },

    // ── Creatures ──────────────────────────────────────────────────
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
    {
      sql: `INSERT OR REPLACE INTO creature (id, name, scientific_name, era, diet, rarity, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        TEST_CREATURE_ID_6,
        'Ankylosaurus',
        'A. magniventris',
        'Cretaceous',
        'Herbivore',
        'common',
        'Living tank',
        now,
      ],
    },

    // ── Banner with all creatures ──────────────────────────────────
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
      sql: `INSERT OR REPLACE INTO banner_pool (id, banner_id, creature_id) VALUES (?, ?, ?)`,
      params: ['e2e-bp-001', TEST_BANNER_ID, TEST_CREATURE_ID],
    },
    {
      sql: `INSERT OR REPLACE INTO banner_pool (id, banner_id, creature_id) VALUES (?, ?, ?)`,
      params: ['e2e-bp-002', TEST_BANNER_ID, TEST_CREATURE_ID_2],
    },
    {
      sql: `INSERT OR REPLACE INTO banner_pool (id, banner_id, creature_id) VALUES (?, ?, ?)`,
      params: ['e2e-bp-003', TEST_BANNER_ID, TEST_CREATURE_ID_3],
    },
    {
      sql: `INSERT OR REPLACE INTO banner_pool (id, banner_id, creature_id) VALUES (?, ?, ?)`,
      params: ['e2e-bp-004', TEST_BANNER_ID, TEST_CREATURE_ID_4],
    },
    {
      sql: `INSERT OR REPLACE INTO banner_pool (id, banner_id, creature_id) VALUES (?, ?, ?)`,
      params: ['e2e-bp-005', TEST_BANNER_ID, TEST_CREATURE_ID_5],
    },
    {
      sql: `INSERT OR REPLACE INTO banner_pool (id, banner_id, creature_id) VALUES (?, ?, ?)`,
      params: ['e2e-bp-006', TEST_BANNER_ID, TEST_CREATURE_ID_6],
    },

    // ── Currency ───────────────────────────────────────────────────
    {
      sql: `INSERT OR REPLACE INTO currency (id, user_id, fossils, updated_at)
            VALUES (?, ?, ?, ?)`,
      params: ['e2e-cur-001', TEST_USER_ID, 100, now],
    },
    {
      sql: `INSERT OR REPLACE INTO currency (id, user_id, fossils, updated_at)
            VALUES (?, ?, ?, ?)`,
      params: ['e2e-cur-002', TEST_USER_ID_2, 50, now],
    },
    {
      sql: `INSERT OR REPLACE INTO currency (id, user_id, fossils, updated_at)
            VALUES (?, ?, ?, ?)`,
      params: ['e2e-cur-003', TEST_ADMIN_ID, 100, now],
    },

    // ── User creatures (3 per user) ────────────────────────────────
    {
      sql: `INSERT OR REPLACE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at)
            VALUES (?, ?, ?, ?, ?)`,
      params: [
        TEST_UC_ID_1,
        TEST_USER_ID,
        TEST_CREATURE_ID,
        TEST_BANNER_ID,
        now,
      ],
    },
    {
      sql: `INSERT OR REPLACE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at)
            VALUES (?, ?, ?, ?, ?)`,
      params: [
        TEST_UC_ID_2,
        TEST_USER_ID,
        TEST_CREATURE_ID_2,
        TEST_BANNER_ID,
        now,
      ],
    },
    {
      sql: `INSERT OR REPLACE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at)
            VALUES (?, ?, ?, ?, ?)`,
      params: [
        TEST_UC_ID_3,
        TEST_USER_ID,
        TEST_CREATURE_ID_3,
        TEST_BANNER_ID,
        now,
      ],
    },
    {
      sql: `INSERT OR REPLACE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at)
            VALUES (?, ?, ?, ?, ?)`,
      params: [
        TEST_UC_ID_4,
        TEST_USER_ID_2,
        TEST_CREATURE_ID_4,
        TEST_BANNER_ID,
        now,
      ],
    },
    {
      sql: `INSERT OR REPLACE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at)
            VALUES (?, ?, ?, ?, ?)`,
      params: [
        TEST_UC_ID_5,
        TEST_USER_ID_2,
        TEST_CREATURE_ID_5,
        TEST_BANNER_ID,
        now,
      ],
    },
    {
      sql: `INSERT OR REPLACE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at)
            VALUES (?, ?, ?, ?, ?)`,
      params: [
        TEST_UC_ID_6,
        TEST_USER_ID_2,
        TEST_CREATURE_ID_6,
        TEST_BANNER_ID,
        now,
      ],
    },

    // ── XP ─────────────────────────────────────────────────────────
    {
      sql: `INSERT OR REPLACE INTO user_xp (id, user_id, xp, level, updated_at)
            VALUES (?, ?, ?, ?, ?)`,
      params: ['e2e-xp-001', TEST_USER_ID, 150, 3, now],
    },
    {
      sql: `INSERT OR REPLACE INTO user_xp (id, user_id, xp, level, updated_at)
            VALUES (?, ?, ?, ?, ?)`,
      params: ['e2e-xp-002', TEST_USER_ID_2, 0, 0, now],
    },

    // ── Battle stats (needed for battle tests) ─────────────────────
    {
      sql: `INSERT OR REPLACE INTO creature_battle_stats (creature_id, role, hp, atk, def, spd)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: [TEST_CREATURE_ID, 'striker', 120, 140, 70, 90],
    },
    {
      sql: `INSERT OR REPLACE INTO creature_battle_stats (creature_id, role, hp, atk, def, spd)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: [TEST_CREATURE_ID_2, 'tank', 150, 80, 130, 60],
    },
    {
      sql: `INSERT OR REPLACE INTO creature_battle_stats (creature_id, role, hp, atk, def, spd)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: [TEST_CREATURE_ID_3, 'support', 130, 90, 100, 80],
    },
    {
      sql: `INSERT OR REPLACE INTO creature_battle_stats (creature_id, role, hp, atk, def, spd)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: [TEST_CREATURE_ID_4, 'striker', 100, 130, 60, 120],
    },
    {
      sql: `INSERT OR REPLACE INTO creature_battle_stats (creature_id, role, hp, atk, def, spd)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: [TEST_CREATURE_ID_5, 'bruiser', 140, 110, 90, 70],
    },
    {
      sql: `INSERT OR REPLACE INTO creature_battle_stats (creature_id, role, hp, atk, def, spd)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: [TEST_CREATURE_ID_6, 'tank', 160, 70, 140, 50],
    },

    // ── Creature abilities (active + passive per creature) ─────────
    {
      sql: `INSERT OR REPLACE INTO creature_ability (id, creature_id, template_id, slot, display_name)
            VALUES (?, ?, ?, ?, ?)`,
      params: [
        'e2e-ca-001',
        TEST_CREATURE_ID,
        'bite',
        'active',
        'Crushing Bite',
      ],
    },
    {
      sql: `INSERT OR REPLACE INTO creature_ability (id, creature_id, template_id, slot, display_name)
            VALUES (?, ?, ?, ?, ?)`,
      params: [
        'e2e-ca-002',
        TEST_CREATURE_ID,
        'intimidate',
        'passive',
        'Apex Predator',
      ],
    },
    {
      sql: `INSERT OR REPLACE INTO creature_ability (id, creature_id, template_id, slot, display_name)
            VALUES (?, ?, ?, ?, ?)`,
      params: [
        'e2e-ca-003',
        TEST_CREATURE_ID_2,
        'charge',
        'active',
        'Horn Charge',
      ],
    },
    {
      sql: `INSERT OR REPLACE INTO creature_ability (id, creature_id, template_id, slot, display_name)
            VALUES (?, ?, ?, ?, ?)`,
      params: [
        'e2e-ca-004',
        TEST_CREATURE_ID_2,
        'thick_hide',
        'passive',
        'Thick Hide',
      ],
    },
    {
      sql: `INSERT OR REPLACE INTO creature_ability (id, creature_id, template_id, slot, display_name)
            VALUES (?, ?, ?, ?, ?)`,
      params: [
        'e2e-ca-005',
        TEST_CREATURE_ID_3,
        'tail_whip',
        'active',
        'Tail Whip',
      ],
    },
    {
      sql: `INSERT OR REPLACE INTO creature_ability (id, creature_id, template_id, slot, display_name)
            VALUES (?, ?, ?, ?, ?)`,
      params: [
        'e2e-ca-006',
        TEST_CREATURE_ID_3,
        'plated_armor',
        'passive',
        'Plated Armor',
      ],
    },
    {
      sql: `INSERT OR REPLACE INTO creature_ability (id, creature_id, template_id, slot, display_name)
            VALUES (?, ?, ?, ?, ?)`,
      params: ['e2e-ca-007', TEST_CREATURE_ID_4, 'pounce', 'active', 'Pounce'],
    },
    {
      sql: `INSERT OR REPLACE INTO creature_ability (id, creature_id, template_id, slot, display_name)
            VALUES (?, ?, ?, ?, ?)`,
      params: [
        'e2e-ca-008',
        TEST_CREATURE_ID_4,
        'pack_hunter',
        'passive',
        'Pack Hunter',
      ],
    },
    {
      sql: `INSERT OR REPLACE INTO creature_ability (id, creature_id, template_id, slot, display_name)
            VALUES (?, ?, ?, ?, ?)`,
      params: [
        'e2e-ca-009',
        TEST_CREATURE_ID_5,
        'aqua_slash',
        'active',
        'Aqua Slash',
      ],
    },
    {
      sql: `INSERT OR REPLACE INTO creature_ability (id, creature_id, template_id, slot, display_name)
            VALUES (?, ?, ?, ?, ?)`,
      params: [
        'e2e-ca-010',
        TEST_CREATURE_ID_5,
        'sail_back',
        'passive',
        'Sail Back',
      ],
    },
    {
      sql: `INSERT OR REPLACE INTO creature_ability (id, creature_id, template_id, slot, display_name)
            VALUES (?, ?, ?, ?, ?)`,
      params: [
        'e2e-ca-011',
        TEST_CREATURE_ID_6,
        'club_tail',
        'active',
        'Club Tail',
      ],
    },
    {
      sql: `INSERT OR REPLACE INTO creature_ability (id, creature_id, template_id, slot, display_name)
            VALUES (?, ?, ?, ?, ?)`,
      params: [
        'e2e-ca-012',
        TEST_CREATURE_ID_6,
        'fortress',
        'passive',
        'Fortress',
      ],
    },
  ])
}

// ─── Tables to reset between tests ──────────────────────────────────

const GAME_TABLES = [
  'battle_log',
  'battle_rating',
  'battle_team',
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
  'verification',
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

/** Run an arbitrary write statement (INSERT, UPDATE, DELETE). */
export async function execute(
  sql: string,
  ...params: Array<unknown>
): Promise<void> {
  await testExecute(sql, params)
}
