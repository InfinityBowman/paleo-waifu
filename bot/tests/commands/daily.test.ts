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
  queryOne,
  TEST_DISCORD_USER_ID,
  TEST_APP_USER_ID,
} from '../helpers/db-seed'
import { pollUntil } from '../helpers/poll'

beforeEach(async () => {
  loadKeypairFromEnv()
  setWorkerUrl(process.env.__TEST_WORKER_URL!)
  resetInteractionCounter()
  await resetTestData()
  await seedTestData()
})

afterAll(() => closeDb())

describe('/daily', () => {
  it('returns deferred response (type 5)', async () => {
    const interaction = buildCommandInteraction('daily', {
      userId: TEST_DISCORD_USER_ID,
    })
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.type).toBe(5) // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
  })

  it('awards daily fossils and updates lastDailyClaim', async () => {
    const interaction = buildCommandInteraction('daily', {
      userId: TEST_DISCORD_USER_ID,
    })
    await sendInteraction(interaction)

    // Poll for fossils to increase (started at 100, should go to 103)
    const row = await pollUntil(async () => {
      const r = await queryOne<{ fossils: number; last_daily_claim: number }>(
        'SELECT fossils, last_daily_claim FROM currency WHERE user_id = ?',
        TEST_APP_USER_ID,
      )
      return r && r.fossils > 100 ? r : null
    })

    expect(row).toBeDefined()
    expect(row!.fossils).toBe(103) // 100 + 3 daily
    expect(row!.last_daily_claim).toBeDefined()
  })

  it('blocks double-claim on same day', async () => {
    // First claim
    const interaction1 = buildCommandInteraction('daily', {
      userId: TEST_DISCORD_USER_ID,
    })
    await sendInteraction(interaction1)

    // Wait for first claim to process
    await pollUntil(async () => {
      const r = await queryOne<{ fossils: number }>(
        'SELECT fossils FROM currency WHERE user_id = ?',
        TEST_APP_USER_ID,
      )
      return r && r.fossils > 100 ? r : null
    })

    // Second claim — should NOT add more fossils
    const interaction2 = buildCommandInteraction('daily', {
      userId: TEST_DISCORD_USER_ID,
    })
    const res = await sendInteraction(interaction2)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.type).toBe(5) // Still deferred

    // Give the worker a moment to process
    await new Promise((r) => setTimeout(r, 1000))

    // Fossils should still be 103 (not 106)
    const row = await queryOne<{ fossils: number }>(
      'SELECT fossils FROM currency WHERE user_id = ?',
      TEST_APP_USER_ID,
    )
    expect(row!.fossils).toBe(103)
  })
})
