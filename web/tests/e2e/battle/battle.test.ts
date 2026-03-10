import { beforeEach, describe, expect, test } from 'vitest'

import { createSession } from '../helpers/auth'
import { authenticatedPost } from '../helpers/client'
import {
  execute,
  queryOne,
  resetTestData,
  seedTestData,
  TEST_UC_ID_1,
  TEST_UC_ID_2,
  TEST_UC_ID_3,
  TEST_UC_ID_4,
  TEST_UC_ID_5,
  TEST_UC_ID_6,
  TEST_USER_ID,
  TEST_USER_ID_2,
} from '../helpers/db-seed'

async function setupBothTeams() {
  const cookie1 = await createSession(TEST_USER_ID)
  const r1 = await authenticatedPost(
    '/api/battle',
    {
      action: 'set_team',
      slot: 'offense',
      members: [
        { userCreatureId: TEST_UC_ID_1, row: 'front' },
        { userCreatureId: TEST_UC_ID_2, row: 'front' },
        { userCreatureId: TEST_UC_ID_3, row: 'back' },
      ],
    },
    cookie1,
  )
  expect(r1.status, 'offense team setup failed').toBe(200)

  const cookie2 = await createSession(TEST_USER_ID_2)
  const r2 = await authenticatedPost(
    '/api/battle',
    {
      action: 'set_team',
      slot: 'defense',
      members: [
        { userCreatureId: TEST_UC_ID_4, row: 'front' },
        { userCreatureId: TEST_UC_ID_5, row: 'front' },
        { userCreatureId: TEST_UC_ID_6, row: 'back' },
      ],
    },
    cookie2,
  )
  expect(r2.status, 'defense team setup failed').toBe(200)

  return cookie1
}

beforeEach(async () => {
  await resetTestData()
  await seedTestData()
})

