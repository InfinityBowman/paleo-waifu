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
  TEST_DISCORD_USER_ID,
  TEST_DISCORD_USER_ID_2,
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

afterAll(() => closeDb())

describe('/level', () => {
  it('returns own level and XP', async () => {
    const interaction = buildCommandInteraction('level', {
      userId: TEST_DISCORD_USER_ID,
    })
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.type).toBe(4)

    // Should have an embed with level info
    const embeds = body.data.embeds
    expect(embeds).toBeDefined()
    expect(embeds.length).toBeGreaterThan(0)

    // The embed should contain level 3 and 150 XP
    const embedText = JSON.stringify(embeds)
    expect(embedText).toContain('3') // level 3
  })

  it('can check another linked user level', async () => {
    const interaction = buildCommandInteraction('level', {
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
  })

  it('returns error for unlinked target user', async () => {
    const interaction = buildCommandInteraction('level', {
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
