import { beforeEach, describe, expect, it } from 'vitest'
import { loadKeypairFromEnv } from '../helpers/crypto'
import { sendInteraction, setWorkerUrl } from '../helpers/worker-client'
import {
  buildCommandInteraction,
  resetInteractionCounter,
} from '../helpers/interaction-builder'
import {
  TEST_DISCORD_USER_ID,
  UNLINKED_DISCORD_USER_ID,
  resetTestData,
  seedTestData,
} from '../helpers/db-seed'

beforeEach(async () => {
  loadKeypairFromEnv()
  setWorkerUrl(process.env.__TEST_WORKER_URL!)
  resetInteractionCounter()
  await resetTestData()
  await seedTestData()
})

describe('/balance', () => {
  it('returns correct fossil count for linked user', async () => {
    const interaction = buildCommandInteraction('balance', {
      userId: TEST_DISCORD_USER_ID,
    })
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
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
    const body = (await res.json()) as any
    expect(body.type).toBe(4)
    expect(body.data.flags).toBe(64)
    expect(body.data.content).toContain('link')
  })
})
