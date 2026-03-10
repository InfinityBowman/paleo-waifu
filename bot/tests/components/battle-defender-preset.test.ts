import { beforeEach, describe, expect, it } from 'vitest'
import { loadKeypairFromEnv } from '../helpers/crypto'
import { sendInteraction, setWorkerUrl } from '../helpers/worker-client'
import {
  buildComponentInteraction,
  resetInteractionCounter,
} from '../helpers/interaction-builder'
import {
  TEST_APP_USER_ID,
  TEST_APP_USER_ID_2,
  TEST_DISCORD_USER_ID,
  TEST_DISCORD_USER_ID_2,
  queryOne,
  resetTestData,
  seedTestData,
} from '../helpers/db-seed'
import {
  PRESET_USER2_ID,
  TEST_CHALLENGE_ID,
  seedBattleData,
  seedPendingChallenge,
} from '../helpers/battle-seed'
import { pollUntil } from '../helpers/poll'

beforeEach(async () => {
  loadKeypairFromEnv()
  setWorkerUrl(process.env.__TEST_WORKER_URL!)
  resetInteractionCounter()
  await resetTestData()
  await seedTestData()
  await seedBattleData()
  await seedPendingChallenge()
})

describe('battle_defender_preset component', () => {
  it('returns deferred update response (type 6) for defender', async () => {
    const interaction = buildComponentInteraction(
      `battle_defender_preset:${TEST_CHALLENGE_ID}`,
      {
        userId: TEST_DISCORD_USER_ID_2,
        values: [PRESET_USER2_ID],
        componentType: 3,
      },
    )
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    // DEFERRED_UPDATE_MESSAGE = type 6
    expect(body.type).toBe(6)
  })

  it('resolves battle and updates challenge status', async () => {
    const interaction = buildComponentInteraction(
      `battle_defender_preset:${TEST_CHALLENGE_ID}`,
      {
        userId: TEST_DISCORD_USER_ID_2,
        values: [PRESET_USER2_ID],
        componentType: 3,
      },
    )
    await sendInteraction(interaction)

    // Poll for challenge to become resolved
    const challenge = await pollUntil(
      async () => {
        const row = await queryOne<{
          status: string
          winner_id: string | null
          result: string | null
        }>(
          'SELECT status, winner_id, result FROM battle_challenge WHERE id = ?',
          TEST_CHALLENGE_ID,
        )
        return row?.status === 'resolved' ? row : undefined
      },
      { timeoutMs: 15_000 },
    )

    expect(challenge).toBeDefined()
    expect(challenge.status).toBe('resolved')
    // Winner must be one of the two players (or null for draw)
    if (challenge.winner_id) {
      expect([TEST_APP_USER_ID, TEST_APP_USER_ID_2]).toContain(
        challenge.winner_id,
      )
    }
    // Result should be valid JSON with battle data
    expect(challenge.result).toBeTruthy()
    const result = JSON.parse(challenge.result!)
    expect(result.turns).toBeGreaterThan(0)
    expect(['A', 'B', null]).toContain(result.winner)
    expect(result.seed).toBeDefined()
  })

  it('creates rating records for both players after resolution', async () => {
    const interaction = buildComponentInteraction(
      `battle_defender_preset:${TEST_CHALLENGE_ID}`,
      {
        userId: TEST_DISCORD_USER_ID_2,
        values: [PRESET_USER2_ID],
        componentType: 3,
      },
    )
    await sendInteraction(interaction)

    // Poll for ratings to appear
    const challengerRating = await pollUntil(
      async () => {
        return queryOne<{ rating: number; wins: number; losses: number }>(
          'SELECT rating, wins, losses FROM battle_rating WHERE user_id = ?',
          TEST_APP_USER_ID,
        )
      },
      { timeoutMs: 15_000 },
    )

    const defenderRating = await queryOne<{
      rating: number
      wins: number
      losses: number
    }>(
      'SELECT rating, wins, losses FROM battle_rating WHERE user_id = ?',
      TEST_APP_USER_ID_2,
    )

    expect(challengerRating).toBeDefined()
    expect(defenderRating).toBeDefined()

    // One player should have a win and the other a loss (or both 0 for draw)
    const totalWins = challengerRating.wins + defenderRating!.wins
    const totalLosses = challengerRating.losses + defenderRating!.losses
    expect(totalWins).toBe(totalLosses) // Wins and losses should balance

    if (totalWins > 0) {
      // Not a draw — verify rating deltas (+25 winner, -20 loser clamped to 0)
      expect(totalWins).toBe(1)
      expect(totalLosses).toBe(1)
      // Winner gets +25 from 0 = 25, loser gets max(0, 0-20) = 0
      expect(challengerRating.rating + defenderRating!.rating).toBe(25)
    }
  })

  it('stores defender team in challenge after resolution', async () => {
    const interaction = buildComponentInteraction(
      `battle_defender_preset:${TEST_CHALLENGE_ID}`,
      {
        userId: TEST_DISCORD_USER_ID_2,
        values: [PRESET_USER2_ID],
        componentType: 3,
      },
    )
    await sendInteraction(interaction)

    const challenge = await pollUntil(
      async () => {
        const row = await queryOne<{
          defender_team: string | null
          status: string
        }>(
          'SELECT defender_team, status FROM battle_challenge WHERE id = ?',
          TEST_CHALLENGE_ID,
        )
        return row?.status === 'resolved' ? row : undefined
      },
      { timeoutMs: 15_000 },
    )

    expect(challenge.defender_team).toBeTruthy()
    const team = JSON.parse(challenge.defender_team!)
    expect(team).toHaveLength(3)
    expect(team[0]).toHaveProperty('userCreatureId')
    expect(team[0]).toHaveProperty('row')
  })

  it('rejects when no preset value selected', async () => {
    // No values array — handled synchronously in index.ts
    const interaction = buildComponentInteraction(
      `battle_defender_preset:${TEST_CHALLENGE_ID}`,
      { userId: TEST_DISCORD_USER_ID_2, componentType: 3 },
    )
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.type).toBe(4)
    expect(body.data.flags).toBe(64)
    expect(body.data.content).toContain('No preset selected')
  })

  it('does not resolve challenge when non-defender selects preset', async () => {
    const interaction = buildComponentInteraction(
      `battle_defender_preset:${TEST_CHALLENGE_ID}`,
      {
        userId: TEST_DISCORD_USER_ID,
        values: [PRESET_USER2_ID],
        componentType: 3,
      }, // Challenger, not defender
    )
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    // Still returns deferred (type 6), error sent in background
    expect(body.type).toBe(6)

    // Allow worker time to process; challenge must still be pending
    await new Promise((r) => setTimeout(r, 1500))
    const challenge = await queryOne<{ status: string }>(
      'SELECT status FROM battle_challenge WHERE id = ?',
      TEST_CHALLENGE_ID,
    )
    expect(challenge!.status).toBe('pending')
  })
})
