import { prisma } from "@camermove/db"
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, createLogger, loadEnv } from "@camermove/config"
import { invalidateCache } from "../lib/cache.js"
import { reserve, confirmPaymentSuccess, cancel, getAdapter, hotelAdapter } from "../booking-kernel/index.js"
import { initiatePayment, createHotelBookingPayment as createPayment } from "../payments/service.js"

const log = createLogger()

export function calcNights(checkInDate: Date, checkOutDate: Date): number {
  const ms = checkOutDate.getTime() - checkInDate.getTime()
  return Math.max(1, Math.ceil(ms / 86400000))
}

export async function createHotelBooking(input: {
  hotelId: string
  roomTypeId: string
  userId: string
  checkInDate: Date
  checkOutDate: Date
  guestCount: number
  guestNames: string[]
  specialRequests?: string
  meta?: Record<string, unknown>
}) {
  if (input.checkOutDate.getTime() <= input.checkInDate.getTime()) {
    throw new BadRequestError("checkOut doit être après checkIn")
  }

  const result = await reserve({
    kind: "hotel",
    userId: input.userId,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    guestCount: input.guestCount,
    guestNames: input.guestNames,
    specialRequests: input.specialRequests,
    // Dates/guests ride in meta so the kernel create-data carries every
    // HotelBooking column (the kernel only spreads meta + kernel fields).
    meta: {
      hotelId: input.hotelId,
      roomTypeId: input.roomTypeId,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      guestCount: input.guestCount,
      guestNames: input.guestNames,
      specialRequests: input.specialRequests,
      ...input.meta,
    },
  })

  // The reserve() function already handles auditLog, cache invalidation, Kafka publish, and hold expiry scheduling
  // We just need to add the hotel-specific meta to the result
  return { ...result, hotelId: input.hotelId, roomTypeId: input.roomTypeId }
}

export async function createHotelBookingPayment(input: {
  hotelBookingId: string
  userId: string
  provider: "notchpay" | "cinetpay"
  phone?: string
  email?: string
  method?: string
  meta?: Record<string, unknown>
}) {
  return createPayment({
    hotelBookingId: input.hotelBookingId,
    userId: input.userId,
    provider: input.provider,
    phone: input.phone,
    email: input.email,
    method: input.method,
    meta: input.meta,
  })
}

/**
 * Confirm a hotel booking after payment success (webhook / reconciliation).
 * ACID: status flip inside $transaction with SELECT ... FOR UPDATE row locks.
 * Idempotent: replay returns { confirmed: false } without re-executing, but
 * still re-publishes the typed notification event for fan-out safety.
 */
export async function confirmHotelPaymentSuccess(paymentId: string, event: unknown): Promise<{ confirmed: boolean; bookingId: string }> {
  const result = await confirmPaymentSuccess("hotel", paymentId, event)
  return { confirmed: result.confirmed, bookingId: result.entityId }
}

/**
 * User cancellation for a hotel booking. Cancellable only from pending_payment —
 * a confirmed (paid) booking must go through support (409).
 * ACID: status flip inside $transaction with SELECT ... FOR UPDATE row lock.
 * No inventory to restore: availability is computed via overlap count over
 * pending_payment/confirmed only, so flipping to cancelled frees the room.
 */
export async function cancelHotelBooking(id: string, actorId: string, actorRole = "traveler") {
  const result = await cancel("hotel", { entityId: id, actorId, actorRole })
  return result
}

export { hotelAdapter }