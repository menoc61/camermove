import { test, expect } from '@playwright/test'

test('Transport interurban flow shows results', async ({ page }) => {
  // Go to home page
  await page.goto('/')

  // Click on the Transport rail CTA (the nav "Transport interurbain" link is not
  // always actionable; the rail CTA is the visible funnel entry)
  await page.getByRole('link', { name: /Voir tous les trajets/i }).first().click()

  // Wait for results page to load and URL contains /results
  await expect(page).toHaveURL(/\/results/)

  // Ensure at least one trip result is visible (price rendered per trip card)
  await expect(page.locator('main').getByText(/XAF/).first()).toBeVisible()
})
