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
  UNLINKED_DISCORD_USER_ID,
  TEST_DISCORD_USER_ID,
  TEST_APP_USER_ID,
} from '../helpers/db-seed'

beforeEach(async () => {
  loadKeypairFromEnv()
  setWorkerUrl(process.env.__TEST_WORKER_URL!)
  resetInteractionCounter()
  await resetTestData()
  await seedTestData()
})

describe('User resolution', () => {
  it('returns unlinked message for unknown Discord user', async () => {
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

  it('returns banned message for banned user', async () => {
    await execute('UPDATE user SET banned = 1 WHERE id = ?', TEST_APP_USER_ID)

    const interaction = buildCommandInteraction('balance', {
      userId: TEST_DISCORD_USER_ID,
    })
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.type).toBe(4)
    expect(body.data.flags).toBe(64)
    expect(body.data.content).toContain('banned')
  })

  it('resolves linked Discord user to app user', async () => {
    const interaction = buildCommandInteraction('balance', {
      userId: TEST_DISCORD_USER_ID,
    })
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.type).toBe(4)
    expect(body.data.content).toContain('Fossil')
  })
})
