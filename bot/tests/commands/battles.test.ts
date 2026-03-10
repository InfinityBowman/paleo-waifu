import { beforeEach, describe, expect, it } from 'vitest'
import { loadKeypairFromEnv } from '../helpers/crypto'
import { sendInteraction, setWorkerUrl } from '../helpers/worker-client'
import {
  buildCommandInteraction,
  resetInteractionCounter,
} from '../helpers/interaction-builder'
import {
  TEST_DISCORD_USER_ID,
  resetTestData,
  seedTestData,
} from '../helpers/db-seed'
import { seedBattleData, seedPendingChallenge } from '../helpers/battle-seed'

beforeEach(async () => {
  loadKeypairFromEnv()
  setWorkerUrl(process.env.__TEST_WORKER_URL!)
  resetInteractionCounter()
  await resetTestData()
  await seedTestData()
})

describe('/battles', () => {
  it('returns empty battles list for user with no challenges', async () => {
    const interaction = buildCommandInteraction('battles', {
      userId: TEST_DISCORD_USER_ID,
    })
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.type).toBe(4)
    expect(body.data.flags).toBe(64)
  })

  it('shows pending challenges', async () => {
    await seedBattleData()
    await seedPendingChallenge()

    const interaction = buildCommandInteraction('battles', {
      userId: TEST_DISCORD_USER_ID,
    })
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.type).toBe(4)

    // Should have at least one embed showing the pending challenge
    expect(body.data.embeds?.length).toBeGreaterThan(0)
    const embedText = JSON.stringify(body.data.embeds)
    // Should mention the opponent or pending status
    expect(embedText).toContain('TestUser2')
  })
})
