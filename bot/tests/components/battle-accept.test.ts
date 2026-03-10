import { beforeEach, describe, expect, it } from 'vitest'
import { loadKeypairFromEnv } from '../helpers/crypto'
import { sendInteraction, setWorkerUrl } from '../helpers/worker-client'
import {
  buildComponentInteraction,
  resetInteractionCounter,
} from '../helpers/interaction-builder'
import {
  TEST_DISCORD_USER_ID,
  TEST_DISCORD_USER_ID_2,
  resetTestData,
  seedTestData,
} from '../helpers/db-seed'
import {
  TEST_CHALLENGE_ID,
  seedBattleData,
  seedPendingChallenge,
} from '../helpers/battle-seed'

beforeEach(async () => {
  loadKeypairFromEnv()
  setWorkerUrl(process.env.__TEST_WORKER_URL!)
  resetInteractionCounter()
  await resetTestData()
  await seedTestData()
  await seedBattleData()
  await seedPendingChallenge()
})

describe('battle_accept component', () => {
  it('returns deferred ephemeral response for defender', async () => {
    const interaction = buildComponentInteraction(
      `battle_accept:${TEST_CHALLENGE_ID}`,
      { userId: TEST_DISCORD_USER_ID_2 }, // Defender
    )
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    // Should be deferred (type 5) with ephemeral flag
    expect(body.type).toBe(5)
    expect(body.data?.flags).toBe(64)
  })

  it('still defers for non-defender (error sent in followup)', async () => {
    const interaction = buildComponentInteraction(
      `battle_accept:${TEST_CHALLENGE_ID}`,
      { userId: TEST_DISCORD_USER_ID }, // Challenger, not defender
    )
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    // Always returns deferred (type 5) — error is edited in the deferred callback
    expect(body.type).toBe(5)
    expect(body.data?.flags).toBe(64)
  })
})
