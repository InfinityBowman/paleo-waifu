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
  queryOne,
  queryAll,
  execute,
  TEST_DISCORD_USER_ID,
  TEST_APP_USER_ID,
} from '../helpers/db-seed'
import { pollUntil } from '../helpers/poll'

beforeEach(async () => {
  loadKeypairFromEnv()
  setWorkerUrl(process.env.__TEST_WORKER_URL!)
  resetInteractionCounter()
  await resetTestData()
  await seedTestData()
})

describe('/pull', () => {
  it('returns deferred response (type 5, non-ephemeral)', async () => {
    const interaction = buildCommandInteraction('pull', {
      userId: TEST_DISCORD_USER_ID,
    })
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.type).toBe(5)
    expect(body.data?.flags).toBeUndefined()
  })

  it('deducts 1 fossil and creates a user_creature', async () => {
    const interaction = buildCommandInteraction('pull', {
      userId: TEST_DISCORD_USER_ID,
    })
    await sendInteraction(interaction)

    // Poll for the new creature to appear (1 seeded + 1 pulled = 2)
    await pollUntil(
      async () => {
        const rows = await queryAll<{ id: string }>(
          'SELECT id FROM user_creature WHERE user_id = ?',
          TEST_APP_USER_ID,
        )
        return rows.length >= 2 ? rows : null
      },
      { timeoutMs: 10_000 },
    )

    const currency = await queryOne<{ fossils: number }>(
      'SELECT fossils FROM currency WHERE user_id = ?',
      TEST_APP_USER_ID,
    )
    expect(currency!.fossils).toBe(99)

    const creatures = await queryAll<{ id: string }>(
      'SELECT id FROM user_creature WHERE user_id = ?',
      TEST_APP_USER_ID,
    )
    expect(creatures.length).toBe(2)
  })

  it('updates pity counter after pull', async () => {
    const interaction = buildCommandInteraction('pull', {
      userId: TEST_DISCORD_USER_ID,
    })
    await sendInteraction(interaction)

    const pity = await pollUntil(
      async () => {
        const r = await queryOne<{ total_pulls: number }>(
          'SELECT total_pulls FROM pity_counter WHERE user_id = ?',
          TEST_APP_USER_ID,
        )
        return r && r.total_pulls > 0 ? r : null
      },
      { timeoutMs: 10_000 },
    )

    expect(pity!.total_pulls).toBe(1)
  })
})

describe('/pull10', () => {
  it('returns deferred response', async () => {
    const interaction = buildCommandInteraction('pull10', {
      userId: TEST_DISCORD_USER_ID,
    })
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.type).toBe(5)
  })

  it('deducts 10 fossils and creates 10 user_creatures', async () => {
    const interaction = buildCommandInteraction('pull10', {
      userId: TEST_DISCORD_USER_ID,
    })
    await sendInteraction(interaction)

    // Poll for creatures to appear (1 seeded + 10 pulled = 11)
    await pollUntil(
      async () => {
        const rows = await queryAll<{ id: string }>(
          'SELECT id FROM user_creature WHERE user_id = ?',
          TEST_APP_USER_ID,
        )
        return rows.length >= 11 ? rows : null
      },
      { timeoutMs: 15_000 },
    )

    const currency = await queryOne<{ fossils: number }>(
      'SELECT fossils FROM currency WHERE user_id = ?',
      TEST_APP_USER_ID,
    )
    expect(currency!.fossils).toBe(90)

    const creatures = await queryAll<{ id: string }>(
      'SELECT id FROM user_creature WHERE user_id = ?',
      TEST_APP_USER_ID,
    )
    expect(creatures.length).toBe(11)
  })

  it('rejects pull when insufficient fossils', async () => {
    await execute(
      'UPDATE currency SET fossils = 5 WHERE user_id = ?',
      TEST_APP_USER_ID,
    )

    const interaction = buildCommandInteraction('pull10', {
      userId: TEST_DISCORD_USER_ID,
    })
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.type).toBe(5)

    // Give the worker time to process the deferred response
    await new Promise((r) => setTimeout(r, 1500))

    const currency = await queryOne<{ fossils: number }>(
      'SELECT fossils FROM currency WHERE user_id = ?',
      TEST_APP_USER_ID,
    )
    expect(currency!.fossils).toBe(5)
  })
})
