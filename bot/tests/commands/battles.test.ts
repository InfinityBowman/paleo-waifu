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
  TEST_DISCORD_USER_ID,
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
    const body = await res.json()
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
    const body = await res.json()
    expect(body.type).toBe(4)

    const embedText = JSON.stringify(body.data.embeds ?? [])
    const content = body.data.content ?? ''
    const fullText = content + embedText
    // Should mention pending challenge or the opponent
    expect(fullText.length).toBeGreaterThan(0)
  })
})
