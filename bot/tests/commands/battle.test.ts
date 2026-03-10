import { beforeEach, describe, expect, it } from 'vitest'
import { loadKeypairFromEnv } from '../helpers/crypto'
import { sendInteraction, setWorkerUrl } from '../helpers/worker-client'
import {
  buildCommandInteraction,
  resetInteractionCounter,
} from '../helpers/interaction-builder'
import {
  TEST_APP_USER_ID,
  TEST_DISCORD_USER_ID,
  TEST_DISCORD_USER_ID_2,
  queryOne,
  resetTestData,
  seedTestData,
} from '../helpers/db-seed'
import { seedBattleData } from '../helpers/battle-seed'
import { pollUntil } from '../helpers/poll'
import { ApplicationCommandOptionType } from '../../src/lib/discord'

beforeEach(async () => {
  loadKeypairFromEnv()
  setWorkerUrl(process.env.__TEST_WORKER_URL!)
  resetInteractionCounter()
  await resetTestData()
  await seedTestData()
  await seedBattleData()
})

describe('/battle', () => {
  it('returns deferred response', async () => {
    const interaction = buildCommandInteraction('battle', {
      userId: TEST_DISCORD_USER_ID,
      options: [
        {
          name: 'user',
          type: ApplicationCommandOptionType.USER,
          value: TEST_DISCORD_USER_ID_2,
        },
      ],
    })
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.type).toBe(5)
  })

  it('creates a pending battle challenge in DB', async () => {
    const interaction = buildCommandInteraction('battle', {
      userId: TEST_DISCORD_USER_ID,
      options: [
        {
          name: 'user',
          type: ApplicationCommandOptionType.USER,
          value: TEST_DISCORD_USER_ID_2,
        },
      ],
    })
    await sendInteraction(interaction)

    // Poll for challenge to be created
    const challenge = await pollUntil(
      async () => {
        return queryOne<{ id: string; status: string; challenger_id: string }>(
          'SELECT id, status, challenger_id FROM battle_challenge WHERE challenger_id = ?',
          TEST_APP_USER_ID,
        )
      },
      { timeoutMs: 10_000 },
    )

    expect(challenge).toBeDefined()
    expect(challenge.status).toBe('pending')
    expect(challenge.challenger_id).toBe(TEST_APP_USER_ID)
  })
})
