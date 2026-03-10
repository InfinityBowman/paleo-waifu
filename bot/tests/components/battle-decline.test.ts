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
  queryOne,
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

describe('battle_decline component', () => {
  it('declines challenge when defender clicks decline', async () => {
    const interaction = buildComponentInteraction(
      `battle_decline:${TEST_CHALLENGE_ID}`,
      { userId: TEST_DISCORD_USER_ID_2 }, // Defender
    )
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    // Should be UPDATE_MESSAGE (type 7) to update the original embed
    expect(body.type).toBe(7)

    // Verify DB status changed
    const challenge = await queryOne<{ status: string }>(
      'SELECT status FROM battle_challenge WHERE id = ?',
      TEST_CHALLENGE_ID,
    )
    expect(challenge!.status).toBe('declined')
  })

  it('rejects decline from non-defender with ephemeral error', async () => {
    const interaction = buildComponentInteraction(
      `battle_decline:${TEST_CHALLENGE_ID}`,
      { userId: TEST_DISCORD_USER_ID }, // Challenger, not defender
    )
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.type).toBe(4) // Ephemeral response
    expect(body.data.flags).toBe(64)
    expect(body.data.content).toContain('Only the challenged player')

    // Challenge should still be pending (not declined)
    const challenge = await queryOne<{ status: string }>(
      'SELECT status FROM battle_challenge WHERE id = ?',
      TEST_CHALLENGE_ID,
    )
    expect(challenge!.status).toBe('pending')
  })
})
