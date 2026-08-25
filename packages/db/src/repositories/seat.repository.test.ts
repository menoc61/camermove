import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "../prisma"
import { atomicHoldSeats, atomicReleaseHeldSeats, atomicConfirmBookedSeats } from "./seat.repository"

let tripId: string
let routeId: string
let transporterId: string
// Dedicated race-fixture trip, created inside the test so it cannot interfere
// with the shared sequential fixtures; deleted in afterAll
let raceTripId: string | null = null

beforeAll(async () => {
  const transporter = await prisma.transporter.create({
    data: { companyName: "Test Co", email: `t-${Date.now()}@co.com` },
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
      totalSeats: 2,
      seatAvailability: { create: { seatsAvailable: 2, seatsHeld: 0, seatsBooked: 0 } },
    },
  })
  tripId = trip.id
})

afterAll(async () => {
  if (raceTripId) await prisma.trip.deleteMany({ where: { id: raceTripId } })
  await prisma.trip.deleteMany({ where: { id: tripId } })
  await prisma.route.deleteMany({ where: { id: routeId } })
  await prisma.transporter.deleteMany({ where: { id: transporterId } })
  await prisma.$disconnect()
})

describe("atomicHoldSeats", () => {
  it("holds seats and decrements availability", async () => {
    const ok = await atomicHoldSeats(tripId, 1)
    expect(ok).toBe(true)
    const sa = await prisma.seatAvailability.findUniqueOrThrow({ where: { tripId } })
    expect(sa.seatsAvailable).toBe(1)
    expect(sa.seatsHeld).toBe(1)
  })

  it("rejects when insufficient seats (no double-booking on last seat)", async () => {
    await atomicHoldSeats(tripId, 1)
    await expect(atomicHoldSeats(tripId, 2)).rejects.toThrow()
    const sa = await prisma.seatAvailability.findUniqueOrThrow({ where: { tripId } })
    expect(sa.seatsAvailable).toBe(0)
    expect(sa.seatsHeld).toBe(2)
  })

  it("releases held seats back to availability", async () => {
    await atomicReleaseHeldSeats(tripId, 1)
    const sa = await prisma.seatAvailability.findUniqueOrThrow({ where: { tripId } })
    expect(sa.seatsAvailable).toBe(1)
    expect(sa.seatsHeld).toBe(1)
  })

  it("confirms held seats into booked", async () => {
    await atomicConfirmBookedSeats(tripId, 1)
    const sa = await prisma.seatAvailability.findUniqueOrThrow({ where: { tripId } })
    expect(sa.seatsBooked).toBe(1)
    expect(sa.seatsHeld).toBe(0)
  })
})

describe("concurrent last-seat race", () => {
  it("allows exactly one winner when two holds race for the final seat", async () => {
    const raceTrip = await prisma.trip.create({
      data: {
        routeId,
        transportId: transporterId,
        departureAt: new Date(Date.now() + 86400000),
        price: 3000,
        totalSeats: 1,
        seatAvailability: { create: { seatsAvailable: 1, seatsHeld: 0, seatsBooked: 0 } },
      },
    })
    raceTripId = raceTrip.id

    const results = await Promise.allSettled([atomicHoldSeats(raceTrip.id, 1), atomicHoldSeats(raceTrip.id, 1)])
    const fulfilled = results.filter((r) => r.status === "fulfilled")
    const rejected = results.filter((r) => r.status === "rejected")
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)

    const sa = await prisma.seatAvailability.findUniqueOrThrow({ where: { tripId: raceTrip.id } })
    expect(sa.seatsAvailable).toBe(0)
    expect(sa.seatsHeld).toBe(1)
  }, 30000)
})
