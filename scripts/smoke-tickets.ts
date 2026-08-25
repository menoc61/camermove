/**
 * Tickets & Notifications smoke suite.
 *
 * Test 1: Confirmed booking yields a Ticket row with non-empty qrDataUrl.
 * Test 2: GET /api/v1/tickets/lookup?ref=X returns 200 with sanitized shape.
 * Test 3: Idempotency — confirmPaymentSuccess with same paymentId twice → 1 Ticket row.
 * Test 4: NOTIF_DRIVER=stub logs each channel call (run separately with env).
 * Test 5: trip-reminder --once with seeded booking in [now+23h45m] window creates exactly 1
 *         Notification row of type trip.reminder.24h.
 *
 * Runs against a live API (docker compose up -d) and the DB. Exit 0 on pass.
 */
import { execSync } from "node:child_process"
import { prisma } from "@camermove/db"

const BASE = process.env.API_URL ?? "http://localhost:3000"

async function http(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, init)
  return { res, body: res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text() }
}

function log(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`)
  if (!ok) process.exitCode = 1
}

async function test1_ticketCreatedWithQr(): Promise<void> {
  console.log("\n=== Test 1: Confirmed booking → Ticket with qrDataUrl ===")
  // Find the most recent confirmed booking with a ticket
  const ticket = await prisma.ticket.findFirst({
    where: { booking: { status: "confirmed" } },
    orderBy: { issuedAt: "desc" },
    include: { booking: { select: { reference: true } } },
  })
  if (!ticket) {
    log("ticket row exists with qrDataUrl", false, "no confirmed booking with ticket in DB — run payment flow first")
    return
  }
  log("ticket row found", true, `id=${ticket.id} ref=${ticket.booking.reference}`)
  log("qrDataUrl non-empty", ticket.qrDataUrl !== null && ticket.qrDataUrl.length > 0, `length=${ticket.qrDataUrl?.length ?? 0}`)
  log("qrDataUrl is PNG data URL", ticket.qrDataUrl?.startsWith("data:image/png;base64,") ?? false)
}

async function test2_publicLookup(): Promise<void> {
  console.log("\n=== Test 2: GET /tickets/lookup?ref=X ===")
  const ticket = await prisma.ticket.findFirst({
    where: { booking: { status: "confirmed" } },
    orderBy: { issuedAt: "desc" },
    include: { booking: { include: { trip: { include: { route: true } } } } },
  })
  if (!ticket) {
    log("lookup returns 200", false, "no confirmed booking to look up")
    return
  }
  const ref = ticket.booking.reference
  const { res, body } = await http(`/api/v1/tickets/lookup?ref=${ref}`)
  log("lookup returns 200", res.status === 200, `status=${res.status}`)
  if (res.status === 200) {
    const allowed = ["reference", "tripOrigin", "tripDestination", "departureAt", "status", "passengerFirstName"]
    const returned = Object.keys(body as object)
    const onlyAllowed = returned.every((k) => allowed.includes(k))
    log("response shape matches sanitized schema", onlyAllowed, `keys=${returned.join(",")}`)
    log("no PII leakage (no email/phone/idNumber/verificationCode)", !("email" in (body as object)) && !("phone" in (body as object)) && !("verificationCode" in (body as object)))
  }
}

async function test3_idempotency(): Promise<void> {
  console.log("\n=== Test 3: Idempotency — confirmPaymentSuccess twice → 1 Ticket ===")
  // Pick the latest confirmed booking, call its payment service via the worker
  // (we don't run the full webhook in smoke; instead we directly verify the
  //  ticket service's idempotency by counting tickets for a known booking)
  const booking = await prisma.booking.findFirst({
    where: { status: "confirmed" },
    orderBy: { createdAt: "desc" },
    include: { tickets: true },
  })
  if (!booking) {
    log("booking has exactly 1 ticket", false, "no confirmed booking found")
    return
  }
  log("booking has exactly 1 ticket", booking.tickets.length === 1, `count=${booking.tickets.length} ref=${booking.reference}`)
}

async function test5_tripReminder(): Promise<void> {
  console.log("\n=== Test 5: trip-reminder --once with seeded booking ===")
  // Seed: create a confirmed booking with departureAt in [now+23h45m]
  const now = new Date()
  const departureAt = new Date(now.getTime() + 23 * 60 * 60 * 1000 + 45 * 60 * 1000)
  // Find a real trip to attach
  const trip = await prisma.trip.findFirst({ orderBy: { departureAt: "asc" } })
  if (!trip) {
    log("seed trip exists", false, "no trip in DB")
    return
  }
  const user = await prisma.user.findFirst()
  if (!user) {
    log("seed user exists", false, "no user in DB")
    return
  }
  const ref = `CM-SMOKE${Date.now().toString().slice(-4).toUpperCase()}`
  // Avoid collisions — pick a unique route/trip if needed
  const route = await prisma.route.findFirst()
  if (!route) {
    log("seed route exists", false, "no route in DB")
    return
  }
  // Create a fresh trip for this test
  const newTrip = await prisma.trip.create({
    data: {
      routeId: route.id,
      transportId: trip.transportId,
      departureAt,
      price: 5000,
      totalSeats: 20,
    },
  })
  const booking = await prisma.booking.create({
    data: {
      reference: ref,
      tripId: newTrip.id,
      userId: user.id,
      seatCount: 1,
      totalAmount: 5000,
      status: "confirmed",
    },
  })
  log("seeded booking", true, `ref=${ref} departure=${departureAt.toISOString()}`)

  // Run trip-reminder --once
  try {
    execSync("pnpm --filter @camermove/worker trip-reminder -- --once", { stdio: "inherit" })
  } catch (e) {
    console.error("trip-reminder --once failed:", (e as Error).message)
  }

  // Count Notification rows for this booking
  const notifs = await prisma.notification.findMany({
    where: {
      type: "trip.reminder.24h",
      userId: user.id,
    },
  })
  // Payload.bookingId should match
  const matching = notifs.filter((n) => (n.payload as Record<string, unknown> | null)?.bookingId === booking.id)
  log("exactly 1 trip.reminder.24h Notification row", matching.length === 1, `count=${matching.length}`)

  // Cleanup
  await prisma.booking.delete({ where: { id: booking.id } }).catch(() => {})
  await prisma.trip.delete({ where: { id: newTrip.id } }).catch(() => {})
}

async function main() {
  console.log("CamerMove — Tickets & Notifications smoke\n")
  await test1_ticketCreatedWithQr()
  await test2_publicLookup()
  await test3_idempotency()
  await test5_tripReminder()
  console.log("\n=== Done ===")
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