describe('battle system', () => {
  test('set offense team and verify in DB', async () => {
    const cookie = await createSession(TEST_USER_ID)

    const res = await authenticatedPost(
      '/api/battle',
      {
        action: 'set_team',
        slot: 'offense',
        members: [
          { userCreatureId: TEST_UC_ID_1, row: 'front' },
          { userCreatureId: TEST_UC_ID_2, row: 'front' },
          { userCreatureId: TEST_UC_ID_3, row: 'back' },
        ],
      },
      cookie,
    )
    expect(res.status).toBe(200)

    const team = await queryOne<{ slot: string; members: string }>(
      'SELECT slot, members FROM battle_team WHERE user_id = ? AND slot = ?',
      TEST_USER_ID,
      'offense',
    )
    expect(team).toBeDefined()
    expect(team!.slot).toBe('offense')
    expect(JSON.parse(team!.members)).toHaveLength(3)
  })

  test('team validation: duplicates, non-owned, and locked creatures rejected', async () => {
    const cookie = await createSession(TEST_USER_ID)

    // Duplicate creatures
    const dupRes = await authenticatedPost(
      '/api/battle',
      {
        action: 'set_team',
        slot: 'offense',
        members: [
          { userCreatureId: TEST_UC_ID_1, row: 'front' },
          { userCreatureId: TEST_UC_ID_1, row: 'front' },
          { userCreatureId: TEST_UC_ID_3, row: 'back' },
        ],
      },
      cookie,
    )
    expect(dupRes.status).toBe(400)

    // Non-owned creature (UC-004 belongs to user-002)
    const nonOwnedRes = await authenticatedPost(
      '/api/battle',
      {
        action: 'set_team',
        slot: 'offense',
        members: [
          { userCreatureId: TEST_UC_ID_1, row: 'front' },
          { userCreatureId: TEST_UC_ID_2, row: 'front' },
          { userCreatureId: TEST_UC_ID_4, row: 'back' },
        ],
      },
      cookie,
    )
    expect(nonOwnedRes.status).toBe(400)

    // Locked creature
    await execute(
      'UPDATE user_creature SET is_locked = 1 WHERE id = ?',
      TEST_UC_ID_1,
    )
    const lockedRes = await authenticatedPost(
      '/api/battle',
      {
        action: 'set_team',
        slot: 'offense',
        members: [
          { userCreatureId: TEST_UC_ID_1, row: 'front' },
          { userCreatureId: TEST_UC_ID_2, row: 'front' },
          { userCreatureId: TEST_UC_ID_3, row: 'back' },
        ],
      },
      cookie,
    )
    expect(lockedRes.status).toBe(400)
  })

  test('arena attack: executes battle, creates log, updates ratings', async () => {
    const cookie1 = await setupBothTeams()

    const res = await authenticatedPost(
      '/api/battle',
      { action: 'arena_attack', defenderId: TEST_USER_ID_2 },
      cookie1,
    )
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.battleId).toBeDefined()

    // Verify battle log
    const log = await queryOne<{
      mode: string
      attacker_id: string
      defender_id: string
    }>(
      'SELECT mode, attacker_id, defender_id FROM battle_log WHERE id = ?',
      body.battleId,
    )
    expect(log?.mode).toBe('arena')
    expect(log?.attacker_id).toBe(TEST_USER_ID)
    expect(log?.defender_id).toBe(TEST_USER_ID_2)

    // Verify rating updated
    const attackerRating = await queryOne<{ wins: number; losses: number }>(
      'SELECT wins, losses FROM battle_rating WHERE user_id = ?',
      TEST_USER_ID,
    )
    expect(attackerRating).toBeDefined()
    expect(attackerRating!.wins + attackerRating!.losses).toBe(1)
  })

  test('arena daily limit: 5 attacks succeed, 6th rejected', async () => {
    const cookie1 = await setupBothTeams()

    for (let i = 1; i <= 5; i++) {
      const res = await authenticatedPost(
        '/api/battle',
        { action: 'arena_attack', defenderId: TEST_USER_ID_2 },
        cookie1,
      )
      expect(res.status, `attack ${i} should succeed`).toBe(200)
    }

    // 6th attack rejected
    const res = await authenticatedPost(
      '/api/battle',
      { action: 'arena_attack', defenderId: TEST_USER_ID_2 },
      cookie1,
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('no arena attacks remaining')
  })

  test('friendly battle: executes, no rating change, null rating_change in log', async () => {
    const cookie1 = await setupBothTeams()

    const res = await authenticatedPost(
      '/api/battle',
      { action: 'friendly_attack', defenderId: TEST_USER_ID_2 },
      cookie1,
    )
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)

    // Verify friendly mode in log
    const log = await queryOne<{ mode: string; rating_change: number | null }>(
      'SELECT mode, rating_change FROM battle_log WHERE id = ?',
      body.battleId,
    )
    expect(log?.mode).toBe('friendly')
    expect(log?.rating_change).toBeNull()

    // Friendly battles should NOT create or modify a battle_rating row
    const rating = await queryOne<{ wins: number; losses: number }>(
      'SELECT wins, losses FROM battle_rating WHERE user_id = ?',
      TEST_USER_ID,
    )
    expect(rating).toBeUndefined()
  })

  test('friendly battles do not count toward arena daily limit', async () => {
    const cookie1 = await setupBothTeams()

    // Do 5 friendly battles
    for (let i = 0; i < 5; i++) {
      await authenticatedPost(
        '/api/battle',
        { action: 'friendly_attack', defenderId: TEST_USER_ID_2 },
        cookie1,
      )
    }

    // Arena attack should still work
    const res = await authenticatedPost(
      '/api/battle',
      { action: 'arena_attack', defenderId: TEST_USER_ID_2 },
      cookie1,
    )
    expect(res.status).toBe(200)
  })

  test('cannot attack yourself', async () => {
    const cookie = await createSession(TEST_USER_ID)

    const arena = await authenticatedPost(
      '/api/battle',
      { action: 'arena_attack', defenderId: TEST_USER_ID },
      cookie,
    )
    expect(arena.status).toBe(400)

    const friendly = await authenticatedPost(
      '/api/battle',
      { action: 'friendly_attack', defenderId: TEST_USER_ID },
      cookie,
    )
    expect(friendly.status).toBe(400)
  })

  test('cannot attack without required teams', async () => {
    const cookie1 = await createSession(TEST_USER_ID)

    // No offense team → 400
    const cookie2 = await createSession(TEST_USER_ID_2)
    await authenticatedPost(
      '/api/battle',
      {
        action: 'set_team',
        slot: 'defense',
        members: [
          { userCreatureId: TEST_UC_ID_4, row: 'front' },
          { userCreatureId: TEST_UC_ID_5, row: 'front' },
          { userCreatureId: TEST_UC_ID_6, row: 'back' },
        ],
      },
      cookie2,
    )

    const noOffense = await authenticatedPost(
      '/api/battle',
      { action: 'arena_attack', defenderId: TEST_USER_ID_2 },
      cookie1,
    )
    expect(noOffense.status).toBe(400)

    // Set offense but defender has no defense team
    await authenticatedPost(
      '/api/battle',
      {
        action: 'set_team',
        slot: 'offense',
        members: [
          { userCreatureId: TEST_UC_ID_1, row: 'front' },
          { userCreatureId: TEST_UC_ID_2, row: 'front' },
          { userCreatureId: TEST_UC_ID_3, row: 'back' },
        ],
      },
      cookie1,
    )

    // Delete user-002's defense team first
    await authenticatedPost(
      '/api/battle',
      { action: 'delete_team', slot: 'defense' },
      cookie2,
    )

    const noDefense = await authenticatedPost(
      '/api/battle',
      { action: 'arena_attack', defenderId: TEST_USER_ID_2 },
      cookie1,
    )
    expect(noDefense.status).toBe(400)
  })
})
