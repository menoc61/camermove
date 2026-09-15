import { prisma } from "@camermove/db"
import { BadRequestError, ConflictError, NotFoundError } from "@camermove/config"
import { invalidateCache } from "../lib/cache.js"
import { initiateEntityPayment, type PaymentProvider } from "../payments/initiate.js"
import { confirmPaymentSuccess, cancelIfPending, referenceForKind, type ConfirmPaymentAdapter, type CancelPendingAdapter, type ConfirmLink } from "../booking-kernel/index.js"

export function rentalBookingReference(id: string): string {
  return referenceForKind("rental", id)
}

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
  // default day
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

  const created = await prisma.$transaction(async (tx: any) => {
    const rows: Array<{ id: string; pricePerUnit: number; durationUnit: string; status: string }> =
      await tx.$queryRaw`SELECT "id","pricePerUnit","durationUnit","status" FROM "RentalVehicle" WHERE "id"=${input.rentalVehicleId} FOR UPDATE`
    const vehicle = rows[0]
    if (!vehicle) throw new NotFoundError("Véhicule introuvable")
    if (vehicle.status !== "available") throw new ConflictError("Véhicule non disponible")

    const overlap = await tx.rentalBooking.findFirst({
      where: {
        rentalVehicleId: input.rentalVehicleId,
        status: { in: ["pending_payment", "confirmed", "active"] },
        startDate: { lt: input.endDate },
        endDate: { gt: input.startDate },
      },
    })
    if (overlap) throw new ConflictError("Véhicule déjà réservé sur cette période")

    const duration = durationFor({ durationUnit: vehicle.durationUnit }, input.startDate, input.endDate)
    const totalAmount = vehicle.pricePerUnit * duration

    const booking = await tx.rentalBooking.create({
      data: {
        rentalVehicleId: input.rentalVehicleId,
        userId: input.userId,
        startDate: input.startDate,
        endDate: input.endDate,
        duration,
        durationUnit: vehicle.durationUnit as never,
        totalAmount,
        pickupCity: input.pickupCity,
        pickupAddress: input.pickupAddress,
        dropoffCity: input.dropoffCity ?? input.pickupCity,
        dropoffAddress: input.dropoffAddress,
        driverName: input.driverName,
        driverPhone: input.driverPhone,
        status: "pending_payment" as never,
      } as never,
      include: { vehicle: true },
    })
    return booking
  })

  const bid = (created as unknown as { id: string }).id
  const totalAmount = (created as unknown as { totalAmount: number }).totalAmount
  const duration = (created as unknown as { duration: number }).duration

  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.userId,
        action: "rental.booking.create",
        entityType: "RentalBooking",
        entityId: bid,
        metadata: {
          rentalVehicleId: input.rentalVehicleId,
          duration,
          totalAmount,
          startDate: input.startDate.toISOString(),
          endDate: input.endDate.toISOString(),
          pickupCity: input.pickupCity,
          dropoffCity: input.dropoffCity ?? input.pickupCity,
          ...(input.meta ?? {}),
        } as never,
      },
    })
  } catch {}

  const { publishEvent, makeDataEvent, EVENT_TOPICS } = await import("@camermove/events")
  await publishEvent(
    EVENT_TOPICS.rentalBookingCreated,
    makeDataEvent("rental.booking.created", bid, {
      id: bid,
      rentalVehicleId: input.rentalVehicleId,
      userId: input.userId,
      startDate: input.startDate.toISOString(),
      endDate: input.endDate.toISOString(),
      totalAmount,
      pickupCity: input.pickupCity,
      dropoffCity: input.dropoffCity ?? input.pickupCity,
    }),
  )

  try {
    await invalidateCache("rentals*")
    await invalidateCache("search*")
  } catch {}

  return created
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
  const rb = (await prisma.rentalBooking.findUnique({ where: { id: input.rentalBookingId } })) as unknown as {
    id: string
    userId: string
    status: string
    totalAmount: number
  } | null
  if (!rb) throw new NotFoundError("Réservation location introuvable")
  if (rb.userId !== input.userId) {
    const { ForbiddenError } = await import("@camermove/config")
    throw new ForbiddenError("Accès refusé")
  }
  if (rb.status !== "pending_payment") {
    throw new ConflictError(`Réservation non payable — statut: ${rb.status}`)
  }

  return initiateEntityPayment({
    kind: "rental",
    entityId: input.rentalBookingId,
    userId: input.userId,
    provider: input.provider as PaymentProvider,
    amount: rb.totalAmount,
    reference: rentalBookingReference(input.rentalBookingId),
    description: `CamerMove Rental ${rentalBookingReference(input.rentalBookingId)}`,
    phone: input.phone,
    email: input.email,
    method: input.method,
    meta: input.meta,
    notFoundMessage: "Réservation location introuvable",
    findFresh: async (tx) => (tx as typeof prisma).rentalBooking.findUnique({ where: { id: input.rentalBookingId } }) as unknown as { paymentId: string | null } | null,
    linkPayment: async (tx, paymentId) => {
      await (tx as typeof prisma).rentalBooking.update({ where: { id: input.rentalBookingId }, data: { paymentId } as never })
    },
    auditEntityMeta: { rentalBookingId: input.rentalBookingId },
  })
}

