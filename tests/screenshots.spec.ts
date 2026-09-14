import { test, expect, Page } from '@playwright/test'

/**
 * CamerMove - Comprehensive Screenshot Test Suite
 * Ensures all pages load before capturing screenshots
 */

async function skipIntro(page: Page) {
  await page.addInitScript(() => {
    try { window.sessionStorage.setItem('cm-intro-seen', '1') } catch { /* ignore */ }
  })
}

async function waitForPageLoad(page: Page, timeout = 15000) {
  await page.waitForLoadState('domcontentloaded', { timeout })
  await page.waitForLoadState('networkidle', { timeout: timeout / 2 }).catch(() => {})
  await page.waitForTimeout(500)
}

async function login(page: Page, email = 'user@camermove.cm', password = 'User123!') {
  await page.goto('/login')
  await waitForPageLoad(page)
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/**', { timeout: 15000 })
  await page.waitForTimeout(1000)
}

async function screenshot(page: Page, name: string) {
  try {
    await page.screenshot({ path: `docs/screenshots/${name}.png`, fullPage: true, timeout: 10000 })
    console.log(`OK ${name}`)
  } catch (e) {
    console.log(`FAIL ${name} - ${e.message}`)
  }
}

test.describe('Public Pages', () => {
  test.beforeEach(async ({ page }) => { await skipIntro(page) })

  test('01 - Homepage', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await waitForPageLoad(page, 30000)
    await expect(page.getByLabel('CamerMove — plateforme de mobilité')).toBeVisible({ timeout: 30000 })
    await page.waitForTimeout(3000)
    await screenshot(page, 'homepage')
  })

  test('02 - Search Results', async ({ page }) => {
    await page.goto('/results?origin=Yaound%C3%A9&destination=Douala&pax=1')
    await waitForPageLoad(page)
    await screenshot(page, 'results')
  })

  test('03 - Hotels', async ({ page }) => {
    await page.goto('/hotels')
    await waitForPageLoad(page)
    await screenshot(page, 'hotels')
  })

  test('04 - Rentals', async ({ page }) => {
    await page.goto('/rentals')
    await waitForPageLoad(page)
    await screenshot(page, 'rentals')
  })

  test('05 - Parcels', async ({ page }) => {
    await page.goto('/parcels')
    await waitForPageLoad(page)
    await screenshot(page, 'parcels')
  })

  test('06 - Events', async ({ page }) => {
    await page.goto('/events')
    await waitForPageLoad(page)
    await screenshot(page, 'events')
  })

  test('07 - Insurance', async ({ page }) => {
    await page.goto('/insurance')
    await waitForPageLoad(page)
    await screenshot(page, 'insurance')
  })

  test('08 - FAQ', async ({ page }) => {
    await page.goto('/faq')
    await waitForPageLoad(page)
    await screenshot(page, 'faq')
  })

  test('09 - How It Works', async ({ page }) => {
    await page.goto('/how-it-works')
    await waitForPageLoad(page)
    await screenshot(page, 'how-it-works')
  })

  test('10 - Legal CGU', async ({ page }) => {
    await page.goto('/legal/cgu')
    await waitForPageLoad(page)
    await screenshot(page, 'legal-cgu')
  })

  test('11 - Legal Privacy', async ({ page }) => {
    await page.goto('/legal/privacy')
    await waitForPageLoad(page)
    await screenshot(page, 'legal-privacy')
  })

  test('12 - Contact', async ({ page }) => {
    await page.goto('/contact')
    await waitForPageLoad(page)
    await screenshot(page, 'contact')
  })

  test('13 - Become Partner', async ({ page }) => {
    await page.goto('/become-partner')
    await waitForPageLoad(page)
    await screenshot(page, 'become-partner')
  })

  test('14 - Transporter Apply', async ({ page }) => {
    await page.goto('/transporter/apply')
    await waitForPageLoad(page)
    await screenshot(page, 'transporter-apply')
  })

  test('15 - Login', async ({ page }) => {
    await page.goto('/login')
    await waitForPageLoad(page)
    await screenshot(page, 'login')
  })

  test('16 - Register', async ({ page }) => {
    await page.goto('/register')
    await waitForPageLoad(page)
    await screenshot(page, 'register')
  })

  test('17 - Admin Login', async ({ page }) => {
    await page.goto('/admin/login')
    await waitForPageLoad(page)
    await screenshot(page, 'admin-login')
  })

  test('18 - Ticket Lookup', async ({ page }) => {
    await page.goto('/tickets/lookup')
    await waitForPageLoad(page)
    await screenshot(page, 'ticket-lookup')
  })
})

test.describe('Authenticated Pages', () => {
  test.beforeEach(async ({ page }) => {
    await skipIntro(page)
    await login(page)
  })

  test('19 - Dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await waitForPageLoad(page)
    await page.waitForTimeout(2000)
    await screenshot(page, 'dashboard')
  })

  test('20 - Dashboard Bookings', async ({ page }) => {
    await page.goto('/dashboard')
    await waitForPageLoad(page)
    await page.waitForTimeout(1000)
    await screenshot(page, 'dashboard-bookings')
  })

  test('21 - Dashboard Tickets', async ({ page }) => {
    await page.goto('/dashboard')
    await waitForPageLoad(page)
    await page.waitForTimeout(1000)
    await screenshot(page, 'dashboard-tickets')
  })
})

test.describe('Admin Pages', () => {
  test.beforeEach(async ({ page }) => {
    await skipIntro(page)
    await login(page, 'admin@camermove.cm', 'Admin123!')
  })

  test('22 - Admin Dashboard', async ({ page }) => {
    await page.goto('/admin')
    await waitForPageLoad(page)
    await page.waitForTimeout(2000)
    await screenshot(page, 'admin-dashboard')
  })

  test('23 - Admin Users', async ({ page }) => {
    await page.goto('/admin/users')
    await waitForPageLoad(page)
    await screenshot(page, 'admin-users')
  })

  test('24 - Admin Trips', async ({ page }) => {
    await page.goto('/admin/trips')
    await waitForPageLoad(page)
    await screenshot(page, 'admin-trips')
  })

  test('25 - Admin Bookings', async ({ page }) => {
    await page.goto('/admin/bookings')
    await waitForPageLoad(page)
    await screenshot(page, 'admin-bookings')
  })

  test('26 - Admin Payments', async ({ page }) => {
    await page.goto('/admin/payments')
    await waitForPageLoad(page)
    await screenshot(page, 'admin-payments')
  })

  test('27 - Admin Transporters', async ({ page }) => {
    await page.goto('/admin/transporters')
    await waitForPageLoad(page)
    await screenshot(page, 'admin-transporters')
  })

  test('28 - Admin Settings', async ({ page }) => {
    await page.goto('/admin/settings')
    await waitForPageLoad(page)
    await screenshot(page, 'admin-settings')
  })
})

test.describe('API Documentation', () => {
  test('29 - Swagger UI', async ({ page }) => {
    await page.goto('http://localhost:3000/docs')
    await waitForPageLoad(page)
    await page.waitForTimeout(3000)
    await screenshot(page, 'swagger')
  })

  test('30 - Health Check', async ({ page }) => {
    await page.goto('http://localhost:3000/health')
    await waitForPageLoad(page)
    await screenshot(page, 'health')
  })
})

test.describe('Mobile Responsive', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('31 - Homepage Mobile', async ({ page }) => {
    await skipIntro(page)
    await page.goto('/')
    await expect(page.getByLabel('CamerMove — plateforme de mobilité')).toBeVisible({ timeout: 20000 })
    await page.waitForTimeout(2000)
    await screenshot(page, 'mobile-homepage')
  })

  test('32 - Login Mobile', async ({ page }) => {
    await page.goto('/login')
    await waitForPageLoad(page)
    await screenshot(page, 'mobile-login')
  })

  test('33 - Nav Menu Mobile', async ({ page }) => {
    await skipIntro(page)
    await page.goto('/')
    await waitForPageLoad(page)
    const hamburger = page.locator('button[aria-label="Ouvrir le menu"]')
    if (await hamburger.isVisible().catch(() => false)) {
      await hamburger.click()
      await page.waitForTimeout(1500)
    }
    await screenshot(page, 'mobile-nav')
  })
})