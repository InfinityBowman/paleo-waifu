import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { setWorkerUrl, sendXpRequest } from '../helpers/worker-client'
import {
  seedTestData,
  resetTestData,
  closeDb,
  queryOne,
  TEST_DISCORD_USER_ID,
  TEST_APP_USER_ID,
  UNLINKED_DISCORD_USER_ID,
} from '../helpers/db-seed'

beforeEach(async () => {
  setWorkerUrl(process.env.__TEST_WORKER_URL!)
  await resetTestData()
  await seedTestData()
})

afterAll(() => closeDb())

describe('XP API', () => {
  it('rejects requests with invalid token', async () => {
    const res = await sendXpRequest(TEST_DISCORD_USER_ID, 'wrong-token')

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 404 for unlinked Discord user', async () => {
    const res = await sendXpRequest(UNLINKED_DISCORD_USER_ID)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('User not linked')
  })

  it('awards XP to linked user', async () => {
    const res = await sendXpRequest(TEST_DISCORD_USER_ID)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toBeDefined()

    // Verify XP increased in DB
    const row = await queryOne<{ xp: number }>(
      'SELECT xp FROM user_xp WHERE user_id = ?',
      TEST_APP_USER_ID,
    )
    expect(row).toBeDefined()
    expect(row!.xp).toBeGreaterThan(150) // Started at 150
  })

  it('rejects request with missing body', async () => {
    const res = await fetch(`${process.env.__TEST_WORKER_URL}/api/xp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-xp-secret',
      },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
  })
})
