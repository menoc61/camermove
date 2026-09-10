import { test, expect } from '@playwright/test'

test('Events funnel lists events and detail offers booking after login', async ({ page }) => {
  // Login page pre-fills the demo traveler account (user@camermove.cm / User123!)
  await page.goto('/login')
  await page.getByRole('button', { name: /Se connecter/i }).first().click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 })

  await page.goto('/events')
  await expect(page.getByRole('heading', { name: /Événements/i })).toBeVisible({ timeout: 15000 })

  const firstEvent = page.locator('a[href^="/events/"]').first()
  await expect(firstEvent).toBeVisible({ timeout: 15000 })
  await firstEvent.click()

  await expect(page).toHaveURL(/\/events\/.+/, { timeout: 15000 })

  // Detail shows ticket categories with a booking CTA (stop before external payment redirect)
  await expect(page.getByRole('heading', { name: /Billets disponibles/i })).toBeVisible({
    timeout: 15000,
  })
  await expect(page.getByRole('button', { name: /Réserver/i }).first()).toBeVisible({
    timeout: 15000,
  })
})
