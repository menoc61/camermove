import { test, expect } from '@playwright/test'

test('Homepage shows intro overlay on first visit (or skips it)', async ({ page }) => {
  await page.goto('/')
  const intro = page.getByLabel('Chargement de CamerMove')
  const appeared = await intro
    .waitFor({ state: 'attached', timeout: 8000 })
    .then(() => true)
    .catch(() => false)
  if (appeared) {
    // Overlay plays once (~2s) then unmounts and sets sessionStorage flag
    await expect(intro).toBeHidden({ timeout: 10000 })
  }
  // Either way the hero must render
  await expect(page.getByLabel('CamerMove — plateforme de mobilité')).toBeVisible({ timeout: 15000 })
})

test('Homepage renders hero chapters, 6 service rails and Method section', async ({ context, page }) => {
  await context.addInitScript(() => {
    try {
      window.sessionStorage.setItem('cm-intro-seen', '1')
    } catch {
      // ignore — intro will play once
    }
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  // Hero
  await expect(page.getByLabel('CamerMove — plateforme de mobilité')).toBeVisible({ timeout: 15000 })

  // 6 service rails (section aria-labels "index — kicker" are unique; avoids sr-only duplicates)
  for (const label of [
    '02 — Transport interurbain',
    '03 — Hôtels',
    '04 — Location de véhicules',
    '05 — Transport de colis',
    '06 — Assurance voyage',
    '07 — Billetterie événements',
  ]) {
    await expect(page.getByLabel(label, { exact: false }).first()).toBeVisible({ timeout: 15000 })
  }

  // Method section
  await expect(page.getByLabel('Notre méthode')).toBeVisible()
  await expect(page.getByText('08 — Méthode')).toBeVisible()
})
