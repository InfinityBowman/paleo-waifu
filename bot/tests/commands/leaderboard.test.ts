import { beforeEach, describe, expect, it } from 'vitest'
import { loadKeypairFromEnv } from '../helpers/crypto'
import { sendInteraction, setWorkerUrl } from '../helpers/worker-client'
import {
  buildCommandInteraction,
  resetInteractionCounter,
} from '../helpers/interaction-builder'
import { resetTestData, seedTestData } from '../helpers/db-seed'

beforeEach(async () => {
  loadKeypairFromEnv()
  setWorkerUrl(process.env.__TEST_WORKER_URL!)
  resetInteractionCounter()
  await resetTestData()
  await seedTestData()
})

describe('/leaderboard-xp', () => {
  it('returns embed with XP rankings', async () => {
    const interaction = buildCommandInteraction('leaderboard-xp')
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.type).toBe(4) // CHANNEL_MESSAGE_WITH_SOURCE (not ephemeral)

    const embeds = body.data.embeds
    expect(embeds).toBeDefined()
    expect(embeds.length).toBeGreaterThan(0)

    // Should contain user names from seeded data
    const embedText = JSON.stringify(embeds)
    expect(embedText).toContain('TestUser')
  })

  it('does not require auth', async () => {
    const interaction = buildCommandInteraction('leaderboard-xp', {
      userId: '000000000000000000', // Unlinked
    })
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    // Should NOT be the unlinked message
    expect(body.data.embeds).toBeDefined()
  })
})

describe('/leaderboard-collection', () => {
  it('returns embed with collection rankings', async () => {
    const interaction = buildCommandInteraction('leaderboard-collection')
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.type).toBe(4)

    const embeds = body.data.embeds
    expect(embeds).toBeDefined()
    expect(embeds.length).toBeGreaterThan(0)
  })
})
