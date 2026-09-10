import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@camermove/db"
import { createBooking } from "./service"

// Last-seat race (ACID / AGENTS.md §1 + §7).
// Precondition: docker compose up -d (same as expire-holds suite).
//
// A trip with exactly 1 seat available faces N=5 concurrent createBooking
// calls. The SELECT … FOR UPDATE row lock in atomicHoldSeats must serialize
// the racers: exactly 1 succeeds, 4 fail with ConflictError, and
// seatsAvailable never goes negative.
const RACERS = 5

let transporterId: string
let routeId: string
let tripId: string
let userIds: string[] = []

beforeAll(async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const transporter = await prisma.transporter.create({
    data: { companyName: "LastSeat Co", email: `lastseat-${suffix}@co.com` },
  })
  transporterId = transporter.id
  const route = await prisma.route.create({
    data: { originCity: "Yaoundé", destinationCity: "Douala", transporterId },
  })
  routeId = route.id
  const trip = await prisma.trip.create({
    data: {
      routeId,
      transportId: transporterId,
      departureAt: new Date(Date.now() + 86400000),
      price: 5000,
      totalSeats: 1,
      seatAvailability: { create: { seatsAvailable: 1, seatsHeld: 0, seatsBooked: 0 } },
    },
  })
  tripId = trip.id
  for (let i = 0; i < RACERS; i++) {
    const user = await prisma.user.create({
      data: { email: `lastseat-user-${i}-${suffix}@test.com`, role: "traveler" },
    })
    userIds.push(user.id)
  }
})

afterAll(async () => {
  // The trg_booking_status DB trigger writes an AuditLog row (actor = booking
  // owner) on every status change — clear those before deleting users (FK Restrict).
  // Passengers cascade-delete with their booking; payments are Restrict.
  if (userIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } })
  }
  if (tripId) {
    const bookings = await prisma.booking.findMany({ where: { tripId }, select: { id: true } })
    const bookingIds = bookings.map((b) => b.id)
    if (bookingIds.length > 0) {
      await prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } })
    }
    await prisma.booking.deleteMany({ where: { tripId } })
    await prisma.trip.deleteMany({ where: { id: tripId } })
  }
  if (routeId) await prisma.route.deleteMany({ where: { id: routeId } })
  if (transporterId) await prisma.transporter.deleteMany({ where: { id: transporterId } })
  if (userIds.length > 0) await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  await prisma.$disconnect()
})

describe("last-seat race (live Postgres)", () => {
  it("exactly 1 of 5 concurrent createBooking wins; seatsAvailable never negative", async () => {
    const results = await Promise.allSettled(
      userIds.map((userId, i) =>
        createBooking({
          tripId,
          userId,
          seatCount: 1,
          passengers: [{ fullName: `Racer ${i}` }],
        }),
      ),
    )

    const won = results.filter((r) => r.status === "fulfilled")
    const lost = results.filter((r) => r.status === "rejected")
    expect(won).toHaveLength(1)
    expect(lost).toHaveLength(RACERS - 1)

    // Re-read availability from the DB: the losers must not have overdrawn it.
    const sa = await prisma.seatAvailability.findUniqueOrThrow({ where: { tripId } })
    expect(sa.seatsAvailable).toBe(0)
    expect(sa.seatsHeld).toBe(1)
    expect(sa.seatsBooked).toBe(0)
    expect(sa.seatsAvailable).toBeGreaterThanOrEqual(0)

    // Exactly one booking row exists for the trip.
    const bookings = await prisma.booking.findMany({ where: { tripId } })
    expect(bookings).toHaveLength(1)
    expect(bookings[0]!.seatCount).toBe(1)
    expect(bookings[0]!.status).toBe("pending_payment")
  }, 30000)
})
