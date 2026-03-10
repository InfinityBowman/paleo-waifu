import { beforeEach, describe, expect, test } from 'vitest'

import { createSession } from '../helpers/auth'
import { authenticatedPost } from '../helpers/client'
import {
  TEST_BANNER_ID,
  TEST_CREATURE_ID_2,
  TEST_CREATURE_ID_4,
  TEST_UC_ID_1,
  TEST_UC_ID_2,
  TEST_UC_ID_3,
  TEST_UC_ID_4,
  TEST_UC_ID_5,
  TEST_USER_ID,
  TEST_USER_ID_2,
  execute,
  queryOne,
  resetTestData,
  seedTestData,
} from '../helpers/db-seed'

beforeEach(async () => {
  await resetTestData()
  await seedTestData()
})

describe('trade system', () => {
  test('full trade lifecycle: create → lock → propose → confirm → swap ownership', async () => {
    const cookie1 = await createSession(TEST_USER_ID)

    // Create trade
    const createRes = await authenticatedPost(
      '/api/trade',
      { action: 'create', offeredCreatureId: TEST_UC_ID_1 },
      cookie1,
    )
    expect(createRes.status).toBe(200)
    const { id: tradeId } = await createRes.json()
    expect(tradeId).toBeDefined()

    // Verify creature locked
    const locked = await queryOne<{ is_locked: number }>(
      'SELECT is_locked FROM user_creature WHERE id = ?',
      TEST_UC_ID_1,
    )
    expect(locked?.is_locked).toBe(1)

    // Verify trade created with open status
    const trade = await queryOne<{ status: string; offerer_id: string }>(
      'SELECT status, offerer_id FROM trade_offer WHERE id = ?',
      tradeId,
    )
    expect(trade?.status).toBe('open')
    expect(trade?.offerer_id).toBe(TEST_USER_ID)

    // User-002 proposes
    const cookie2 = await createSession(TEST_USER_ID_2)
    const proposeRes = await authenticatedPost(
      '/api/trade',
      { action: 'propose', tradeId, myCreatureId: TEST_UC_ID_4 },
      cookie2,
    )
    expect(proposeRes.status).toBe(200)
    const { id: proposalId } = await proposeRes.json()

    // Verify proposer's creature locked
    const proposerLocked = await queryOne<{ is_locked: number }>(
      'SELECT is_locked FROM user_creature WHERE id = ?',
      TEST_UC_ID_4,
    )
    expect(proposerLocked?.is_locked).toBe(1)

    // User-001 confirms
    const confirmRes = await authenticatedPost(
      '/api/trade',
      { action: 'confirm', tradeId, proposalId },
      cookie1,
    )
    expect(confirmRes.status).toBe(200)

    // Verify ownership swapped
    const uc1 = await queryOne<{ user_id: string; is_locked: number }>(
      'SELECT user_id, is_locked FROM user_creature WHERE id = ?',
      TEST_UC_ID_1,
    )
    expect(uc1?.user_id).toBe(TEST_USER_ID_2)
    expect(uc1?.is_locked).toBe(0)

    const uc4 = await queryOne<{ user_id: string; is_locked: number }>(
      'SELECT user_id, is_locked FROM user_creature WHERE id = ?',
      TEST_UC_ID_4,
    )
    expect(uc4?.user_id).toBe(TEST_USER_ID)
    expect(uc4?.is_locked).toBe(0)

    // Verify trade_history created
    const history = await queryOne<{
      giver_id: string
      receiver_id: string
    }>(
      'SELECT giver_id, receiver_id FROM trade_history WHERE trade_offer_id = ?',
      tradeId,
    )
    expect(history?.giver_id).toBe(TEST_USER_ID)
    expect(history?.receiver_id).toBe(TEST_USER_ID_2)

    // Verify trade marked accepted
    const finalTrade = await queryOne<{ status: string }>(
      'SELECT status FROM trade_offer WHERE id = ?',
      tradeId,
    )
    expect(finalTrade?.status).toBe('accepted')
  })

  test('wantedCreatureId constraint: wrong species rejected, correct accepted', async () => {
    const cookie1 = await createSession(TEST_USER_ID)

    // Create trade wanting creature-004 (Velociraptor)
    const createRes = await authenticatedPost(
      '/api/trade',
      {
        action: 'create',
        offeredCreatureId: TEST_UC_ID_2,
        wantedCreatureId: TEST_CREATURE_ID_4,
      },
      cookie1,
    )
    const { id: tradeId } = await createRes.json()

    const cookie2 = await createSession(TEST_USER_ID_2)

    // Wrong species (UC-005 is epic Spinosaurus, not Velociraptor)
    const wrongRes = await authenticatedPost(
      '/api/trade',
      { action: 'propose', tradeId, myCreatureId: TEST_UC_ID_5 },
      cookie2,
    )
    expect(wrongRes.status).toBe(400)

    // Correct species (UC-004 IS creature-004)
    const rightRes = await authenticatedPost(
      '/api/trade',
      { action: 'propose', tradeId, myCreatureId: TEST_UC_ID_4 },
      cookie2,
    )
    expect(rightRes.status).toBe(200)
  })

  test('cancel trade unlocks offered creature and cancels pending proposals', async () => {
    const cookie1 = await createSession(TEST_USER_ID)

    // Create trade
    const createRes = await authenticatedPost(
      '/api/trade',
      { action: 'create', offeredCreatureId: TEST_UC_ID_1 },
      cookie1,
    )
    const { id: tradeId } = await createRes.json()

    // User-002 proposes
    const cookie2 = await createSession(TEST_USER_ID_2)
    const proposeRes = await authenticatedPost(
      '/api/trade',
      { action: 'propose', tradeId, myCreatureId: TEST_UC_ID_4 },
      cookie2,
    )
    const { id: proposalId } = await proposeRes.json()

    // Verify both creatures locked
    const beforeUc4 = await queryOne<{ is_locked: number }>(
      'SELECT is_locked FROM user_creature WHERE id = ?',
      TEST_UC_ID_4,
    )
    expect(beforeUc4?.is_locked).toBe(1)

    // Cancel trade
    const cancelRes = await authenticatedPost(
      '/api/trade',
      { action: 'cancel', tradeId },
      cookie1,
    )
    expect(cancelRes.status).toBe(200)

    // Offered creature unlocked
    const uc1 = await queryOne<{ is_locked: number }>(
      'SELECT is_locked FROM user_creature WHERE id = ?',
      TEST_UC_ID_1,
    )
    expect(uc1?.is_locked).toBe(0)

    // Proposal cancelled and proposer's creature unlocked
    const proposal = await queryOne<{ status: string }>(
      'SELECT status FROM trade_proposal WHERE id = ?',
      proposalId,
    )
    expect(proposal?.status).toBe('cancelled')

    const uc4 = await queryOne<{ is_locked: number }>(
      'SELECT is_locked FROM user_creature WHERE id = ?',
      TEST_UC_ID_4,
    )
    expect(uc4?.is_locked).toBe(0)
  })

  test('withdraw proposal unlocks proposer creature', async () => {
    const cookie1 = await createSession(TEST_USER_ID)
    const createRes = await authenticatedPost(
      '/api/trade',
      { action: 'create', offeredCreatureId: TEST_UC_ID_1 },
      cookie1,
    )
    const { id: tradeId } = await createRes.json()

    const cookie2 = await createSession(TEST_USER_ID_2)
    const proposeRes = await authenticatedPost(
      '/api/trade',
      { action: 'propose', tradeId, myCreatureId: TEST_UC_ID_4 },
      cookie2,
    )
    const { id: proposalId } = await proposeRes.json()

    // Withdraw
    const withdrawRes = await authenticatedPost(
      '/api/trade',
      { action: 'withdraw', proposalId },
      cookie2,
    )
    expect(withdrawRes.status).toBe(200)

    const proposal = await queryOne<{ status: string }>(
      'SELECT status FROM trade_proposal WHERE id = ?',
      proposalId,
    )
    expect(proposal?.status).toBe('withdrawn')

    const uc = await queryOne<{ is_locked: number }>(
      'SELECT is_locked FROM user_creature WHERE id = ?',
      TEST_UC_ID_4,
    )
    expect(uc?.is_locked).toBe(0)
  })

  test('cannot propose on your own trade', async () => {
    const cookie = await createSession(TEST_USER_ID)
    const createRes = await authenticatedPost(
      '/api/trade',
      { action: 'create', offeredCreatureId: TEST_UC_ID_1 },
      cookie,
    )
    const { id: tradeId } = await createRes.json()

    const res = await authenticatedPost(
      '/api/trade',
      { action: 'propose', tradeId, myCreatureId: TEST_UC_ID_2 },
      cookie,
    )
    expect(res.status).toBe(409)
  })

  test('cannot exceed 5 active trades', async () => {
    const cookie = await createSession(TEST_USER_ID)

    // Create 5 extra user_creatures
    for (let i = 0; i < 5; i++) {
      await execute(
        `INSERT INTO user_creature (id, user_id, creature_id, banner_id, pulled_at)
         VALUES (?, ?, ?, ?, ?)`,
        `extra-uc-${i}`,
        TEST_USER_ID,
        TEST_CREATURE_ID_2,
        TEST_BANNER_ID,
        Math.floor(Date.now() / 1000),
      )
    }

    // Open 5 trades
    for (let i = 0; i < 5; i++) {
      const res = await authenticatedPost(
        '/api/trade',
        { action: 'create', offeredCreatureId: `extra-uc-${i}` },
        cookie,
      )
      expect(res.status).toBe(200)
    }

    // 6th fails
    const res = await authenticatedPost(
      '/api/trade',
      { action: 'create', offeredCreatureId: TEST_UC_ID_2 },
      cookie,
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('5 active trades')
  })

  test('create with creature on battle team returns 400', async () => {
    const cookie = await createSession(TEST_USER_ID)

    await execute(
      `INSERT INTO battle_team (id, user_id, slot, members)
       VALUES (?, ?, ?, ?)`,
      'bt-test-001',
      TEST_USER_ID,
      'offense',
      JSON.stringify([
        { userCreatureId: TEST_UC_ID_1, row: 'front' },
        { userCreatureId: TEST_UC_ID_2, row: 'front' },
        { userCreatureId: TEST_UC_ID_3, row: 'back' },
      ]),
    )

    const res = await authenticatedPost(
      '/api/trade',
      { action: 'create', offeredCreatureId: TEST_UC_ID_1 },
      cookie,
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('battle team')
  })

  test('trade has 7-day expiry', async () => {
    const cookie = await createSession(TEST_USER_ID)
    const beforeCreate = Math.floor(Date.now() / 1000)

    const res = await authenticatedPost(
      '/api/trade',
      { action: 'create', offeredCreatureId: TEST_UC_ID_1 },
      cookie,
    )
    const body = await res.json()

    const trade = await queryOne<{ expires_at: number }>(
      'SELECT expires_at FROM trade_offer WHERE id = ?',
      body.id,
    )
    const sevenDays = 7 * 24 * 60 * 60
    expect(trade!.expires_at).toBeGreaterThanOrEqual(beforeCreate + sevenDays - 5)
    expect(trade!.expires_at).toBeLessThanOrEqual(beforeCreate + sevenDays + 5)
  })
})
