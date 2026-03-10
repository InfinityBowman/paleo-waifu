import {
  TEST_APP_USER_ID,
  TEST_APP_USER_ID_2,
  TEST_CREATURE_ID_2,
  TEST_CREATURE_ID_3,
  TEST_CREATURE_ID_4,
  TEST_USER_CREATURE_ID,
  withDb,
} from './db-seed'

// Additional user_creature IDs for battle presets
export const UC_USER1_CREATURE3 = 'uc-u1-c3'
export const UC_USER1_CREATURE4 = 'uc-u1-c4'
export const UC_USER2_CREATURE2 = 'uc-u2-c2'
export const UC_USER2_CREATURE3 = 'uc-u2-c3'
export const UC_USER2_CREATURE4 = 'uc-u2-c4'

export const PRESET_USER1_ID = 'preset-001'
export const PRESET_USER2_ID = 'preset-002'

export const TEST_CHALLENGE_ID = 'challenge-001'

/**
 * Seed battle-related data: creature stats, user creatures, team presets.
 * Call AFTER seedTestData().
 */
export async function seedBattleData() {
  await withDb((db) => {
    const now = Math.floor(Date.now() / 1000)

    // Creature battle stats (for 3 creatures)
    db.prepare(
      `INSERT OR REPLACE INTO creature_battle_stats (creature_id, role, hp, atk, def, spd)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(TEST_CREATURE_ID_2, 'tank', 120, 30, 50, 20)
    db.prepare(
      `INSERT OR REPLACE INTO creature_battle_stats (creature_id, role, hp, atk, def, spd)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(TEST_CREATURE_ID_3, 'striker', 80, 50, 20, 40)
    db.prepare(
      `INSERT OR REPLACE INTO creature_battle_stats (creature_id, role, hp, atk, def, spd)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(TEST_CREATURE_ID_4, 'support', 90, 35, 35, 35)

    // Additional user_creatures for user 1 (already has TEST_USER_CREATURE_ID → creature-002)
    db.prepare(
      `INSERT OR REPLACE INTO user_creature (id, user_id, creature_id, pulled_at)
       VALUES (?, ?, ?, ?)`,
    ).run(UC_USER1_CREATURE3, TEST_APP_USER_ID, TEST_CREATURE_ID_3, now)
    db.prepare(
      `INSERT OR REPLACE INTO user_creature (id, user_id, creature_id, pulled_at)
       VALUES (?, ?, ?, ?)`,
    ).run(UC_USER1_CREATURE4, TEST_APP_USER_ID, TEST_CREATURE_ID_4, now)

    // User_creatures for user 2
    db.prepare(
      `INSERT OR REPLACE INTO user_creature (id, user_id, creature_id, pulled_at)
       VALUES (?, ?, ?, ?)`,
    ).run(UC_USER2_CREATURE2, TEST_APP_USER_ID_2, TEST_CREATURE_ID_2, now)
    db.prepare(
      `INSERT OR REPLACE INTO user_creature (id, user_id, creature_id, pulled_at)
       VALUES (?, ?, ?, ?)`,
    ).run(UC_USER2_CREATURE3, TEST_APP_USER_ID_2, TEST_CREATURE_ID_3, now)
    db.prepare(
      `INSERT OR REPLACE INTO user_creature (id, user_id, creature_id, pulled_at)
       VALUES (?, ?, ?, ?)`,
    ).run(UC_USER2_CREATURE4, TEST_APP_USER_ID_2, TEST_CREATURE_ID_4, now)

    // Team presets — members is JSON: [{userCreatureId, creatureId, row}]
    const user1Members = JSON.stringify([
      {
        userCreatureId: TEST_USER_CREATURE_ID,
        creatureId: TEST_CREATURE_ID_2,
        row: 'front',
      },
      {
        userCreatureId: UC_USER1_CREATURE3,
        creatureId: TEST_CREATURE_ID_3,
        row: 'front',
      },
      {
        userCreatureId: UC_USER1_CREATURE4,
        creatureId: TEST_CREATURE_ID_4,
        row: 'back',
      },
    ])
    db.prepare(
      `INSERT OR REPLACE INTO battle_team_preset (id, user_id, name, members, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      PRESET_USER1_ID,
      TEST_APP_USER_ID,
      'Team Alpha',
      user1Members,
      now,
      now,
    )

    const user2Members = JSON.stringify([
      {
        userCreatureId: UC_USER2_CREATURE2,
        creatureId: TEST_CREATURE_ID_2,
        row: 'front',
      },
      {
        userCreatureId: UC_USER2_CREATURE3,
        creatureId: TEST_CREATURE_ID_3,
        row: 'front',
      },
      {
        userCreatureId: UC_USER2_CREATURE4,
        creatureId: TEST_CREATURE_ID_4,
        row: 'back',
      },
    ])
    db.prepare(
      `INSERT OR REPLACE INTO battle_team_preset (id, user_id, name, members, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      PRESET_USER2_ID,
      TEST_APP_USER_ID_2,
      'Team Beta',
      user2Members,
      now,
      now,
    )
  })
}

/** Seed a pending challenge from user 1 → user 2 */
export async function seedPendingChallenge() {
  await withDb((db) => {
    const now = Math.floor(Date.now() / 1000)
    const team = JSON.stringify([
      { userCreatureId: TEST_USER_CREATURE_ID, row: 'front' },
      { userCreatureId: UC_USER1_CREATURE3, row: 'front' },
      { userCreatureId: UC_USER1_CREATURE4, row: 'back' },
    ])

    db.prepare(
      `INSERT OR REPLACE INTO battle_challenge (id, challenger_id, defender_id, status, challenger_team, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      TEST_CHALLENGE_ID,
      TEST_APP_USER_ID,
      TEST_APP_USER_ID_2,
      'pending',
      team,
      now,
    )
  })
}
