/**
 * Tickets & Notifications smoke suite — self-contained (AGENTS.md §7).
 *
 * Requirements: docker compose up -d (postgres, redis, kafka, mailhog).
 * For full coverage also run `pnpm run dev` (API on :3000 + worker consuming
 * Kafka). Tests 2/4/5 print actionable hints when those are down.
 *
 * Test 1 (TICK-01): seed pending_payment booking + pending payment, drive
 *   confirmPaymentSuccess in-process (no provider creds needed on the confirm
 *   path) → booking confirmed + Ticket row with PNG qrDataUrl.
 * Test 2 (TICK-02): GET /api/v1/tickets/lookup?ref=X → 200, sanitized shape,
 *   no PII leakage.
 * Test 3 (idempotency): confirmPaymentSuccess replayed → still exactly 1 Ticket.
 * Test 4 (NOTIF-01..03): worker consumes ticket.issued / payment.confirmed /
 *   booking.confirmed → Notification rows persisted (status reported per channel).
 * Test 5 (trip reminder): confirmed booking departing in ~23h45m →
 *   trip-reminder --once → exactly 1 trip.reminder.24h Notification row.
 */
import { execSync } from "node:child_process"
import { prisma } from "@camermove/db"
import { confirmPaymentSuccess } from "../apps/api/src/payments/jobs/reconciliation.js"

const BASE = process.env.API_URL ?? "http://localhost:3000"

let failures = 0
function log(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`)
  if (!ok) {
    failures++
    process.exitCode = 1
  }
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Poll until predicate returns non-null, checking every 2s up to timeoutMs. */
async function poll<T>(fn: () => Promise<T | null>, timeoutMs: number): Promise<T | null> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const v = await fn()
    if (v !== null) return v
    if (Date.now() >= deadline) return null
    await sleep(2000)
  }
}

interface Seeded {
  user: { id: string; email: string }
  userPhoneBefore: string | null
  route: { id: string }
  transportId: string
  tripId: string
  bookingId: string
  bookingRef: string
  paymentId: string
}

/** Seed a payable booking: trip + seat availability + pending_payment booking + pending payment. */
async function seedPayableBooking(departureAt: Date): Promise<Seeded> {
  const route = await prisma.route.findFirst()
  if (!route) throw new Error("no route in DB — run seed first")
  const donorTrip = await prisma.trip.findFirst({ orderBy: { departureAt: "asc" } })
  if (!donorTrip) throw new Error("no trip in DB — run seed first")
  const user = await prisma.user.findFirst()
  if (!user) throw new Error("no user in DB — run seed first")
  // WhatsApp fan-out needs a phone; seeded users have none — provision temporarily.
  const userPhoneBefore = user.phone
  if (!user.phone) await prisma.user.update({ where: { id: user.id }, data: { phone: "+237690000001" } })

  const trip = await prisma.trip.create({
    data: {
      routeId: route.id,
      transportId: donorTrip.transportId,
      departureAt,
      price: 5000,
      totalSeats: 20,
      status: "active",
    },
  })
  await prisma.seatAvailability.create({
    data: { tripId: trip.id, seatsAvailable: 19, seatsHeld: 1, seatsBooked: 0 },
  })
  const bookingRef = `CM-${Date.now().toString().slice(-8)}`
  const booking = await prisma.booking.create({
    data: {
      reference: bookingRef,
      tripId: trip.id,
      userId: user.id,
      seatCount: 1,
      totalAmount: 5000,
      status: "pending_payment",
      holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  })
  const payment = await prisma.payment.create({
    data: {
      bookingId: booking.id,
      provider: "notchpay",
      providerRef: `smoke-${booking.id}`,
      amount: 5000,
      currency: "XAF",
      method: "mobile_money",
      status: "pending",
    },
  })
  return {
    user: { id: user.id, email: user.email },
    userPhoneBefore,
    route: { id: route.id },
    transportId: donorTrip.transportId,
    tripId: trip.id,
    bookingId: booking.id,
    bookingRef,
    paymentId: payment.id,
  }
}

const fakeWebhookEvent = { id: `evt-smoke-${Date.now()}`, type: "transaction.paid", source: "smoke" }

async function test1_ticketCreatedWithQr(seeded: Seeded): Promise<void> {
  console.log("\n=== Test 1: confirmPaymentSuccess → Ticket with qrDataUrl (TICK-01) ===")
  try {
    await confirmPaymentSuccess({ id: seeded.paymentId, bookingId: seeded.bookingId }, fakeWebhookEvent)
  } catch (e) {
    log("confirmPaymentSuccess runs without throwing", false, (e as Error).message)
    return
  }
  const booking = await prisma.booking.findUnique({ where: { id: seeded.bookingId }, include: { tickets: true } })
  log("booking.status becomes confirmed", booking?.status === "confirmed", `status=${booking?.status}`)
  const ticket = booking?.tickets[0]
  log("exactly 1 Ticket row created", booking?.tickets.length === 1, `count=${booking?.tickets.length ?? 0}`)
  if (!ticket) return
  log("qrDataUrl non-empty", !!ticket.qrDataUrl && ticket.qrDataUrl.length > 0, `length=${ticket.qrDataUrl?.length ?? 0}`)
  log("qrDataUrl is PNG data URL", ticket.qrDataUrl?.startsWith("data:image/png;base64,") ?? false)
  log("verificationCode is 12+ chars", ticket.verificationCode.length >= 12, `len=${ticket.verificationCode.length}`)
}

async function test2_publicLookup(seeded: Seeded): Promise<void> {
  console.log("\n=== Test 2: GET /api/v1/tickets/lookup?ref=X (TICK-02) ===")
  let res: Response
  try {
    res = await fetch(`${BASE}/api/v1/tickets/lookup?ref=${seeded.bookingRef}`)
  } catch {
    log("lookup reachable", false, `API unreachable at ${BASE} — start \`pnpm run dev\` (API on :3000)`)
    return
  }
  log("lookup returns 200", res.status === 200, `status=${res.status}`)
  if (res.status !== 200) return
  const body = (await res.json()) as Record<string, unknown>
  const allowed = ["reference", "tripOrigin", "tripDestination", "departureAt", "status", "passengerFirstName"]
  const keys = Object.keys(body)
  log("response shape matches sanitized schema", keys.every((k) => allowed.includes(k)), `keys=${keys.join(",")}`)
  const pii = ["email", "phone", "idNumber", "verificationCode"].filter((k) => k in body)
  log("no PII leakage", pii.length === 0, pii.length ? `leaked=${pii.join(",")}` : "clean")
}

