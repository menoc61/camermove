import { test, expect } from "@playwright/test";

test.describe("Observability Screenshots", () => {
  test("prometheus-overview", async ({ page }) => {
    await page.goto("http://localhost:9090", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "docs/screenshots/prometheus-overview.png", fullPage: true });
  });

  test("prometheus-targets", async ({ page }) => {
    await page.goto("http://localhost:9090/targets", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "docs/screenshots/prometheus-targets.png", fullPage: true });
  });

  test("prometheus-alerts", async ({ page }) => {
    await page.goto("http://localhost:9090/alerts", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "docs/screenshots/prometheus-alerts.png", fullPage: true });
  });

  test("grafana-dashboard", async ({ page }) => {
    await page.goto("http://localhost:3001", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "docs/screenshots/grafana-dashboard.png", fullPage: true });
  });

  test("grafana-api", async ({ page }) => {
    await page.goto("http://localhost:3001/dashboards", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "docs/screenshots/grafana-api.png", fullPage: true });
  });

  test("grafana-bookings", async ({ page }) => {
    await page.goto("http://localhost:3001/explore", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "docs/screenshots/grafana-bookings.png", fullPage: true });
  });
});