const confirmAdapter: ConfirmPaymentAdapter = {
  kind: "rental",
  notFoundMessage: "Réservation location introuvable pour ce paiement",
  table: "RentalBooking",
  isConfirmable: (e) => e.status === "pending_payment",
  findLink: async (paymentId, tx?) => {
    const client = (tx ?? prisma) as typeof prisma
    return (await client.rentalBooking.findFirst({ where: { paymentId } })) as unknown as (ConfirmLink & {
      pickupCity: string
      dropoffCity: string | null
      startDate: Date
      endDate: Date
    }) | null
  },
  confirm: async (tx, entityId) => {
    await ((tx as typeof prisma).rentalBooking.update({ where: { id: entityId }, data: { status: "confirmed" } as never }))
  },
  notification: (link) => ({
    topic: "camermove.rental.booking.confirmed" as const,
    type: "rental.booking.confirmed",
    userId: link.userId,
    payload: {
      bookingId: link.id,
      reference: rentalBookingReference(link.id),
      amount: link.totalAmount,
      pickupCity: (link as unknown as { pickupCity: string }).pickupCity,
      dropoffCity: (link as unknown as { dropoffCity: string | null }).dropoffCity ?? (link as unknown as { pickupCity: string }).pickupCity,
      startDate: (link as unknown as { startDate: Date }).startDate instanceof Date ? (link as unknown as { startDate: Date }).startDate.toISOString().slice(0, 10) : String((link as unknown as { startDate: Date }).startDate),
      endDate: (link as unknown as { endDate: Date }).endDate instanceof Date ? (link as unknown as { endDate: Date }).endDate.toISOString().slice(0, 10) : String((link as unknown as { endDate: Date }).endDate),
    },
  }),
}

/**
 * Confirm a rental booking after payment success (webhook / reconciliation).
 * ACID + idempotency ceremony lives in the booking-kernel.
 */
export async function confirmRentalPaymentSuccess(paymentId: string, event: unknown): Promise<{ confirmed: boolean; bookingId: string }> {
  const { entityId, confirmed } = await confirmPaymentSuccess(confirmAdapter, paymentId, event)
  return { confirmed, bookingId: entityId }
}

const cancelAdapter: CancelPendingAdapter<{ id: string; userId: string; status: string; totalAmount: number; pickupCity: string; dropoffCity: string | null; vehicle: { make: string; model: string } | null }> = {
  notFoundMessage: "Réservation location introuvable",
  table: "RentalBooking",
  find: async (id) =>
    (await prisma.rentalBooking.findUnique({ where: { id }, include: { vehicle: true } })) as unknown as { id: string; userId: string; status: string; totalAmount: number; pickupCity: string; dropoffCity: string | null; vehicle: { make: string; model: string } | null } | null,
  findFresh: async (tx, id) =>
    (await (tx as typeof prisma).rentalBooking.findUnique({ where: { id } })) as unknown as { id: string; userId: string; status: string; totalAmount: number } | null,
  assertCancellable: (entity) => {
    if (entity.status !== "pending_payment") {
      if (entity.status === "confirmed" || entity.status === "active") throw new ConflictError("Réservation déjà confirmée et payée — contactez le support pour toute annulation")
      throw new ConflictError(`Réservation non annulable — statut: ${entity.status}`)
    }
  },
  cancel: async (tx, entity) => (tx as typeof prisma).rentalBooking.update({ where: { id: entity.id }, data: { status: "cancelled" } as never }),
  auditAction: "rental.booking.cancel",
  auditEntityType: "RentalBooking",
  auditExtra: () => ({}),
  notification: (entity) => ({
    topic: "camermove.booking.status.changed" as const,
    type: "booking.status.changed",
    userId: entity.userId,
    payload: {
      bookingId: entity.id,
      reference: rentalBookingReference(entity.id),
      amount: entity.totalAmount,
      serviceLabel: "Location",
      entityLabel: entity.vehicle ? `${entity.vehicle.make} ${entity.vehicle.model}` : undefined,
      pickupCity: entity.pickupCity,
      dropoffCity: entity.dropoffCity ?? entity.pickupCity,
      newStatus: "cancelled",
      status: "cancelled",
    },
  }),
}

/**
 * User cancellation for a rental booking. Cancellable only from pending_payment —
 * a confirmed (paid) booking must go through support (409).
 * No inventory to restore: the overlap guard counts pending_payment/confirmed/active
 * only, so flipping to cancelled frees the vehicle period.
 * ACID ceremony lives in the booking-kernel.
 */
export async function cancelRentalBooking(id: string, actorId: string, actorRole = "traveler") {
  return cancelIfPending(cancelAdapter, id, actorId, actorRole)
}
