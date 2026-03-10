import { beforeEach, describe, expect, test } from 'vitest'

import { createSession } from '../helpers/auth'
import { authenticatedPost, unauthenticatedPost } from '../helpers/client'
import {
  TEST_ADMIN_ID,
  TEST_USER_ID,
  TEST_USER_ID_2,
  queryOne,
  resetTestData,
  seedTestData,
} from '../helpers/db-seed'

beforeEach(async () => {
  await resetTestData()
  await seedTestData()
})

describe('admin operations', () => {
  test('unauthenticated returns 401, non-admin returns 403', async () => {
    const unauth = await unauthenticatedPost('/api/admin', {
      action: 'adjust_fossils',
      userId: TEST_USER_ID,
      amount: 50,
    })
    expect(unauth.status).toBe(401)

    const cookie = await createSession(TEST_USER_ID)
    const nonAdmin = await authenticatedPost(
      '/api/admin',
      { action: 'adjust_fossils', userId: TEST_USER_ID_2, amount: 50 },
      cookie,
    )
    expect(nonAdmin.status).toBe(403)
  })

  test('adjust fossils: add and negative floors at 0', async () => {
    const cookie = await createSession(TEST_ADMIN_ID)

    // Add fossils
    const addRes = await authenticatedPost(
      '/api/admin',
      { action: 'adjust_fossils', userId: TEST_USER_ID, amount: 50 },
      cookie,
    )
    expect(addRes.status).toBe(200)
    const addBody = await addRes.json()
    expect(addBody.fossils).toBe(150) // 100 + 50

    // Remove more than available (floors at 0)
    const removeRes = await authenticatedPost(
      '/api/admin',
      { action: 'adjust_fossils', userId: TEST_USER_ID, amount: -200 },
      cookie,
    )
    expect(removeRes.status).toBe(200)
    const removeBody = await removeRes.json()
    expect(removeBody.fossils).toBe(0)
  })

  test('ban and unban a user', async () => {
    const cookie = await createSession(TEST_ADMIN_ID)

    // Ban
    const banRes = await authenticatedPost(
      '/api/admin',
      { action: 'ban_user', userId: TEST_USER_ID_2, banReason: 'Test ban' },
      cookie,
    )
    expect(banRes.status).toBe(200)

    const banned = await queryOne<{ banned: number; banReason: string }>(
      'SELECT banned, banReason FROM user WHERE id = ?',
      TEST_USER_ID_2,
    )
    expect(banned?.banned).toBe(1)
    expect(banned?.banReason).toBe('Test ban')

    // Unban
    const unbanRes = await authenticatedPost(
      '/api/admin',
      { action: 'unban_user', userId: TEST_USER_ID_2 },
      cookie,
    )
    expect(unbanRes.status).toBe(200)

    const unbanned = await queryOne<{ banned: number }>(
      'SELECT banned FROM user WHERE id = ?',
      TEST_USER_ID_2,
    )
    expect(unbanned?.banned).toBe(0)
  })

  test('set user role', async () => {
    const cookie = await createSession(TEST_ADMIN_ID)

    const res = await authenticatedPost(
      '/api/admin',
      { action: 'set_role', userId: TEST_USER_ID, role: 'editor' },
      cookie,
    )
    expect(res.status).toBe(200)

    const user = await queryOne<{ role: string }>(
      'SELECT role FROM user WHERE id = ?',
      TEST_USER_ID,
    )
    expect(user?.role).toBe('editor')
  })
})
