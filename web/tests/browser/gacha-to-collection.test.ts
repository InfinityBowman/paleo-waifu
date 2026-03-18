import { expect, test } from '@playwright/test'
import { authenticate, resetTestData, seedTestData } from './helpers'

test.beforeEach(async () => {
  await resetTestData()
  await seedTestData()
})

test('unauthenticated user is redirected from /gacha to landing', async ({
  page,
}) => {
  await page.goto('/gacha')
  await expect(page).toHaveURL('/')
})

test('pull a creature and find it in collection', async ({ page, context }) => {
  await authenticate(context)

  // ── Navigate to gacha page ──────────────────────────────────────
  await page.goto('/gacha')
  await expect(page).toHaveURL('/gacha')

  // Pull x1 button should be enabled (use exact name to avoid matching x10)
  const pullX1 = page.getByRole('button', { name: 'Pull x1' }).first()
  await expect(pullX1).toBeEnabled()

  // ── Do a single pull ────────────────────────────────────────────
  await pullX1.click()

  // The pull has a 1.5s minimum excavation time + reveal animation.
  // Our test creatures are: Tyrannosaurus, Triceratops, Stegosaurus,
  // Velociraptor, Spinosaurus, Ankylosaurus
  const creatureNames = [
    'Tyrannosaurus',
    'Triceratops',
    'Stegosaurus',
    'Velociraptor',
    'Spinosaurus',
    'Ankylosaurus',
  ]
  const creatureNamePattern = new RegExp(creatureNames.join('|'))

  // Wait for any creature name to appear (card has been revealed)
  const anyCreature = page.getByText(creatureNamePattern).first()
  await expect(anyCreature).toBeVisible({ timeout: 15_000 })

  // Grab the actual name
  const creatureName = (await anyCreature.textContent())?.trim()
  expect(creatureName).toBeTruthy()

  // Fossil count should have decreased to 99
  await expect(page.getByText('99').first()).toBeVisible({ timeout: 5_000 })

  // ── Navigate to collection ──────────────────────────────────────
  await page.getByRole('link', { name: /Collection/i }).click()
  await expect(page).toHaveURL('/collection')

  // The pulled creature should appear in the collection
  await expect(
    page.getByText(creatureName!).first(),
  ).toBeVisible({ timeout: 5_000 })
})

test('pull x10 shows multiple creature cards', async ({ page, context }) => {
  await authenticate(context)

  await page.goto('/gacha')
  await expect(page).toHaveURL('/gacha')

  const pullX10 = page.getByRole('button', { name: 'Pull x10' })
  await expect(pullX10).toBeEnabled()

  await pullX10.click()

  // Wait for creatures to start appearing
  const creatureNames = [
    'Tyrannosaurus',
    'Triceratops',
    'Stegosaurus',
    'Velociraptor',
    'Spinosaurus',
    'Ankylosaurus',
  ]
  const creatureNamePattern = new RegExp(creatureNames.join('|'))

  // Wait for the first creature to appear
  await expect(
    page.getByText(creatureNamePattern).first(),
  ).toBeVisible({ timeout: 15_000 })

  // Skip/advance through the reveal animation by clicking
  await page.locator('body').click()
  await page.waitForTimeout(500)
  await page.locator('body').click()
  await page.waitForTimeout(500)

  // Fossil count should have decreased to 90
  await expect(page.getByText('90').first()).toBeVisible({ timeout: 10_000 })
})

test('cannot pull with insufficient fossils', async ({ page, context }) => {
  await authenticate(context)

  // Set fossils to 0
  const workerUrl = process.env.__TEST_WORKER_URL!
  await fetch(`${workerUrl}/api/test?action=execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: 'UPDATE currency SET fossils = 0 WHERE user_id = ?',
      params: ['e2e-user-001'],
    }),
  })

  await page.goto('/gacha')

  // Pull buttons should be disabled
  const pullX1 = page.getByRole('button', { name: 'Pull x1' }).first()
  await expect(pullX1).toBeDisabled()

  const pullX10 = page.getByRole('button', { name: 'Pull x10' })
  await expect(pullX10).toBeDisabled()
})
