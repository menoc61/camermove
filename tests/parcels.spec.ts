import { test, expect } from '@playwright/test'

test('Parcels page renders send / my-parcels / track tabs', async ({ page }) => {
  await page.goto('/parcels')

  await expect(page.getByRole('heading', { name: /Transport de colis/i }).first()).toBeVisible({
    timeout: 15000,
  })
  await expect(page.getByRole('tab', { name: /Envoyer un colis/i })).toBeVisible()
  await expect(page.getByRole('tab', { name: /Mes colis/i })).toBeVisible()
  await expect(page.getByRole('tab', { name: /Suivi public/i })).toBeVisible()

  // Switch to public tracking tab
  await page.getByRole('tab', { name: /Suivi public/i }).click()
  await expect(page.getByRole('heading', { name: /Suivi public/i })).toBeVisible()
})

test('Public parcel tracking page renders timeline for seeded parcel', async ({ page }) => {
  // Seeded by scripts/seed-rich.ts
  await page.goto('/parcels/track/CM-2026-0001')

  await expect(page.getByRole('heading', { name: /Suivi du colis/i })).toBeVisible({
    timeout: 15000,
  })
  // Timeline status + parcel details (scoped to main: header contains hidden duplicates)
  const main = page.locator('main')
  await expect(main.getByText('Yaoundé → Douala')).toBeVisible({ timeout: 15000 })
  await expect(main.getByText(/Destinataire/i).first()).toBeVisible({ timeout: 15000 })
})
