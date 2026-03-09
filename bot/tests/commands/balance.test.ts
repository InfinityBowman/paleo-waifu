import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { loadKeypairFromEnv } from '../helpers/crypto'
import { sendInteraction, setWorkerUrl } from '../helpers/worker-client'
import {
  buildCommandInteraction,
  resetInteractionCounter,
} from '../helpers/interaction-builder'
import {
  seedTestData,
  resetTestData,
  closeDb,
  TEST_DISCORD_USER_ID,
  UNLINKED_DISCORD_USER_ID,
} from '../helpers/db-seed'

beforeEach(async () => {
  loadKeypairFromEnv()
  setWorkerUrl(process.env.__TEST_WORKER_URL!)
  resetInteractionCounter()
  await resetTestData()
  await seedTestData()
})

afterAll(() => closeDb())

describe('/balance', () => {
  it('returns correct fossil count for linked user', async () => {
    const interaction = buildCommandInteraction('balance', {
      userId: TEST_DISCORD_USER_ID,
    })
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.type).toBe(4)
    expect(body.data.flags).toBe(64) // Ephemeral
    // Test user has 100 fossils
    expect(body.data.content).toContain('100')
  })

  it('returns unlinked message for unlinked user', async () => {
    const interaction = buildCommandInteraction('balance', {
      userId: UNLINKED_DISCORD_USER_ID,
    })
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.type).toBe(4)
    expect(body.data.flags).toBe(64)
    expect(body.data.content).toContain('link')
  })
})
