import { beforeEach, describe, expect, test } from 'vitest'

import { createSession } from '../helpers/auth'
import { authenticatedPost } from '../helpers/client'
import {
  TEST_UC_ID_1,
  TEST_UC_ID_4,
  TEST_USER_ID,
  queryOne,
  resetTestData,
  seedTestData,
} from '../helpers/db-seed'

beforeEach(async () => {
  await resetTestData()
  await seedTestData()
})

describe('collection management', () => {
  test('toggle favorite on and off with DB verification', async () => {
    const cookie = await createSession(TEST_USER_ID)

    // Toggle on
    const res1 = await authenticatedPost(
      '/api/collection',
      { action: 'toggleFavorite', userCreatureId: TEST_UC_ID_1 },
      cookie,
    )
    expect(res1.status).toBe(200)
    const body1 = await res1.json()
    expect(body1.isFavorite).toBe(true)

    const row1 = await queryOne<{ is_favorite: number }>(
      'SELECT is_favorite FROM user_creature WHERE id = ?',
      TEST_UC_ID_1,
    )
    expect(row1?.is_favorite).toBe(1)

    // Toggle off
    const res2 = await authenticatedPost(
      '/api/collection',
      { action: 'toggleFavorite', userCreatureId: TEST_UC_ID_1 },
      cookie,
    )
    expect(res2.status).toBe(200)
    const body2 = await res2.json()
    expect(body2.isFavorite).toBe(false)

    // Verify DB state after toggle-off
    const row2 = await queryOne<{ is_favorite: number }>(
      'SELECT is_favorite FROM user_creature WHERE id = ?',
      TEST_UC_ID_1,
    )
    expect(row2?.is_favorite).toBe(0)
  })

  test("cannot favorite another user's creature", async () => {
    const cookie = await createSession(TEST_USER_ID)

    // TEST_UC_ID_4 belongs to user-002
    const res = await authenticatedPost(
      '/api/collection',
      { action: 'toggleFavorite', userCreatureId: TEST_UC_ID_4 },
      cookie,
    )
    expect(res.status).toBe(404)
  })
})
