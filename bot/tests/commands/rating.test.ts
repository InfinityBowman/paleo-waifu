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
  TEST_DISCORD_USER_ID_2,
  TEST_APP_USER_ID,
  UNLINKED_DISCORD_USER_ID,
} from '../helpers/db-seed'
import { ApplicationCommandOptionType } from '../../src/lib/discord'

beforeEach(async () => {
  loadKeypairFromEnv()
  setWorkerUrl(process.env.__TEST_WORKER_URL!)
  resetInteractionCounter()
  await resetTestData()
  await seedTestData()
})

describe('/rating', () => {
  it('returns own rating (default 0 for new user)', async () => {
    const interaction = buildCommandInteraction('rating', {
      userId: TEST_DISCORD_USER_ID,
    })
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.type).toBe(4)
    expect(body.data.flags).toBe(64)

    const embedText = JSON.stringify(body.data.embeds)
    expect(embedText).toContain('Bronze') // 0 rating = Bronze tier
  })

  it('shows rating with wins/losses', async () => {
    await execute(
      `INSERT OR REPLACE INTO battle_rating (user_id, rating, wins, losses)
       VALUES (?, ?, ?, ?)`,
      TEST_APP_USER_ID, 750, 10, 5,
    )

    const interaction = buildCommandInteraction('rating', {
      userId: TEST_DISCORD_USER_ID,
    })
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = await res.json()
    const embedText = JSON.stringify(body.data.embeds)
    expect(embedText).toContain('Silver') // 750 = Silver tier
    expect(embedText).toContain('10') // wins
    expect(embedText).toContain('5') // losses
  })

  it('can check another user rating', async () => {
    const interaction = buildCommandInteraction('rating', {
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
    const body = await res.json()
    expect(body.type).toBe(4)
    expect(body.data.embeds).toBeDefined()
  })

  it('returns error for unlinked target user', async () => {
    const interaction = buildCommandInteraction('rating', {
      userId: TEST_DISCORD_USER_ID,
      options: [
        {
          name: 'user',
          type: ApplicationCommandOptionType.USER,
          value: UNLINKED_DISCORD_USER_ID,
        },
      ],
    })
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.content).toContain('linked')
  })
})