async function test3_idempotency(seeded: Seeded): Promise<void> {
  console.log("\n=== Test 3: idempotency — confirmPaymentSuccess replayed → 1 Ticket ===")
  try {
    await confirmPaymentSuccess({ id: seeded.paymentId, bookingId: seeded.bookingId }, { ...fakeWebhookEvent, id: `evt-smoke-replay-${Date.now()}` })
  } catch (e) {
    log("replay does not throw", false, (e as Error).message)
    return
  }
  const count = await prisma.ticket.count({ where: { bookingId: seeded.bookingId } })
  log("booking still has exactly 1 ticket", count === 1, `count=${count}`)
  const commissionCount = await prisma.commission.count({ where: { bookingId: seeded.bookingId } })
  log("commission not duplicated", commissionCount === 1, `count=${commissionCount}`)
}

async function test4_notificationRows(seeded: Seeded): Promise<void> {
  console.log("\n=== Test 4: worker fan-out → Notification rows (NOTIF-01..03) ===")
  const expected = ["ticket.issued", "payment.confirmed", "booking.confirmed"]
  const rows = await poll(async () => {
    const found = await prisma.notification.findMany({ where: { userId: seeded.user.id, type: { in: expected } } })
    const ours = found.filter((n) => (n.payload as Record<string, unknown> | null)?.bookingId === seeded.bookingId)
    const types = new Set(ours.map((n) => n.type))
    return expected.every((t) => types.has(t)) ? ours : null
  }, 90_000)
  if (!rows) {
    const any = await prisma.notification.count({ where: { userId: seeded.user.id, type: { in: expected } } })
    log(
      "Notification rows for ticket.issued + payment.confirmed + booking.confirmed",
      false,
      any > 0 ? `partial (${any} rows)` : `none after 90s — worker not consuming Kafka; start \`pnpm run dev\``,
    )
    return
  }
  log("Notification rows persisted for all 3 event types", true, `${rows.length} rows`)
  const byType = new Map<string, string[]>()
  for (const r of rows) {
    const list = byType.get(r.type) ?? []
    list.push(`${r.channel}:${r.status}`)
    byType.set(r.type, list)
  }
  for (const [type, chans] of byType) console.log(`   ${type} → ${chans.join(", ")}`)
  const ticketRows = rows.filter((r) => r.type === "ticket.issued")
  const channels = new Set(ticketRows.map((r) => r.channel))
  log("ticket.issued fans out to email + whatsapp + push", channels.has("email") && channels.has("whatsapp") && channels.has("push"), `channels=${[...channels].join(",")}`)
}

