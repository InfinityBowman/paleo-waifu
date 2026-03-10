import { beforeEach, describe, expect, test } from 'vitest'

import { createSession } from '../helpers/auth'
import {
  authenticatedGet,
  authenticatedPost,
  crossOriginPost,
  unauthenticatedGet,
} from '../helpers/client'
import {
  resetTestData,
  seedTestData,
  TEST_ADMIN_ID,
  TEST_USER_ID,
} from '../helpers/db-seed'

beforeEach(async () => {
  await resetTestData()
  await seedTestData()
})

describe('auth + CSRF security', () => {
  test('protected routes redirect unauthenticated users to /', async () => {
    const protectedPaths = [
      '/gacha',
      '/collection',
      '/trade',
      '/profile',
      '/battle',
      '/battle/some-fake-id',
      '/admin',
    ]

    for (const path of protectedPaths) {
      const res = await unauthenticatedGet(path)
      expect(res.status, `${path} should redirect`).toBeGreaterThanOrEqual(300)
      expect(res.status, `${path} should be 3xx`).toBeLessThan(400)
    }
  })

  test('authenticated user can access protected routes', async () => {
    const cookie = await createSession(TEST_USER_ID)

    const gacha = await authenticatedGet('/gacha', cookie)
    expect(gacha.status).toBe(200)

    const collection = await authenticatedGet('/collection', cookie)
    expect(collection.status).toBe(200)
  })

  test('non-admin is blocked from /admin, admin can access', async () => {
    const userCookie = await createSession(TEST_USER_ID)
    const userRes = await authenticatedGet('/admin', userCookie)
    // Should redirect (3xx) — not 200 and not a server error (5xx)
    expect(userRes.status).toBeGreaterThanOrEqual(300)
    expect(userRes.status).toBeLessThan(400)

    const adminCookie = await createSession(TEST_ADMIN_ID)
    const adminRes = await authenticatedGet('/admin', adminCookie)
    expect(adminRes.status).toBe(200)
  })

  test('cross-origin POST rejected on all mutation endpoints', async () => {
    const cookie = await createSession(TEST_USER_ID)
    const endpoints = [
      '/api/gacha',
      '/api/trade',
      '/api/battle',
      '/api/collection',
      '/api/admin',
    ]

    for (const endpoint of endpoints) {
      const res = await crossOriginPost(endpoint, {}, cookie)
      expect(
        res.status,
        `${endpoint} should reject cross-origin`,
      ).toBe(403)
    }
  })

  test('same-origin POST passes CSRF check', async () => {
    const cookie = await createSession(TEST_USER_ID)
    const res = await authenticatedPost(
      '/api/gacha',
      { action: 'claim_daily' },
      cookie,
    )
    expect(res.status).not.toBe(403)
  })
})
