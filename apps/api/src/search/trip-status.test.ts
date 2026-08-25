import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@camermove/db"
import { ForbiddenError } from "@camermove/config"
import { setTripStatus } from "./trip-status"

// Live-PG authorization matrix for POST /trips/:id/status (BOOK-05 / SC3).
// Precondition: docker compose up -d (same as packages/db suite).
let t1Id: string
let t2Id: string
let routeId: string
let ownTripId: string
let secondOwnTripId: string
let staff1Id: string
let staff2Id: string
const createdUserIds: string[] = []
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`

beforeAll(async () => {
  const t1 = await prisma.transporter.create({
    data: { companyName: "Owner Co", email: `t1-${suffix}@co.com` },
  })
  t1Id = t1.id
  const t2 = await prisma.transporter.create({
    data: { companyName: "Rival Co", email: `t2-${suffix}@co.com` },
  })
  t2Id = t2.id

  const mk = async (role: string, emailPrefix: string, transporterId?: string) => {
    const u = await prisma.user.create({
      data: { email: `${emailPrefix}-${suffix}@test.com`, role: role as never, transporterId },
    })
    createdUserIds.push(u.id)
    return u.id
  }
  staff1Id = await mk("transporter_staff", "staff1", t1Id)
  staff2Id = await mk("transporter_staff", "staff2", t2Id)
  await mk("transporter_staff", "staff0") // unlinked staff — no transporter
  await mk("admin", "admin")
  await mk("traveler", "trav")

  const route = await prisma.route.create({
    data: { originCity: "Douala", destinationCity: "Kribi", transporterId: t1Id },
  })
  routeId = route.id
  const tripData = () => ({
    routeId,
    transportId: t1Id,
    departureAt: new Date(Date.now() + 86400000),
    price: 4000,
    totalSeats: 10,
    status: "active",
    seatAvailability: { create: { seatsAvailable: 10, seatsHeld: 0, seatsBooked: 0 } },
  })
  const own = await prisma.trip.create({ data: tripData() })
  ownTripId = own.id
  const second = await prisma.trip.create({ data: tripData() })
  secondOwnTripId = second.id
})

afterAll(async () => {
  // AuditLog.actor FK is Restrict — clear audit trail before deleting users
  if (createdUserIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } })
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
  }
  await prisma.trip.deleteMany({ where: { id: { in: [ownTripId, secondOwnTripId].filter(Boolean) } } })
  if (routeId) await prisma.route.deleteMany({ where: { id: routeId } })
  await prisma.transporter.deleteMany({ where: { id: { in: [t1Id, t2Id].filter(Boolean) } } })
  await prisma.$disconnect()
})

describe("setTripStatus authorization matrix", () => {
  it("STAFF1 pauses their OWN trip", async () => {
    const res = await setTripStatus({ tripId: ownTripId, action: "pause", actor: { id: staff1Id, role: "transporter_staff" } })
    expect(res.status).toBe("paused")
    const row = await prisma.trip.findUniqueOrThrow({ where: { id: ownTripId } })
    expect(row.status).toBe("paused")
  }, 30000)

  it("STAFF1 reopens their trip", async () => {
    const res = await setTripStatus({ tripId: ownTripId, action: "reopen", actor: { id: staff1Id, role: "transporter_staff" } })
    expect(res.status).toBe("active")
    const row = await prisma.trip.findUniqueOrThrow({ where: { id: ownTripId } })
    expect(row.status).toBe("active")
  }, 30000)

  it("STAFF1 closes their trip", async () => {
    const res = await setTripStatus({ tripId: ownTripId, action: "close", actor: { id: staff1Id, role: "transporter_staff" } })
    expect(res.status).toBe("closed")
    const row = await prisma.trip.findUniqueOrThrow({ where: { id: ownTripId } })
    expect(row.status).toBe("closed")
  }, 30000)

  it("STAFF2 (foreign transporter) is forbidden and status is unchanged", async () => {
    await expect(
      setTripStatus({ tripId: ownTripId, action: "pause", actor: { id: staff2Id, role: "transporter_staff" } })
    ).rejects.toThrow(ForbiddenError)
    const row = await prisma.trip.findUniqueOrThrow({ where: { id: ownTripId } })
    expect(row.status).toBe("closed")
  }, 30000)

  it("unlinked transporter_staff is forbidden", async () => {
    const unlinked = await prisma.user.findFirstOrThrow({
      where: { email: { startsWith: "staff0-" } },
      select: { id: true },
    })
    await expect(
      setTripStatus({ tripId: ownTripId, action: "pause", actor: { id: unlinked.id, role: "transporter_staff" } })
    ).rejects.toThrow(ForbiddenError)
  }, 30000)

  it("traveler is forbidden", async () => {
    const trav = await prisma.user.findFirstOrThrow({
      where: { email: { startsWith: "trav-" } },
      select: { id: true },
    })
    await expect(
      setTripStatus({ tripId: ownTripId, action: "pause", actor: { id: trav.id, role: "traveler" } })
    ).rejects.toThrow(ForbiddenError)
  }, 30000)

  it("admin transitions ANY trip", async () => {
    const admin = await prisma.user.findFirstOrThrow({
      where: { email: { startsWith: "admin-" } },
      select: { id: true },
    })
    const res = await setTripStatus({ tripId: secondOwnTripId, action: "close", actor: { id: admin.id, role: "admin" } })
    expect(res.status).toBe("closed")
    const row = await prisma.trip.findUniqueOrThrow({ where: { id: secondOwnTripId } })
    expect(row.status).toBe("closed")
  }, 30000)

  it("unknown trip raises NotFoundError", async () => {
    const { NotFoundError } = await import("@camermove/config")
    await expect(
      setTripStatus({ tripId: "nonexistent-id", action: "pause", actor: { id: staff1Id, role: "transporter_staff" } })
    ).rejects.toThrow(NotFoundError)
  }, 30000)
})