async function test5_tripReminder(): Promise<void> {
  console.log("\n=== Test 5: trip-reminder --once → trip.reminder.24h Notification ===")
  const departureAt = new Date(Date.now() + 23 * 60 * 60 * 1000 + 45 * 60 * 1000)
  const seeded = await seedPayableBooking(departureAt)
  // Make it confirmed so findBookingsToRemind picks it up
  await prisma.booking.update({ where: { id: seeded.bookingId }, data: { status: "confirmed" } })
  await prisma.payment.update({ where: { id: seeded.paymentId }, data: { status: "success" } })
  log("seeded confirmed booking in 24h window", true, `ref=${seeded.bookingRef} departure=${departureAt.toISOString()}`)

  try {
    try {
      execSync("pnpm --filter @camermove/worker trip-reminder -- --once", { stdio: "inherit" })
    } catch (e) {
      log("trip-reminder --once exits 0", false, (e as Error).message)
      return
    }

    const row = await poll(async () => {
      const found = await prisma.notification.findMany({ where: { userId: seeded.user.id, type: "trip.reminder.24h" } })
      return found.find((n) => (n.payload as Record<string, unknown> | null)?.bookingId === seeded.bookingId) ?? null
    }, 90_000)
    if (!row) {
      log("exactly 1 trip.reminder.24h row per channel", false, "none after 90s — worker not consuming Kafka; start `pnpm run dev`")
      return
    }
    const all = await prisma.notification.findMany({ where: { userId: seeded.user.id, type: "trip.reminder.24h" } })
    const ours = all.filter((n) => (n.payload as Record<string, unknown> | null)?.bookingId === seeded.bookingId)
    const perChannel = new Map<string, number>()
    for (const n of ours) perChannel.set(n.channel, (perChannel.get(n.channel) ?? 0) + 1)
    const ok = ours.length > 0 && [...perChannel.values()].every((c) => c === 1)
    log(
      "exactly 1 trip.reminder.24h row per channel",
      ok,
      `channels=${[...perChannel].map(([ch, c]) => `${ch}:${c}`).join(",")}`,
    )
  } finally {
    await cleanup(seeded)
  }
}

/** Delete all artifacts of a seeded run (notifications → commission → payment → booking → trip → user.phone restore). */
async function cleanup(seeded: Seeded): Promise<void> {
  await prisma.notification
    .deleteMany({ where: { userId: seeded.user.id, payload: { path: ["bookingId"], equals: seeded.bookingId } } })
    .catch(() => {})
  await prisma.commission.deleteMany({ where: { bookingId: seeded.bookingId } }).catch(() => {})
  await prisma.payment.deleteMany({ where: { bookingId: seeded.bookingId } }).catch(() => {})
  await prisma.booking.deleteMany({ where: { id: seeded.bookingId } }).catch(() => {})
  await prisma.trip.deleteMany({ where: { id: seeded.tripId } }).catch(() => {})
  if (seeded.userPhoneBefore === null) {
    await prisma.user.update({ where: { id: seeded.user.id }, data: { phone: null } }).catch(() => {})
  }
}

async function main() {
  console.log("CamerMove — Tickets & Notifications smoke\n")
  const departureAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  const seeded = await seedPayableBooking(departureAt)
  log("seeded payable booking", true, `ref=${seeded.bookingRef}`)
  try {
    await test1_ticketCreatedWithQr(seeded)
    await test2_publicLookup(seeded)
    await test3_idempotency(seeded)
    await test4_notificationRows(seeded)
    await test5_tripReminder()
  } finally {
    await cleanup(seeded)
  }
  console.log(`\n${failures === 0 ? "✓ all tickets smoke tests passed" : `✗ ${failures} check(s) failed`}`)
  await prisma.$disconnect()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
