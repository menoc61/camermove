import { test, expect } from '@playwright/test'

test('Transport interurban flow shows results', async ({ page }) => {
  // Go to home page
  await page.goto('/')

  // Click on the Transport interurbain card
  await page.getByRole('link', { name: /Transport interurbain/i }).click()

  // Wait for results page to load and URL contains /results
  await expect(page).toHaveURL(/\/results/)

  // Ensure at least one trip card is visible
  const cards = await page.locator('[data-test-id="trip-card"]').first()
  await expect(cards).toBeVisible()
})
