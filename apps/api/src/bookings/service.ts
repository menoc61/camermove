import { prisma } from "@camermove/db"
import { atomicReleaseHeldSeats, atomicConfirmBookedSeats } from "@camermove/db"
import { ConflictError, NotFoundError, createLogger } from "@camermove/config"
import { randomUUID } from "node:crypto"
import { findExpiredHolds } from "./repository"
import { expireHold, expireHolds as kernelExpireHolds, reserve as kernelReserve } from "../booking-kernel/index.js"

const log = createLogger()

export function generateReference(): string {
  return `CM-${randomUUID().slice(0, 8).toUpperCase()}`
}

export async function createBooking(input: { tripId: string; userId: string; seatCount: number; passengers: Array<{ fullName: string; phone?: string }> }) {
  if (input.passengers.length !== input.seatCount) throw new ConflictError("Le nombre de passagers doit correspondre au nombre de places")

  // Kernel reserve owns: trip row lock + seatAvailability FOR UPDATE atomic hold +
  // booking row create + passengers nested create + booking.created event publish +
  // hold-expiry BullMQ schedule. See apps/api/src/booking-kernel/reserve.ts.
  const result = await kernelReserve({
    kind: "trip",
    userId: input.userId,
    meta: {
      id: input.tripId,
      seatCount: input.seatCount,
      passengers: input.passengers,
    },
  })

  // Reload with the kernel's booking id so the route returns the same shape it used to
  // (passengers + trip joined). Kernel create already wrote the booking + passengers;
  // we just re-read.
  const booking = await prisma.booking.findUnique({
    where: { id: result.id },
    include: { passengers: true, trip: true },
  })
  if (!booking) throw new NotFoundError("Réservation introuvable après création")

  // Audit log is best-effort and post-commit so it never blocks the booking creation
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.userId,
        action: "booking.create",
        entityType: "Booking",
        entityId: booking.id,
        metadata: { tripId: input.tripId, seatCount: input.seatCount, passengerCount: input.passengers.length, totalAmount: booking.totalAmount, reference: booking.reference } as never,
      },
    })
  } catch {}
  return booking
}

/** Expire a single hold by id. Uses booking-kernel's expireHold for consistency. */
export async function expireHoldById(bookingId: string): Promise<boolean> {
  return expireHold("trip", bookingId)
}

export async function expireHolds(): Promise<number> {
  // Use kernel's bulk expire for consistency
  return kernelExpireHolds("trip")
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