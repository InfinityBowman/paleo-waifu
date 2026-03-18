import { expect, test } from '@playwright/test'
import {
  authenticate,
  resetTestData,
  seedTestData,
  TEST_USER_ID,
  TEST_USER_ID_2,
} from './helpers'

test.beforeEach(async () => {
  await resetTestData()
  await seedTestData()
})

test('full trade flow: create offer, propose, accept', async ({ browser }) => {
  // ── Set up two browser contexts (two different users) ───────────
  const userAContext = await browser.newContext()
  const userBContext = await browser.newContext()

  await authenticate(userAContext, TEST_USER_ID)
  await authenticate(userBContext, TEST_USER_ID_2)

  const userAPage = await userAContext.newPage()
  const userBPage = await userBContext.newPage()

  // ── User A creates a trade offer ────────────────────────────────
  await userAPage.goto('/trade', { waitUntil: 'networkidle' })
  await expect(userAPage).toHaveURL('/trade')
  await expect(userAPage.getByText('Trade Market')).toBeVisible()

  // Click "New Trade" to open creature picker
  await userAPage.getByRole('button', { name: /New Trade/i }).click()

  // Modal opens — wait for creature picker to load
  const pickerModal = userAPage.getByRole('dialog')
  await expect(pickerModal).toBeVisible({ timeout: 10_000 })
  await expect(
    pickerModal.getByText('Select a Creature to Offer'),
  ).toBeVisible()

  // User A owns: Tyrannosaurus (legendary), Triceratops (common), Stegosaurus (uncommon)
  // Click on Tyrannosaurus to select it
  await pickerModal.getByText('Tyrannosaurus').click()

  // Confirm button should show the creature name
  const confirmBtn = pickerModal.getByRole('button', {
    name: /Create Trade.*Tyrannosaurus/i,
  })
  await expect(confirmBtn).toBeVisible()
  await confirmBtn.click()

  // Modal closes, trade should appear in marketplace
  await expect(pickerModal).not.toBeVisible({ timeout: 5_000 })

  // Verify trade appears — should see Tyrannosaurus in the marketplace
  await expect(
    userAPage.getByText('Tyrannosaurus').first(),
  ).toBeVisible({ timeout: 5_000 })

  // ── User B sees the trade and proposes ──────────────────────────
  await userBPage.goto('/trade')
  await expect(userBPage).toHaveURL('/trade')

  // User B should see User A's trade with Tyrannosaurus in marketplace
  await expect(
    userBPage.getByText('Tyrannosaurus').first(),
  ).toBeVisible({ timeout: 5_000 })

  // Click "Make Offer" on User A's trade
  await userBPage.getByRole('button', { name: /Make Offer/i }).first().click()

  // Creature picker opens for User B
  const userBPicker = userBPage.getByRole('dialog')
  await expect(userBPicker).toBeVisible()

  // User B owns: Velociraptor (rare), Spinosaurus (epic), Ankylosaurus (common)
  // Select Spinosaurus as the offer
  await userBPicker.getByText('Spinosaurus').click()

  // Click "Send Offer"
  const sendOfferBtn = userBPicker.getByRole('button', {
    name: /Send Offer/i,
  })
  await expect(sendOfferBtn).toBeVisible()
  await sendOfferBtn.click()

  // Modal closes
  await expect(userBPicker).not.toBeVisible({ timeout: 5_000 })

  // User B should see their proposal in "My Offers" tab
  await userBPage.getByRole('tab', { name: /My Offers/i }).click()
  await expect(
    userBPage.getByText('Spinosaurus').first(),
  ).toBeVisible({ timeout: 5_000 })

  // ── User A sees the proposal and accepts ────────────────────────
  // Reload trade page so User A sees User B's proposal
  await userAPage.goto('/trade')

  // Switch to "My Offers" tab
  await userAPage.getByRole('tab', { name: /My Offers/i }).click()

  // Should see incoming offer section with Spinosaurus
  await expect(
    userAPage.getByText('Incoming Offers'),
  ).toBeVisible({ timeout: 5_000 })
  await expect(
    userAPage.getByText('Spinosaurus').first(),
  ).toBeVisible({ timeout: 5_000 })

  // Click Accept
  await userAPage.getByRole('button', { name: /Accept/i }).first().click()

  // Confirmation dialog appears
  const confirmDialog = userAPage.getByRole('alertdialog')
  await expect(confirmDialog).toBeVisible()
  await expect(
    confirmDialog.getByRole('heading', { name: 'Accept Trade' }),
  ).toBeVisible()

  // Confirm the trade
  await confirmDialog
    .getByRole('button', { name: /Accept Trade/i })
    .click()

  // Dialog closes — trade is completed
  await expect(confirmDialog).not.toBeVisible({ timeout: 5_000 })

  // ── Verify creatures swapped via collection pages ───────────────
  // User A should now own Spinosaurus (got from trade)
  await userAPage.goto('/collection')
  await expect(
    userAPage.getByText('Spinosaurus').first(),
  ).toBeVisible({ timeout: 5_000 })

  // User B should now own Tyrannosaurus (got from trade)
  await userBPage.goto('/collection')
  await expect(
    userBPage.getByText('Tyrannosaurus').first(),
  ).toBeVisible({ timeout: 5_000 })

  // Cleanup
  await userAContext.close()
  await userBContext.close()
})
