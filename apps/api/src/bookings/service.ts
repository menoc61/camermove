import { prisma } from "@camermove/db"
import { atomicHoldSeats, atomicReleaseHeldSeats, atomicConfirmBookedSeats } from "@camermove/db"
import { ConflictError, NotFoundError, loadEnv } from "@camermove/config"
import { randomUUID } from "node:crypto"
import { findExpiredHolds } from "./repository"

export function generateReference(): string {
  return `CM-${randomUUID().slice(0, 8).toUpperCase()}`
}

async function publishBookingCreated(booking: { id: string; reference: string; tripId: string; userId: string }) {
  try {
    const env = loadEnv() as unknown as Record<string, unknown>
    const { createKafkaClient } = await import("@camermove/events")
    const { EVENT_TOPICS } = await import("@camermove/events")
    const kafka = createKafkaClient(env as never)
    const producer = kafka.producer({ idempotent: true })
    await producer.connect().catch(() => {})
    await producer
      .send({
        topic: EVENT_TOPICS.bookingCreated,
        messages: [{ key: booking.id, value: JSON.stringify({ id: booking.id, type: "booking.created", ts: new Date().toISOString(), aggregateId: booking.id, data: booking }) }],
      })
      .catch(() => {})
    await producer.disconnect().catch(() => {})
  } catch {}
}

export async function createBooking(input: { tripId: string; userId: string; seatCount: number; passengers: Array<{ fullName: string; phone?: string }> }) {
  if (input.passengers.length !== input.seatCount) throw new ConflictError("Le nombre de passagers doit correspondre au nombre de places")
  const trip = await prisma.trip.findUnique({ where: { id: input.tripId }, include: { seatAvailability: true } })
  if (!trip) throw new NotFoundError("Trajet introuvable")
  if (trip.status !== "active") throw new ConflictError("Trajet non disponible")

  await atomicHoldSeats(input.tripId, input.seatCount)

  try {
    const reference = generateReference()
    const totalAmount = trip.price * input.seatCount
    let holdMinutes = 15
    try {
      const settings = await prisma.appSettings.findUnique({ where: { id: "global" } })
      if (settings?.holdExpiryMinutes) holdMinutes = Number(settings.holdExpiryMinutes)
    } catch {}
    const holdExpiresAt = new Date(Date.now() + holdMinutes * 60 * 1000)

    const booking = await prisma.booking.create({
      data: {
        reference,
        tripId: input.tripId,
        userId: input.userId,
        seatCount: input.seatCount,
        totalAmount,
        status: "pending_payment",
        holdExpiresAt,
        passengers: { create: input.passengers.map((p) => ({ fullName: p.fullName, phone: p.phone })) },
      },
      include: { passengers: true, trip: true },
    })
    // AuditLog + Kafka — best-effort, never block booking success
    try {
      await prisma.auditLog.create({
        data: {
          actorId: input.userId,
          action: "booking.create",
          entityType: "Booking",
          entityId: booking.id,
          metadata: { tripId: input.tripId, seatCount: input.seatCount, passengerCount: input.passengers.length, totalAmount, reference } as never,
        },
      })
    } catch {}
    await publishBookingCreated({ id: booking.id, reference: booking.reference, tripId: booking.tripId, userId: booking.userId })
    return booking
  } catch (e) {
    await atomicReleaseHeldSeats(input.tripId, input.seatCount).catch(() => {})
    throw e
  }
}

export async function expireHolds(): Promise<number> {
  // findExpiredHolds excludes bookings with an active pending/processing Payment —
  // a paid-but-unconfirmed hold must survive so the late success webhook can confirm it
  const expired = await findExpiredHolds()
  let count = 0
   for (const b of expired) {
    const didExpire = await prisma.$transaction(async (tx: any): Promise<boolean> => {
      // Lock the row and re-check status inside the tx: a concurrent payment confirmation
      // (SELECT FOR UPDATE in the payment worker) may have flipped status moments ago
      await tx.$queryRaw`SELECT "id","status","tripId","seatCount" FROM "Booking" WHERE "id"=${b.id} FOR UPDATE`
      const fresh = await tx.booking.findUnique({ where: { id: b.id } })
      if (!fresh || fresh.status !== "pending_payment") return false
      await tx.booking.update({ where: { id: b.id }, data: { status: "expired" } })
      const sa = await tx.seatAvailability.findUnique({ where: { tripId: b.tripId } })
      if (sa && sa.seatsHeld >= b.seatCount) {
        await tx.seatAvailability.update({ where: { tripId: b.tripId }, data: { seatsAvailable: { increment: b.seatCount }, seatsHeld: { decrement: b.seatCount } } })
      }
      return true
    })
    if (didExpire) count++
  }
  return count
}

export async function confirmBooking(id: string) {
  const booking = await prisma.booking.findUnique({ where: { id } })
  if (!booking) throw new NotFoundError("Réservation introuvable")
  await atomicConfirmBookedSeats(booking.tripId, booking.seatCount)
  return prisma.booking.update({ where: { id }, data: { status: "confirmed" } })
}

export async function cancelBooking(
  id: string,
  actorId: string,
  actorRole: string = "traveler",
  transporterId?: string | null
) {
  const booking = await prisma.booking.findUnique({ where: { id } })
  if (!booking) throw new NotFoundError("Réservation introuvable")

  const trip = await prisma.trip.findUnique({ where: { id: booking.tripId } })
  if (!trip) throw new NotFoundError("Trajet introuvable")

  const actor = (["traveler", "transporter", "admin", "super_admin", "system"].includes(actorRole) ? actorRole : "traveler") as import("./cancellation").CancelActor
  const { evaluateCancellation } = await import("./cancellation")
  const result = await evaluateCancellation({ booking: booking as never, trip: trip as never, actor, actorId, transporterId })

  if (!result.allowed) {
    throw new ConflictError(result.reason ?? result.policy)
  }

  // Release or confirm seats depending on prior status
  if (booking.status === "pending_payment") {
    await atomicReleaseHeldSeats(booking.tripId, booking.seatCount)
  } else if (booking.status === "confirmed") {
    // Return held/booked seats to available
    await prisma.$transaction(async (tx: any) => {
      const sa = await tx.seatAvailability.findUnique({ where: { tripId: booking.tripId } })
      if (sa) {
        await tx.seatAvailability.update({ where: { tripId: booking.tripId }, data: { seatsAvailable: { increment: booking.seatCount }, seatsBooked: { decrement: booking.seatCount } } })
      }
    })
  }

  // Void tickets
  await prisma.ticket.updateMany({ where: { bookingId: id, status: "valid" }, data: { status: "void" } })

  // If payment succeeded and refund is due, mark payment as refunded (actual provider refund is async via worker)
  if (result.refundAmount > 0) {
    await prisma.payment.updateMany({ where: { bookingId: id, status: "success" }, data: { status: "refunded" } })
  }

  const updated = await prisma.booking.update({ where: { id }, data: { status: result.refundAmount > 0 ? "refunded" : "cancelled" } })

  await prisma.auditLog.create({
    data: {
      actorId,
      action: `booking.cancel.${result.tier}`,
      entityType: "Booking",
      entityId: id,
      metadata: { refundPercent: result.refundPercent, refundAmount: result.refundAmount, feeAmount: result.feeAmount, policy: result.policy } as never,
    },
  })

  return { booking: updated, cancellation: result }
}
