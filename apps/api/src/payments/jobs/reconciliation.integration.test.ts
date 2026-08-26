import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@camermove/db"
import { confirmPaymentSuccess } from "./reconciliation"
import { refundPayment } from "./refund"

// Live-PG regression for Task A2 (prod-integrity): payment jobs must NEVER
// fabricate User rows. All system-actor AuditLog writes reference the single
// migrated service principal (id="system", passwordHash NULL, status "system").
// Precondition: docker compose up -d + migrations applied.
let transporterId: string
let tripId: string
let userId: string
let bookingId: string
let paymentId: string
let baselineFabricatedUsers = 0

beforeAll(async () => {
  // Guard: the service principal must exist (migration 20260826114221_system_principal).
  const principal = await prisma.user.findUnique({ where: { id: "system" } })
  expect(principal).not.toBeNull()
  expect(principal!.passwordHash).toBeNull()
  expect(principal!.status).toBe("system")

  baselineFabricatedUsers = await prisma.user.count({ where: { email: { contains: "@camermove.cm" } } })

  const transporter = await prisma.transporter.create({
    data: { companyName: "Principal Co", email: `principal-${Date.now()}-${Math.random().toString(36).slice(2)}@co.com` },
  })
  transporterId = transporter.id
  const route = await prisma.route.create({
    data: { originCity: "Douala", destinationCity: "Bafoussam", transporterId },
  })
  const trip = await prisma.trip.create({
    data: {
      routeId: route.id,
      transportId: transporterId,
      departureAt: new Date(Date.now() + 3 * 86400000),
      price: 5000,
      totalSeats: 4,
      seatAvailability: { create: { seatsAvailable: 3, seatsHeld: 1, seatsBooked: 0 } },
    },
  })
  tripId = trip.id
  const user = await prisma.user.create({
    data: { email: `principal-user-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`, role: "traveler" },
  })
  userId = user.id
  const booking = await prisma.booking.create({
    data: {
      reference: `CM-A2-${Date.now().toString().slice(-8)}`,
      tripId,
      userId,
      seatCount: 1,
      totalAmount: 5000,
      status: "pending_payment",
      holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  })
  bookingId = booking.id
  const payment = await prisma.payment.create({
    data: {
      bookingId,
      provider: "notchpay",
      providerRef: `a2-${booking.id}`,
      amount: 5000,
      currency: "XAF",
      method: "mobile_money",
      status: "pending",
    },
  })
  paymentId = payment.id
})

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { entityType: "Payment", entityId: paymentId } }).catch(() => {})
  await prisma.notification.deleteMany({ where: { payload: { path: ["bookingId"], equals: bookingId } } }).catch(() => {})
  await prisma.commission.deleteMany({ where: { bookingId } }).catch(() => {})
  await prisma.ticket.deleteMany({ where: { bookingId } }).catch(() => {})
  await prisma.payment.deleteMany({ where: { bookingId } }).catch(() => {})
  await prisma.booking.deleteMany({ where: { id: bookingId } }).catch(() => {})
  await prisma.trip.deleteMany({ where: { id: tripId } }).catch(() => {})
  await prisma.route.deleteMany({ where: { transporterId } }).catch(() => {})
  await prisma.transporter.deleteMany({ where: { id: transporterId } }).catch(() => {})
  await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {})
})

describe("confirmPaymentSuccess — service principal integrity", () => {
  it("audits with actorId='system' without creating any User row", async () => {
    await confirmPaymentSuccess({ id: paymentId, bookingId }, { id: "evt-a2", type: "transaction.paid", source: "test" })

    const after = await prisma.user.count({ where: { email: { contains: "@camermove.cm" } } })
    expect(after).toBe(baselineFabricatedUsers)

    const audit = await prisma.auditLog.findFirst({ where: { entityType: "Payment", entityId: paymentId, action: "payment.success" } })
    expect(audit?.actorId).toBe("system")
  })
})

describe("refundPayment — actor resolution (never fabricates users)", () => {
  // Re-arm refunded fixtures (booking/payment statuses + seat counts hit by the
  // previous refund's release) so each refund runs against a fresh payable state.
  async function rearm() {
    await prisma.booking.update({ where: { id: bookingId }, data: { status: "confirmed" } })
    await prisma.payment.update({ where: { id: paymentId }, data: { status: "success" } })
    await prisma.seatAvailability.update({
      where: { tripId },
      data: { seatsAvailable: 3, seatsHeld: 0, seatsBooked: 1 },
    })
    await prisma.auditLog.deleteMany({ where: { entityType: "Payment", entityId: paymentId, action: "payment.refunded" } })
  }

  it("resolves a real actor id and audits under it", async () => {
    await rearm()
    await refundPayment(paymentId, userId, "test-refund")
    const audit = await prisma.auditLog.findFirst({ where: { entityType: "Payment", entityId: paymentId, action: "payment.refunded" } })
    expect(audit?.actorId).toBe(userId)
    expect(await prisma.user.count({ where: { email: { contains: "@camermove.cm" } } })).toBe(baselineFabricatedUsers)
  })

  it("falls back to 'system' for automated refunds (actorId='system')", async () => {
    await rearm()

    await refundPayment(paymentId, "system", "auto-refund")
    const audit = await prisma.auditLog.findFirst({ where: { entityType: "Payment", entityId: paymentId, action: "payment.refunded" } })
    expect(audit?.actorId).toBe("system")
    expect(await prisma.user.count({ where: { email: { contains: "@camermove.cm" } } })).toBe(baselineFabricatedUsers)
  })

  it("rejects unknown actors — rolls back instead of fabricating a User row", async () => {
    await rearm()

    await expect(refundPayment(paymentId, "ghost-actor-nope", "bad-actor")).rejects.toThrow("refund_actor_not_found:ghost-actor-nope")
    // Transaction rolled back: payment untouched, no fabricated user, no audit row.
    expect((await prisma.payment.findUnique({ where: { id: paymentId } }))?.status).toBe("success")
    expect((await prisma.booking.findUnique({ where: { id: bookingId } }))?.status).toBe("confirmed")
    expect(await prisma.user.findUnique({ where: { id: "ghost-actor-nope" } })).toBeNull()
    const audit = await prisma.auditLog.count({ where: { entityType: "Payment", entityId: paymentId, action: "payment.refunded" } })
    expect(audit).toBe(0)
  })
})
