import { prisma } from "@camermove/db"
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, createLogger, loadEnv } from "@camermove/config"
import { invalidateCache } from "../lib/cache.js"
import { reserve, confirmPaymentSuccess, cancel, rentalAdapter } from "../booking-kernel/index.js"
import { initiatePayment, createRentalBookingPayment as createPayment } from "../payments/service.js"

const log = createLogger()

export type DurationUnit = "hour" | "day" | "week" | "month"

export function durationFor(
  vehicle: { durationUnit: string },
  startDate: Date,
  endDate: Date,
): number {
  const ms = endDate.getTime() - startDate.getTime()
  if (ms <= 0) throw new BadRequestError("endDate doit être après startDate")
  const unit = vehicle.durationUnit as DurationUnit
  if (unit === "hour") return Math.max(1, Math.ceil(ms / 3600000))
  if (unit === "week") return Math.max(1, Math.ceil(ms / (86400000 * 7)))
  if (unit === "month") return Math.max(1, Math.ceil(ms / (86400000 * 30)))
  return Math.max(1, Math.ceil(ms / 86400000))
}

export async function createRentalBooking(input: {
  rentalVehicleId: string
  userId: string
  startDate: Date
  endDate: Date
  pickupCity: string
  pickupAddress?: string
  dropoffCity?: string
  dropoffAddress?: string
  driverName?: string
  driverPhone?: string
  meta?: Record<string, unknown>
}) {
  if (input.endDate.getTime() <= input.startDate.getTime()) {
    throw new BadRequestError("endDate doit être après startDate")
  }

  const result = await reserve({
    kind: "rental",
    userId: input.userId,
    startDate: input.startDate,
    endDate: input.endDate,
    pickupCity: input.pickupCity,
    dropoffCity: input.dropoffCity,
    driverName: input.driverName,
    driverPhone: input.driverPhone,
    // Dates ride in meta so the kernel create-data carries every
    // RentalBooking column (duration/unit derive in mapCreateData).
    meta: {
      rentalVehicleId: input.rentalVehicleId,
      pickupCity: input.pickupCity,
      pickupAddress: input.pickupAddress,
      dropoffCity: input.dropoffCity,
      dropoffAddress: input.dropoffAddress,
      driverName: input.driverName,
      driverPhone: input.driverPhone,
      startDate: input.startDate,
      endDate: input.endDate,
      ...input.meta,
    },
  })

  return { ...result, rentalVehicleId: input.rentalVehicleId }
}

export async function createRentalBookingPayment(input: {
  rentalBookingId: string
  userId: string
  provider: "notchpay" | "cinetpay"
  phone?: string
  email?: string
  method?: string
  meta?: Record<string, unknown>
}) {
  return createPayment({
    rentalBookingId: input.rentalBookingId,
    userId: input.userId,
    provider: input.provider,
    phone: input.phone,
    email: input.email,
    method: input.method,
    meta: input.meta,
  })
}

/**
 * Confirm a rental booking after payment success (webhook / reconciliation).
 * ACID: status flip inside $transaction with SELECT ... FOR UPDATE row locks.
 * Idempotent: replay returns { confirmed: false } without re-executing, but
 * still re-publishes the typed notification event for fan-out safety.
 */
export async function confirmRentalPaymentSuccess(paymentId: string, event: unknown): Promise<{ confirmed: boolean; bookingId: string }> {
  const result = await confirmPaymentSuccess("rental", paymentId, event)
  return { confirmed: result.confirmed, bookingId: result.entityId }
}

/**
 * User cancellation for a rental booking. Cancellable only from pending_payment —
 * a confirmed (paid) booking must go through support (409).
 * ACID: status flip inside $transaction with SELECT ... FOR UPDATE row lock.
 * No inventory to restore: the overlap guard counts pending_payment/confirmed/active
 * only, so flipping to cancelled frees the vehicle period.
 */
export async function cancelRentalBooking(id: string, actorId: string, actorRole = "traveler") {
  const result = await cancel("rental", { entityId: id, actorId, actorRole })
  return result
}

export { rentalAdapter }