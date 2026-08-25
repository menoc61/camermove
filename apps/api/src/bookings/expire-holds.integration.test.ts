import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma, atomicHoldSeats } from "@camermove/db"
import { expireHolds, generateReference } from "./service"

// Live-PG regression for hold expiry (BOOK-02 / SC2).
// Precondition: docker compose up -d (same as packages/db suite).
//
// Fixtures bypass createBooking so timestamps are controlled:
//   A — pending_payment, holdExpiresAt in the PAST        → must expire, 2 seats returned
//   B — pending_payment, holdExpiresAt in the FUTURE      → untouched
//   C — pending_payment, past hold + active processing Payment → protected (Race A regression)
let transporterId: string
let routeId: string
let tripId: string
let userId: string
let bookingAId: string
let bookingBId: string
let bookingCId: string
// Shared dev DB may contain expirable rows from other suites — snapshot a baseline
// and assert exactly ONE additional booking expires (the fixture A).
let baselineExpirable = 0

beforeAll(async () => {
  baselineExpirable = await prisma.booking.count({
    where: { status: "pending_payment", holdExpiresAt: { lt: new Date() } },
  })

  const transporter = await prisma.transporter.create({
    data: { companyName: "Expire Co", email: `expire-${Date.now()}-${Math.random().toString(36).slice(2)}@co.com` },
  })
  transporterId = transporter.id
  const route = await prisma.route.create({
    data: { originCity: "Yaoundé", destinationCity: "Bafoussam", transporterId },
  })
  routeId = route.id
  const trip = await prisma.trip.create({
    data: {
      routeId,
      transportId: transporterId,
      departureAt: new Date(Date.now() + 86400000),
      price: 5000,
      totalSeats: 4,
      seatAvailability: { create: { seatsAvailable: 4, seatsHeld: 0, seatsBooked: 0 } },
    },
  })
  tripId = trip.id
  const user = await prisma.user.create({
    data: { email: `exp-user-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`, role: "traveler" },
  })
  userId = user.id

  // Hold all 4 seats: available 0 / held 4
  await atomicHoldSeats(tripId, 4)

  const now = Date.now()
  // A: expired hold, 2 seats
  const a = await prisma.booking.create({
    data: {
      reference: generateReference(),
      tripId,
      userId,
      seatCount: 2,
      totalAmount: 10000,
      status: "pending_payment",
      holdExpiresAt: new Date(now - 60 * 1000),
    },
  })
  bookingAId = a.id
  // B: future hold, 1 seat
  const b = await prisma.booking.create({
    data: {
      reference: generateReference(),
      tripId,
      userId,
      seatCount: 1,
      totalAmount: 5000,
      status: "pending_payment",
      holdExpiresAt: new Date(now + 15 * 60 * 1000),
    },
  })
  bookingBId = b.id
  // C: expired hold but active processing payment — payment protects it
  const c = await prisma.booking.create({
    data: {
      reference: generateReference(),
      tripId,
      userId,
      seatCount: 1,
      totalAmount: 5000,
      status: "pending_payment",
      holdExpiresAt: new Date(now - 60 * 1000),
      payments: {
        create: { provider: "notchpay", amount: 5000, currency: "XAF", status: "processing" },
      },
    },
  })
  bookingCId = c.id
})

afterAll(async () => {
  const bookingIds = [bookingAId, bookingBId, bookingCId].filter(Boolean)
  // The trg_booking_status DB trigger writes an AuditLog row (actor = booking owner)
  // on every status change — clear those before deleting users (FK Restrict)
  if (userId) {
    await prisma.auditLog.deleteMany({ where: { actorId: userId } })
  }
  if (bookingIds.length > 0) {
    await prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } })
  }
  if (tripId) await prisma.booking.deleteMany({ where: { tripId } })
  if (tripId) await prisma.trip.deleteMany({ where: { id: tripId } })
  if (routeId) await prisma.route.deleteMany({ where: { id: routeId } })
  if (transporterId) await prisma.transporter.deleteMany({ where: { id: transporterId } })
  if (userId) await prisma.user.deleteMany({ where: { id: userId } })
  await prisma.$disconnect()
})

describe("expireHolds (live Postgres)", () => {
  it("expires only past-due holds without active payments and returns exactly their seats", async () => {
    const count = await expireHolds()

    // Exactly one NEW booking expired: fixture A (baseline rows excluded)
    expect(count).toBe(baselineExpirable + 1)

    const a = await prisma.booking.findUniqueOrThrow({ where: { id: bookingAId } })
    expect(a.status).toBe("expired")

    const b = await prisma.booking.findUniqueOrThrow({ where: { id: bookingBId } })
    expect(b.status).toBe("pending_payment")

    // Race A regression: an active processing payment shields an expired hold
    const c = await prisma.booking.findUniqueOrThrow({ where: { id: bookingCId } })
    expect(c.status).toBe("pending_payment")

    // Seat accounting: only A's two seats returned; B and C still held
    const sa = await prisma.seatAvailability.findUniqueOrThrow({ where: { tripId } })
    expect(sa.seatsAvailable).toBe(2)
    expect(sa.seatsHeld).toBe(2)
    expect(sa.seatsBooked).toBe(0)
  }, 30000)

  it("is idempotent — a second sweep re-expires nothing (A already terminal)", async () => {
    // First sweep already expired A and every baseline row, so nothing is
    // pending_payment + past-due anymore: the second sweep must find zero.
    const count = await expireHolds()
    expect(count).toBe(0)

    const a = await prisma.booking.findUniqueOrThrow({ where: { id: bookingAId } })
    expect(a.status).toBe("expired")

    const sa = await prisma.seatAvailability.findUniqueOrThrow({ where: { tripId } })
    expect(sa.seatsAvailable).toBe(2)
    expect(sa.seatsHeld).toBe(2)
  }, 30000)
})
