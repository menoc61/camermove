import { test, expect } from '@playwright/test'

test('Hotels funnel renders list, detail rooms and pay CTA', async ({ page }) => {
  await page.goto('/hotels')

  await expect(page.getByRole('heading', { name: /Hôtels/i })).toBeVisible({ timeout: 15000 })

  // Wait for at least one hotel card (link to /hotels/:id)
  const firstHotel = page.locator('a[href^="/hotels/"]').first()
  await expect(firstHotel).toBeVisible({ timeout: 15000 })
  await firstHotel.click()

  await expect(page).toHaveURL(/\/hotels\/.+/, { timeout: 15000 })

  // Detail shows rooms section + pay/reserve CTA
  await expect(page.getByRole('heading', { name: /Chambres/i })).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: /Payer|Réserver|Choisir/i }).first()).toBeVisible({
    timeout: 15000,
  })
})
