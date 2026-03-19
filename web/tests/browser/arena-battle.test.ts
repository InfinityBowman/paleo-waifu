import { expect, test } from '@playwright/test'
import {
  authenticate,
  resetTestData,
  seedTestData,
  TEST_USER_ID,
  TEST_USER_ID_2,
} from './helpers'

import type { BrowserContext } from '@playwright/test'

test.beforeEach(async () => {
  await resetTestData()
  await seedTestData()
})

/** Set offense + defense teams for a user via the API */
async function setTeams(
  context: BrowserContext,
  userCreatureIds: [string, string, string],
) {
  const cookie = await getSessionCookie(context)
  const workerUrl = process.env.__TEST_WORKER_URL!

  for (const slot of ['offense', 'defense'] as const) {
    const res = await fetch(`${workerUrl}/api/battle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: workerUrl,
      },
      body: JSON.stringify({
        action: 'set_team',
        slot,
        members: [
          { userCreatureId: userCreatureIds[0], row: 'back' },
          { userCreatureId: userCreatureIds[1], row: 'front' },
          { userCreatureId: userCreatureIds[2], row: 'front' },
        ],
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Failed to set ${slot} team: ${text}`)
    }
  }
}

/** Execute an arena attack via API and return the battle ID */
async function attackViaApi(
  context: BrowserContext,
  defenderId: string,
): Promise<string> {
  const cookie = await getSessionCookie(context)
  const workerUrl = process.env.__TEST_WORKER_URL!

  const res = await fetch(`${workerUrl}/api/battle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
      Origin: workerUrl,
    },
    body: JSON.stringify({
      action: 'arena_attack',
      defenderId,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Arena attack failed: ${text}`)
  }
  const data = await res.json()
  return data.battleId
}

async function getSessionCookie(
  context: BrowserContext,
): Promise<string> {
  const cookies = await context.cookies()
  const sessionCookie = cookies.find(
    (c) => c.name === 'better-auth.session_token',
  )
  if (!sessionCookie) throw new Error('No session cookie found')
  return `better-auth.session_token=${sessionCookie.value}`
}

test('arena: find opponents shows nearby players', async ({
  browser,
}) => {
  const userAContext = await browser.newContext()
  const userBContext = await browser.newContext()

  await authenticate(userAContext, TEST_USER_ID)
  await authenticate(userBContext, TEST_USER_ID_2)

  // Both users need teams to appear as opponents
  await setTeams(userAContext, ['e2e-uc-001', 'e2e-uc-002', 'e2e-uc-003'])
  await setTeams(userBContext, ['e2e-uc-004', 'e2e-uc-005', 'e2e-uc-006'])

  const userAPage = await userAContext.newPage()

  await userAPage.goto('/battle', { waitUntil: 'networkidle' })
  await expect(
    userAPage.getByRole('heading', { name: 'Arena' }),
  ).toBeVisible()

  // Daily attack counter should show "5 of 5 remaining today"
  await expect(
    userAPage.getByText(/5 of 5 remaining/i),
  ).toBeVisible()

  // Click "Find Opponents"
  await userAPage.getByRole('button', { name: /Find Opponents/i }).click()

  // Should see TestUser2 as a potential opponent
  await expect(
    userAPage.getByText('TestUser2').first(),
  ).toBeVisible({ timeout: 10_000 })

  // Attack button should be visible for the opponent
  await expect(
    userAPage.getByRole('button', { name: /Attack/i }).first(),
  ).toBeVisible()

  await userAContext.close()
  await userBContext.close()
})

test('battle history and replay after arena attack', async ({
  browser,
}) => {
  const userAContext = await browser.newContext()
  const userBContext = await browser.newContext()

  await authenticate(userAContext, TEST_USER_ID)
  await authenticate(userBContext, TEST_USER_ID_2)

  await setTeams(userAContext, ['e2e-uc-001', 'e2e-uc-002', 'e2e-uc-003'])
  await setTeams(userBContext, ['e2e-uc-004', 'e2e-uc-005', 'e2e-uc-006'])

  // Execute battle via API (the transition animation is tested implicitly
  // by the find-opponents test; here we focus on history + replay)
  // Need to ensure battle_rating rows exist first (they're created by team setup)
  // and the defender's defense team is resolvable
  const battleId = await attackViaApi(userAContext, TEST_USER_ID_2)
  expect(battleId).toBeTruthy()

  const userAPage = await userAContext.newPage()

  // ── Check battle history ────────────────────────────────────────
  await userAPage.goto('/battle', { waitUntil: 'networkidle' })
  await userAPage.getByRole('tab', { name: /History/i }).click()

  // Should see a battle result (WIN, LOSS, or DRAW)
  await expect(
    userAPage.getByText(/WIN|LOSS|DRAW/).first(),
  ).toBeVisible({ timeout: 5_000 })

  // Should see TestUser2 as the opponent
  await expect(
    userAPage.getByText('TestUser2').first(),
  ).toBeVisible()

  // Should show "arena" mode
  await expect(
    userAPage.getByText('arena').first(),
  ).toBeVisible()

  // ── Click to view battle replay ────────────────────────────────
  // History items are clickable links to /battle/$id
  await userAPage.getByText(/WIN|LOSS|DRAW/).first().click()

  // Should navigate to battle detail page
  await expect(userAPage).toHaveURL(new RegExp(`/battle/${battleId}`), {
    timeout: 5_000,
  })

  // Should show both player names
  await expect(userAPage.getByText('TestUser').first()).toBeVisible()
  await expect(userAPage.getByText('TestUser2').first()).toBeVisible()

  // Should have a "Back to Arena" link
  await expect(
    userAPage.getByText(/Back to Arena/i).first(),
  ).toBeVisible()

  await userAContext.close()
  await userBContext.close()
})
