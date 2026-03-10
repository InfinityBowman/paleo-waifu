import { beforeEach, describe, expect, test } from 'vitest'

import { createSession } from '../helpers/auth'
import { authenticatedPost } from '../helpers/client'
import {
  execute,
  queryOne,
  resetTestData,
  seedTestData,
  TEST_BANNER_ID,
  TEST_USER_ID,
} from '../helpers/db-seed'

beforeEach(async () => {
  await resetTestData()
  await seedTestData()
})

describe('gacha system', () => {
  test('single pull deducts 1 fossil, creates creature, updates pity', async () => {
    const cookie = await createSession(TEST_USER_ID)

    const res = await authenticatedPost(
      '/api/gacha',
      { action: 'pull', bannerId: TEST_BANNER_ID },
      cookie,
    )
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.results).toHaveLength(1)
    expect(body.fossils).toBe(99)

    // Verify result structure
    const result = body.results[0]
    expect(result.rarity).toBeDefined()
    expect(['common', 'uncommon', 'rare', 'epic', 'legendary']).toContain(
      result.rarity,
    )
    expect(result.name).toBeDefined()
    expect(result.userCreatureId).toBeDefined()

    // Verify creature created in DB (3 seeded + 1 pulled)
    const creatures = await queryOne<{ total: number }>(
      'SELECT COUNT(*) as total FROM user_creature WHERE user_id = ?',
      TEST_USER_ID,
    )
    expect(creatures?.total).toBe(4)

    // Verify pity counter updated
    const pity = await queryOne<{ total_pulls: number }>(
      'SELECT total_pulls FROM pity_counter WHERE user_id = ? AND banner_id = ?',
      TEST_USER_ID,
      TEST_BANNER_ID,
    )
    expect(pity).toBeDefined()
    expect(pity!.total_pulls).toBeGreaterThanOrEqual(1)
  })

  test('multi pull deducts 10 fossils and creates 10 creatures', async () => {
    const cookie = await createSession(TEST_USER_ID)

    const res = await authenticatedPost(
      '/api/gacha',
      { action: 'pull_multi', bannerId: TEST_BANNER_ID },
      cookie,
    )
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.results).toHaveLength(10)
    expect(body.fossils).toBe(90)

    // Verify 10 creatures were actually created in DB (3 seeded + 10 pulled)
    const creatures = await queryOne<{ total: number }>(
      'SELECT COUNT(*) as total FROM user_creature WHERE user_id = ?',
      TEST_USER_ID,
    )
    expect(creatures?.total).toBe(13)

    // Verify pity advanced by 10
    const pity = await queryOne<{ total_pulls: number }>(
      'SELECT total_pulls FROM pity_counter WHERE user_id = ? AND banner_id = ?',
      TEST_USER_ID,
      TEST_BANNER_ID,
    )
    expect(pity?.total_pulls).toBeGreaterThanOrEqual(10)
  })

  test('pull with insufficient fossils returns 402', async () => {
    await execute(
      'UPDATE currency SET fossils = 0 WHERE user_id = ?',
      TEST_USER_ID,
    )
    const cookie = await createSession(TEST_USER_ID)

    const single = await authenticatedPost(
      '/api/gacha',
      { action: 'pull', bannerId: TEST_BANNER_ID },
      cookie,
    )
    expect(single.status).toBe(402)

    // Restore some fossils for multi-pull test
    await execute(
      'UPDATE currency SET fossils = 9 WHERE user_id = ?',
      TEST_USER_ID,
    )
    const multi = await authenticatedPost(
      '/api/gacha',
      { action: 'pull_multi', bannerId: TEST_BANNER_ID },
      cookie,
    )
    expect(multi.status).toBe(402)
  })

  test('pull on inactive/non-existent banner returns 400', async () => {
    const cookie = await createSession(TEST_USER_ID)

    const fake = await authenticatedPost(
      '/api/gacha',
      { action: 'pull', bannerId: 'fake-banner-id' },
      cookie,
    )
    expect(fake.status).toBe(400)

    // Deactivate the banner
    await execute(
      'UPDATE banner SET is_active = 0 WHERE id = ?',
      TEST_BANNER_ID,
    )
    const inactive = await authenticatedPost(
      '/api/gacha',
      { action: 'pull', bannerId: TEST_BANNER_ID },
      cookie,
    )
    expect(inactive.status).toBe(400)
  })

  test('hard pity guarantees legendary at pull 90 and resets counter', async () => {
    const cookie = await createSession(TEST_USER_ID)
    await execute(
      'UPDATE currency SET fossils = 100 WHERE user_id = ?',
      TEST_USER_ID,
    )

    // Simulate the most unlucky player: 89 pulls with no legendary.
    // The 90th pull MUST be legendary (hard pity at HARD_PITY_THRESHOLD = 90).
    await execute(
      `INSERT OR REPLACE INTO pity_counter (id, user_id, banner_id, pulls_since_rare, pulls_since_legendary, total_pulls)
       VALUES (?, ?, ?, ?, ?, ?)`,
      'pity-test-001',
      TEST_USER_ID,
      TEST_BANNER_ID,
      0,
      89,
      89,
    )

    const res = await authenticatedPost(
      '/api/gacha',
      { action: 'pull', bannerId: TEST_BANNER_ID },
      cookie,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results[0].rarity).toBe('legendary')

    // Verify pity reset after legendary pull
    const pity = await queryOne<{ pulls_since_legendary: number }>(
      'SELECT pulls_since_legendary FROM pity_counter WHERE user_id = ? AND banner_id = ?',
      TEST_USER_ID,
      TEST_BANNER_ID,
    )
    expect(pity?.pulls_since_legendary).toBe(0)
  })

  test('sequential pulls: legendary guaranteed within 90 pulls', async () => {
    const cookie = await createSession(TEST_USER_ID)

    // Give enough fossils and seed pity at 85 (5 pulls away from hard pity).
    // Do 6 sequential single pulls — legendary MUST appear by pull 90 (the 5th pull here).
    await execute(
      'UPDATE currency SET fossils = 100 WHERE user_id = ?',
      TEST_USER_ID,
    )
    await execute(
      `INSERT OR REPLACE INTO pity_counter (id, user_id, banner_id, pulls_since_rare, pulls_since_legendary, total_pulls)
       VALUES (?, ?, ?, ?, ?, ?)`,
      'pity-test-001',
      TEST_USER_ID,
      TEST_BANNER_ID,
      0,
      85,
      85,
    )

    let foundLegendary = false
    let legendaryPullNumber = -1

    for (let i = 1; i <= 6; i++) {
      const res = await authenticatedPost(
        '/api/gacha',
        { action: 'pull', bannerId: TEST_BANNER_ID },
        cookie,
      )
      expect(res.status).toBe(200)
      const body = await res.json()

      if (body.results[0].rarity === 'legendary') {
        foundLegendary = true
        legendaryPullNumber = 85 + i // absolute pull number
        break
      }
    }

    expect(foundLegendary, 'legendary must appear within 90 pulls').toBe(true)
    // Hard pity fires at exactly pull 90 — legendary could appear earlier via soft pity
    // or random luck, but MUST appear by pull 90
    expect(legendaryPullNumber).toBeLessThanOrEqual(90)
  })

  test('daily claim awards 3 fossils, double-claim rejected', async () => {
    const cookie = await createSession(TEST_USER_ID)

    // First claim
    const res1 = await authenticatedPost(
      '/api/gacha',
      { action: 'claim_daily' },
      cookie,
    )
    expect(res1.status).toBe(200)
    const body1 = await res1.json()
    expect(body1.claimed).toBe(true)

    // Verify 103 fossils (100 + 3)
    const currency = await queryOne<{ fossils: number }>(
      'SELECT fossils FROM currency WHERE user_id = ?',
      TEST_USER_ID,
    )
    expect(currency?.fossils).toBe(103)

    // Second claim same day rejected
    const res2 = await authenticatedPost(
      '/api/gacha',
      { action: 'claim_daily' },
      cookie,
    )
    expect(res2.status).toBe(200)
    const body2 = await res2.json()
    expect(body2.claimed).toBe(false)
  })
})
