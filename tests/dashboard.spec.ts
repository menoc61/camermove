import { test, expect } from '@playwright/test'

test('Unauthenticated /dashboard redirects to /login', async ({ page }) => {
  // Fresh context has no cm_access cookie / persisted auth
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
  await expect(page.getByRole('button', { name: /Se connecter/i }).first()).toBeVisible({
    timeout: 15000,
  })
})
