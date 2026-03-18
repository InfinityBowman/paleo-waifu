import { nanoid } from 'nanoid'

import type { BrowserContext } from '@playwright/test'

// ─── Constants ──────────────────────────────────────────────────────

export const TEST_USER_ID = 'e2e-user-001'
export const TEST_USER_ID_2 = 'e2e-user-002'
export const TEST_BANNER_ID = 'e2e-banner-001'
export const TEST_CREATURE_ID = 'e2e-creature-001'
export const TEST_CREATURE_ID_2 = 'e2e-creature-002'
export const TEST_CREATURE_ID_3 = 'e2e-creature-003'
export const TEST_CREATURE_ID_4 = 'e2e-creature-004'
export const TEST_CREATURE_ID_5 = 'e2e-creature-005'
export const TEST_CREATURE_ID_6 = 'e2e-creature-006'

// ─── Server URL ─────────────────────────────────────────────────────

function getWorkerUrl(): string {
  const url = process.env.__TEST_WORKER_URL
  if (!url) throw new Error('__TEST_WORKER_URL not set')
  return url
}

function getAuthSecret(): string {
  const secret = process.env.__TEST_AUTH_SECRET
  if (!secret) throw new Error('__TEST_AUTH_SECRET not set')
  return secret
}

// ─── DB Helpers (via /api/test endpoint) ────────────────────────────

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

// ─── Seed & Reset ───────────────────────────────────────────────────

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

export async function seedTestData() {
  const now = Math.floor(Date.now() / 1000)

  await testBatch([
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

    // Creatures (all 6 rarities represented)
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

    // Banner with all creatures in pool
    {
      sql: `INSERT OR REPLACE INTO banner (id, name, starts_at, is_active, rate_up_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: [TEST_BANNER_ID, 'Test Banner', now - 86400, 1, TEST_CREATURE_ID, now],
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

    // User 2
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

    // Currency
    {
      sql: `INSERT OR REPLACE INTO currency (id, user_id, fossils, updated_at)
            VALUES (?, ?, ?, ?)`,
      params: ['e2e-cur-001', TEST_USER_ID, 100, now],
    },
    {
      sql: `INSERT OR REPLACE INTO currency (id, user_id, fossils, updated_at)
            VALUES (?, ?, ?, ?)`,
      params: ['e2e-cur-002', TEST_USER_ID_2, 100, now],
    },

    // User creatures — 3 per user for trade tests
    {
      sql: `INSERT OR REPLACE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at)
            VALUES (?, ?, ?, ?, ?)`,
      params: ['e2e-uc-001', TEST_USER_ID, TEST_CREATURE_ID, TEST_BANNER_ID, now],
    },
    {
      sql: `INSERT OR REPLACE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at)
            VALUES (?, ?, ?, ?, ?)`,
      params: ['e2e-uc-002', TEST_USER_ID, TEST_CREATURE_ID_2, TEST_BANNER_ID, now],
    },
    {
      sql: `INSERT OR REPLACE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at)
            VALUES (?, ?, ?, ?, ?)`,
      params: ['e2e-uc-003', TEST_USER_ID, TEST_CREATURE_ID_3, TEST_BANNER_ID, now],
    },
    {
      sql: `INSERT OR REPLACE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at)
            VALUES (?, ?, ?, ?, ?)`,
      params: ['e2e-uc-004', TEST_USER_ID_2, TEST_CREATURE_ID_4, TEST_BANNER_ID, now],
    },
    {
      sql: `INSERT OR REPLACE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at)
            VALUES (?, ?, ?, ?, ?)`,
      params: ['e2e-uc-005', TEST_USER_ID_2, TEST_CREATURE_ID_5, TEST_BANNER_ID, now],
    },
    {
      sql: `INSERT OR REPLACE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at)
            VALUES (?, ?, ?, ?, ?)`,
      params: ['e2e-uc-006', TEST_USER_ID_2, TEST_CREATURE_ID_6, TEST_BANNER_ID, now],
    },

    // XP
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
  ])
}

// ─── Auth ───────────────────────────────────────────────────────────

async function signCookieValue(
  value: string,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(value),
  )
  const base64Sig = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return encodeURIComponent(`${value}.${base64Sig}`)
}

/**
 * Create an authenticated session and set the cookie on a Playwright browser context.
 */
export async function authenticate(
  context: BrowserContext,
  userId: string = TEST_USER_ID,
): Promise<void> {
  const sessionId = nanoid()
  const token = nanoid(32)
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
  const now = Math.floor(Date.now() / 1000)

  await testExecute(
    `INSERT INTO session (id, token, userId, expiresAt, createdAt, updatedAt, ipAddress, userAgent)
     VALUES (?, ?, ?, ?, ?, ?, '127.0.0.1', 'playwright')`,
    [sessionId, token, userId, expiresAt, now, now],
  )

  const signedToken = await signCookieValue(token, getAuthSecret())

  const url = new URL(getWorkerUrl())
  await context.addCookies([
    {
      name: 'better-auth.session_token',
      value: decodeURIComponent(signedToken),
      domain: url.hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
}
