import { describe, it, expect, beforeEach } from 'vitest'
import { loadKeypairFromEnv } from '../helpers/crypto'
import { sendInteraction, setWorkerUrl } from '../helpers/worker-client'
import {
  buildCommandInteraction,
  resetInteractionCounter,
} from '../helpers/interaction-builder'
import {
  seedTestData,
  resetTestData,
  execute,
  TEST_DISCORD_USER_ID,
  TEST_APP_USER_ID,
  TEST_BANNER_ID,
} from '../helpers/db-seed'

beforeEach(async () => {
  loadKeypairFromEnv()
  setWorkerUrl(process.env.__TEST_WORKER_URL!)
  resetInteractionCounter()
  await resetTestData()
  await seedTestData()
})

describe('/pity', () => {
  it('returns pity info for active banner', async () => {
    await execute(
      `INSERT INTO pity_counter (id, user_id, banner_id, pulls_since_rare, pulls_since_legendary, total_pulls)
       VALUES (?, ?, ?, ?, ?, ?)`,
      'pity-001', TEST_APP_USER_ID, TEST_BANNER_ID, 5, 15, 20,
    )

    const interaction = buildCommandInteraction('pity', {
      userId: TEST_DISCORD_USER_ID,
    })
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.type).toBe(4)
    expect(body.data.flags).toBe(64)

    const content = body.data.content
    expect(content).toContain('Test Banner')
    expect(content).toContain('20')
    expect(content).toContain('5')
    expect(content).toContain('15')
  })

  it('shows zero pity for new user on banner', async () => {
    const interaction = buildCommandInteraction('pity', {
      userId: TEST_DISCORD_USER_ID,
    })
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.content).toContain('Total pulls: **0**')
  })

  it('handles no active banner', async () => {
    await execute(
      'UPDATE banner SET is_active = 0 WHERE id = ?',
      TEST_BANNER_ID,
    )

    const interaction = buildCommandInteraction('pity', {
      userId: TEST_DISCORD_USER_ID,
    })
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.content).toContain('No active banner')
  })
})
