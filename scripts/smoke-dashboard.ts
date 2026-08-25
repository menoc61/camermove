/**
 * Dashboard smoke suite.
 *
 * Test 1: login + dashboard — GET /api/v1/me/dashboard with valid JWT returns
 *         200 with exactly 3 keys (upcoming, history, tickets).
 * Test 2: unauth dashboard — GET /api/v1/me/dashboard without auth → 401.
 * Test 3: ticket ownership leak — user A attempting to access user B's ticket
 *         returns 404 (NOT 403, so no existence leak).
 * Test 4: public lookup SSR — GET /tickets/lookup?ref=X on WEB port renders
 *         server-side HTML with the reference text, and the body does NOT
 *         contain the verificationCode.
 * Test 5: public lookup not-found — GET /tickets/lookup?ref=NOTEXIST renders
 *         "Billet introuvable".
 *
 * Requires: docker compose up -d running, db seeded with at least one user
 * and at least one confirmed booking with a ticket.
 *
 * Test credentials are picked from seeded users; if not available, the test
 * skips with a clear message. Runs against API at $API_URL (default localhost:3000)
 * and WEB at $WEB_URL (default localhost:3001).
 */
import { prisma } from "@camermove/db"

const API = process.env.API_URL ?? "http://localhost:3000"
const WEB = process.env.WEB_URL ?? "http://localhost:3001"

let failures = 0
function log(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`)
  if (!ok) {
    failures++
    process.exitCode = 1
  }
}

async function loginExisting(email: string, password: string): Promise<string | null> {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) return null
  const body = (await res.json()) as { accessToken?: string }
  return body.accessToken ?? null
}

async function loginOrRegister(email: string, password: string): Promise<string | null> {
  const existing = await loginExisting(email, password)
  if (existing) return existing
  const reg = await fetch(`${API}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, firstName: "Smoke", lastName: "Dash" }),
  })
  if (!reg.ok) return null
  const body = (await reg.json()) as { accessToken?: string }
  return body.accessToken ?? null
}

async function test1_loginAndDashboard(): Promise<void> {
  console.log("\n=== Test 1: login + dashboard ===")
  const email = "smoke-dashboard@camermove.cm"
  const password = "S3cret!123"
  const token = await loginOrRegister(email, password)
  if (!token) {
    log("login", false, "could not authenticate")
    return
  }
  log("login", true)

  const res = await fetch(`${API}/api/v1/me/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  log("dashboard returns 200", res.status === 200, `status=${res.status}`)
  if (res.status !== 200) return
  const body = (await res.json()) as Record<string, unknown>
  const keys = Object.keys(body).sort()
  log(
    "response has exactly {upcoming, history, tickets}",
    keys.length === 3 && keys.includes("history") && keys.includes("tickets") && keys.includes("upcoming"),
    `keys=${keys.join(",")}`,
  )
}

async function test2_unauthDashboard(): Promise<void> {
  console.log("\n=== Test 2: unauth dashboard ===")
  const res = await fetch(`${API}/api/v1/me/dashboard`)
  log("no Authorization → 401", res.status === 401, `status=${res.status}`)
}

async function test3_ticketOwnershipLeak(): Promise<void> {
  console.log("\n=== Test 3: ticket ownership returns 404 (no leak) ===")
  // Find two distinct users with at least one confirmed booking+ ticket each.
  const bookings = await prisma.booking.findMany({
    where: { status: "confirmed" },
    include: { tickets: { select: { id: true } } },
    take: 10,
  })
  const userA = bookings.find((b) => b.tickets.length > 0)
  if (!userA || !userA.tickets[0]) {
    log("seed data has confirmed booking with ticket", false, "no confirmed booking+ticket found")
    return
  }
  const ticketId = userA.tickets[0].id

  // Create a fresh user that doesn't own ticketId
  const email = `smoke-other-${Date.now()}@camermove.cm`
  const password = "S3cret!123"
  const otherToken = await loginOrRegister(email, password)
  if (!otherToken) {
    log("second user login", false)
    return
  }

  const res = await fetch(`${API}/api/v1/me/tickets/${ticketId}`, {
    headers: { Authorization: `Bearer ${otherToken}` },
  })
  log("non-owner GET /api/v1/me/tickets/:id → 404 (not 403)", res.status === 404, `status=${res.status}`)
}

async function test4_publicLookupSSR(): Promise<void> {
  console.log("\n=== Test 4: public lookup SSR ===")
  const ticket = await prisma.ticket.findFirst({
    where: { booking: { status: "confirmed" } },
    include: { booking: { select: { reference: true } } },
  })
  if (!ticket) {
    log("seed has confirmed ticket", false, "no confirmed ticket in DB")
    return
  }
  const ref = ticket.booking.reference
  const res = await fetch(`${WEB}/tickets/lookup?ref=${encodeURIComponent(ref)}`, {
    cache: "no-store",
  })
  log("GET /tickets/lookup?ref=X → 200", res.status === 200, `status=${res.status}`)
  if (res.status !== 200) return
  const body = await res.text()
  log("body contains reference text", body.includes(ref), `ref=${ref}`)
  log("body does NOT contain verificationCode", !body.includes(ticket.verificationCode), `code=${ticket.verificationCode}`)
}

async function test5_publicLookupNotFound(): Promise<void> {
  console.log("\n=== Test 5: public lookup not found ===")
  const res = await fetch(`${WEB}/tickets/lookup?ref=NOTEXIST`, { cache: "no-store" })
  const body = await res.text()
  const ok = res.status === 404 || body.includes("Billet introuvable")
  log("GET /tickets/lookup?ref=NOTEXIST → 404 or 'Billet introuvable'", ok, `status=${res.status}`)
}

async function main() {
  console.log("CamerMove — Dashboard smoke\n")
  await test1_loginAndDashboard()
  await test2_unauthDashboard()
  await test3_ticketOwnershipLeak()
  await test4_publicLookupSSR()
  await test5_publicLookupNotFound()
  console.log(`\n${failures === 0 ? "✓" : "✗"} ${failures === 0 ? "all dashboard smoke tests passed" : `${failures} test(s) failed`}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
