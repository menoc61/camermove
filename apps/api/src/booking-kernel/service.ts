/**
 * booking-kernel — the one lifecycle module for every payable entity kind.
 * Owns: reserve(), confirmPaymentSuccess(), cancel(), expireHold()
 * ACID ceremony: SELECT ... FOR UPDATE, idempotency re-checks, audit log, typed event publish.
 */
import { prisma } from "@camermove/db"
import { scheduleHoldExpiry } from "@camermove/shared/queues"
import { ConflictError, NotFoundError, BadRequestError, ForbiddenError, createLogger, loadEnv } from "@camermove/config"
import { invalidateCache } from "../lib/cache.js"
import { EVENT_TOPICS, makeEvent, publishEvent } from "@camermove/events"
import { randomUUID } from "node:crypto"
import type { AdapterConfig, EntityRow, PayableKind, ReserveInput, ReserveResult } from "./types"
import { getAdapter } from "./adapters"
import { tripAdapter } from "./adapters"

const log = createLogger()

/** Generate a CM- reference for trip bookings */
function generateTripReference(): string {
  return `CM-${randomUUID().slice(0, 8).toUpperCase()}`
}

/**
 * Reserve — generic booking creation with FOR UPDATE + overlap count + pending_payment gate +
 * hold-expiry (AppSettings cached) + AuditLog + cache invalidate + scheduleHoldExpiry.
 * Per-kind adapters supply only overlap predicate + priceFn + reference prefix.
 */
export async function reserve(input: ReserveInput): Promise<ReserveResult> {
  const adapter = getAdapter(input.kind)
  const holdExpiryMinutes = await adapter.getHoldExpiryMinutes()
  const holdExpiresAt = new Date(Date.now() + holdExpiryMinutes * 60 * 1000)
  const reference = adapter.generateReference(randomUUID())
  const totalAmount = await adapter.priceFn(prisma, input)

  // Validate kind-specific required fields
  validateReserveInput(input)

  // Run the entire booking creation inside a transaction with FOR UPDATE
  const result = await prisma.$transaction(async (tx: unknown): Promise<{ entity: EntityRow; reference: string; totalAmount: number }> => {
    const t = tx as Record<string, unknown>

    // 1. Overlap check + hold (FOR UPDATE on availability row)
    const available = await adapter.overlapPredicate(tx, input)
    if (available === 0 && input.kind !== "parcel" && input.kind !== "insurance") {
      throw new ConflictError("Plus de disponibilité")
    }

    // 2. Create entity row with status = pending_payment
    const entity = await createEntityInTx(tx, input.kind, input, reference, totalAmount, holdExpiresAt)

    return { entity, reference, totalAmount }
  })

  // 3. Best-effort side effects (outside tx, never block success)
  await Promise.allSettled([
    // AuditLog
    prisma.auditLog.create({
      data: {
        actorId: input.userId,
        action: `${input.kind}.booking.create`,
        entityType: capitalize(input.kind) + "Booking",
        entityId: result.entity.id,
        metadata: { ...input.meta, ...adapter.notificationPayload(result.entity) } as never,
      },
    }).catch((e) => log.warn({ err: e.message }, "auditLog create failed")),

    // Cache invalidation
    invalidateCache(`${input.kind}s*`).catch(() => {}),
    invalidateCache("search*").catch(() => {}),

    // Kafka event publish
    publishEvent(
      EVENT_TOPICS.bookingCreated,
      makeEvent(`${input.kind}.booking.created`, result.entity.id, {
        type: `${input.kind}.booking.created`,
        userId: input.userId,
        payload: adapter.notificationPayload(result.entity),
      }),
    ).catch((e) => log.warn({ err: e.message }, "kafka publish failed")),

    // Schedule hold expiry (BullMQ)
    scheduleHoldExpiry(result.entity.id, holdExpiresAt.getTime() - Date.now()).catch((e) => {
      log.error({ err: e.message, entityId: result.entity.id }, "scheduleHoldExpiry failed")
    }),
  ])

  return { entity: result.entity, holdExpiresAt, reference: result.reference, totalAmount: result.totalAmount }
}

/** Create entity row inside transaction — per-kind branching */
async function createEntityInTx(
  tx: unknown,
  kind: PayableKind,
  input: ReserveInput,
  reference: string,
  totalAmount: number,
  holdExpiresAt: Date,
): Promise<EntityRow> {
  const t = tx as Record<string, unknown>

  switch (kind) {
    case "trip": {
      const tripId = input.checkInDate ? "" : (input.meta?.tripId as string)
      if (!tripId) throw new BadRequestError("tripId required for trip booking")
      await t.atomicHoldSeats?.(tripId, input.seatCount ?? 1)
      return t.booking.create({
        data: {
          reference,
          tripId,
          userId: input.userId,
          seatCount: input.seatCount ?? 1,
          totalAmount,
          status: "pending_payment",
          holdExpiresAt,
          passengers: { create: input.passengers?.map((p) => ({ fullName: p.fullName, phone: p.phone })) ?? [] },
        },
        include: { passengers: true, trip: true },
      })
    }
    case "hotel": {
      return t.hotelBooking.create({
        data: {
          hotelId: input.meta?.hotelId as string,
          roomTypeId: input.meta?.roomTypeId as string,
          userId: input.userId,
          checkInDate: input.checkInDate!,
          checkOutDate: input.checkOutDate!,
          guestCount: input.guestCount ?? 1,
          guestNames: input.guestNames ?? [],
          specialRequests: input.specialRequests,
          totalAmount,
          status: "pending_payment",
        } as never,
        include: { hotel: true, roomType: true },
      })
    }
    case "rental": {
      return t.rentalBooking.create({
        data: {
          rentalVehicleId: input.meta?.rentalVehicleId as string,
          userId: input.userId,
          startDate: input.startDate!,
          endDate: input.endDate!,
          pickupCity: input.pickupCity!,
          pickupAddress: input.meta?.pickupAddress as string,
          dropoffCity: input.dropoffCity ?? input.pickupCity,
          dropoffAddress: input.meta?.dropoffAddress as string,
          driverName: input.driverName,
          driverPhone: input.driverPhone,
          totalAmount,
          status: "pending_payment",
        } as never,
        include: { vehicle: true },
      })
    }
    case "event": {
      const verificationCode = `EVT-${randomUUID().slice(0, 8).toUpperCase()}`
      const ticketNumber = `EVT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
      const qrCode = `CM-T:${verificationCode}`
      let qrDataUrl: string | null = null
      try {
        const QRCode = (await import("qrcode")).default
        qrDataUrl = await QRCode.toDataURL(qrCode, { errorCorrectionLevel: "M", margin: 2, width: 240, color: { dark: "#0e9f8f", light: "#ffffff" } })
      } catch {}
      const created = await t.eventBooking.create({
        data: {
          eventId: input.eventId!,
          ticketCategoryId: input.ticketCategoryId!,
          userId: input.userId,
          quantity: input.quantity ?? 1,
          totalAmount,
          ticketNumber,
          qrCode,
          verificationCode,
          status: "pending_payment",
        } as never,
        include: { event: true, ticketCategory: true },
      })
      // Increment sold count
      await t.ticketCategory.update({
        where: { id: input.ticketCategoryId! },
        data: { sold: { increment: input.quantity ?? 1 } },
      })
      return { ...created, qrDataUrl } as EntityRow
    }
    case "parcel": {
      const trackingNumber = `CM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
      return t.parcel.create({
        data: {
          userId: input.userId,
          operatorId: input.operatorId ?? undefined,
          trackingNumber,
          senderName: input.senderName!,
          senderPhone: input.senderPhone!,
          senderCity: input.senderCity!,
          recipientName: input.recipientName!,
          recipientPhone: input.recipientPhone!,
          recipientCity: input.recipientCity!,
          recipientAddress: input.recipientAddress,
          parcelType: input.parcelType!,
          weightKg: input.weightKg ?? null,
          dimensionsCm: input.dimensionsCm,
          description: input.description,
          declaredValue: input.declaredValue ?? null,
          shippingCost: totalAmount,
          status: "registered",
          statusHistory: { create: { status: "registered", note: "Colis enregistré" } },
        } as never,
        include: { statusHistory: true },
      })
    }
    case "insurance": {
      throw new BadRequestError("Insurance booking not yet implemented")
    }
    default:
      throw new BadRequestError(`Unknown kind: ${kind}`)
  }
}

function validateReserveInput(input: ReserveInput): void {
  switch (input.kind) {
    case "trip":
      if (!input.seatCount || !input.passengers?.length) throw new BadRequestError("seatCount and passengers required")
      if (input.passengers.length !== input.seatCount) throw new BadRequestError("passenger count must match seatCount")
      if (!input.meta?.tripId) throw new BadRequestError("tripId required")
      break
    case "hotel":
      if (!input.checkInDate || !input.checkOutDate) throw new BadRequestError("checkInDate and checkOutDate required")
      if (input.checkOutDate.getTime() <= input.checkInDate.getTime()) throw new BadRequestError("checkOut must be after checkIn")
      if (!input.meta?.hotelId || !input.meta?.roomTypeId) throw new BadRequestError("hotelId and roomTypeId required")
      if (!input.guestNames?.length) throw new BadRequestError("guestNames required")
      break
    case "rental":
      if (!input.startDate || !input.endDate) throw new BadRequestError("startDate and endDate required")
      if (input.endDate.getTime() <= input.startDate.getTime()) throw new BadRequestError("endDate must be after startDate")
      if (!input.meta?.rentalVehicleId) throw new BadRequestError("rentalVehicleId required")
      if (!input.pickupCity) throw new BadRequestError("pickupCity required")
      break
    case "event":
      if (!input.eventId || !input.ticketCategoryId || !input.quantity) throw new BadRequestError("eventId, ticketCategoryId, quantity required")
      if (input.quantity < 1 || input.quantity > 10) throw new BadRequestError("quantity must be 1..10")
      break
    case "parcel":
      if (!input.senderName || !input.senderPhone || !input.recipientName || !input.recipientPhone || !input.senderCity || !input.recipientCity || !input.parcelType) {
        throw new BadRequestError("sender/recipient details and parcelType required")
      }
      break
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * confirmPaymentSuccess — one idempotent, ACID confirmation path for every
 * payable kind (webhook / reconciliation entry point).
 * Ceremony owned here: FOR UPDATE row locks on Payment + entity, status
 * idempotency re-checks, payment.success flip, entity confirm flip, AuditLog,
 * typed notification publish (re-published on replay for fan-out safety).
 */
export interface ConfirmResult {
  confirmed: boolean
  entityId: string
}

export async function confirmPaymentSuccess(kind: PayableKind, paymentId: string, event: unknown): Promise<ConfirmResult> {
  const adapter = getAdapter(kind)
  const link = await adapter.findEntityByPaymentId(paymentId)
  if (!link) throw new NotFoundError(`${capitalize(kind)} reservation not found for this payment`)

  let wasNew = false
  await prisma.$transaction(async (tx: unknown): Promise<void> => {
    const t = tx as {
      $queryRawUnsafe: (q: string, ...v: unknown[]) => Promise<unknown>
      payment: { findUnique: (a: unknown) => Promise<{ status: string; provider: string } | null>; update: (a: unknown) => Promise<unknown> }
      auditLog: { create: (a: unknown) => Promise<unknown> }
    }

    // FOR UPDATE locks on both tables
    await t.$queryRawUnsafe(`SELECT "id" FROM "${adapter.table}" WHERE "id" = $1 FOR UPDATE`, link.id)
    await t.$queryRawUnsafe(`SELECT "id" FROM "Payment" WHERE "id" = $1 FOR UPDATE`, paymentId)

    const freshPayment = await t.payment.findUnique({ where: { id: paymentId } })
    if (!freshPayment) return
    if (freshPayment.status === "success") return
    if (["failed", "expired", "refunded"].includes(freshPayment.status)) return

    const freshEntity = await adapter.findEntityByPaymentId(paymentId)
    if (!freshEntity || freshEntity.status !== "pending_payment") return

    await t.payment.update({ where: { id: paymentId }, data: { status: "success", webhookPayload: event as never } })
    await adapter.confirm?.(tx, link.id) // flip entity to confirmed
    // For kinds without confirm() (parcel, insurance), the status flip is a no-op

    try {
      await t.auditLog.create({
        data: {
          actorId: "system",
          action: "payment.success",
          entityType: "Payment",
          entityId: paymentId,
          metadata: { provider: freshPayment.provider, kind: adapter.kind, [`${adapter.kind}Id`]: link.id, deliveryId: (event as Record<string, unknown>)?.id ?? null } as never,
        },
      })
    } catch {}

    wasNew = true
  })

  const note = adapter.notificationPayload(link)
  await publishEvent(
    EVENT_TOPICS.paymentConfirmed,
    makeEvent("payment.confirmed", link.id, { type: "payment.confirmed", userId: link.userId, payload: note }),
  )
  return { confirmed: wasNew, entityId: link.id }
}

/**
 * cancelIfPending — one ACID user-cancellation path for every payable kind
 * except trip bookings (tiered refunds are trip-specific and stay in
 * bookings/cancellation.ts).
 * Ceremony owned here: ownership/admin gate, pre-condition policy hook,
 * SELECT ... FOR UPDATE + fresh re-check inside $transaction, inventory
 * release hook, status flip, AuditLog, typed status.changed publish.
 */
export async function cancel(kind: PayableKind, input: { entityId: string; actorId: string; actorRole?: string }): Promise<EntityRow> {
  const adapter = getAdapter(kind)
  const entity = await adapter.findEntity(input.entityId)
  if (!entity) throw new NotFoundError(`${capitalize(kind)} reservation not found`)

  // Ownership / admin check
  const isAdmin = input.actorRole === "admin" || input.actorRole === "super_admin"
  if (!isAdmin && entity.userId !== input.actorId) throw new ForbiddenError("Accès refusé")

  // Policy gate — only cancellable from pending_payment
  if (entity.status !== "pending_payment") {
    if (entity.status === "confirmed") throw new ConflictError("Réservation déjà confirmée et payée — contactez le support")
    throw new ConflictError(`Réservation non annulable — statut: ${entity.status}`)
  }

  const updated = await prisma.$transaction(async (tx: unknown): Promise<EntityRow> => {
    const t = tx as { $queryRawUnsafe: (q: string, ...v: unknown[]) => Promise<unknown> }
    await t.$queryRawUnsafe(`SELECT "id" FROM "${adapter.table}" WHERE "id" = $1 FOR UPDATE`, input.entityId)
    const fresh = await adapter.findEntity(input.entityId, tx)
    if (!fresh) throw new NotFoundError(`${capitalize(kind)} reservation not found`)
    if (fresh.status !== "pending_payment") {
      if (fresh.status === "confirmed") throw new ConflictError("Réservation déjà confirmée et payée — contactez le support")
      throw new ConflictError(`Réservation non annulable — statut: ${fresh.status}`)
    }
    if (adapter.releaseInventory) await adapter.releaseInventory(tx, fresh)
    return t[adapter.idField === "id" ? `${kind}Booking` : adapter.table.toLowerCase()].update({
      where: { id: input.entityId },
      data: { status: "cancelled" },
    }) as Promise<EntityRow>
  })

  // AuditLog
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: `${kind}.booking.cancel`,
        entityType: capitalize(kind) + "Booking",
        entityId: input.entityId,
        metadata: { userId: entity.userId, status: "cancelled", totalAmount: entity.totalAmount, ...adapter.auditExtra?.(entity) } as never,
      },
    })
  } catch {}

  // Typed status.changed event
  await publishEvent(
    EVENT_TOPICS.bookingStatusChanged,
    makeEvent("booking.status.changed", input.entityId, {
      type: "booking.status.changed",
      userId: entity.userId,
      payload: { ...adapter.notificationPayload(entity), newStatus: "cancelled", status: "cancelled" },
    }),
  )

  // Cache invalidation
  await Promise.allSettled([
    invalidateCache(`${kind}s*`).catch(() => {}),
    invalidateCache("search*").catch(() => {}),
  ])

  return updated
}

/**
 * expireHold — expire a single hold by entity id.
 * Same FOR UPDATE logic as the bulk loop. Returns true if it expired.
 */
export async function expireHold(kind: PayableKind, entityId: string): Promise<boolean> {
  const adapter = getAdapter(kind)

  return prisma.$transaction(async (tx: unknown): Promise<boolean> => {
    const t = tx as {
      $queryRawUnsafe: (q: string, ...v: unknown[]) => Promise<unknown>
      [key: string]: unknown
    }
    await t.$queryRawUnsafe(`SELECT "id" FROM "${adapter.table}" WHERE "id" = $1 FOR UPDATE`, entityId)
    const fresh = await adapter.findEntity(entityId, tx)
    if (!fresh || fresh.status !== "pending_payment") return false

    // Skip expiry while a payment is actively being processed
    const activePayment = await (t.payment as { findFirst: (a: unknown) => Promise<{ id: string } | null> }).findFirst({
      where: { bookingId: entityId, status: { in: ["pending", "processing"] } },
      select: { id: true },
    })
    if (activePayment) return false

    await (t[adapter.table.toLowerCase()] as { update: (a: unknown) => Promise<unknown> }).update({
      where: { id: entityId },
      data: { status: "expired" },
    })

    // Release held inventory
    if (adapter.releaseInventory) await adapter.releaseInventory(tx, fresh)

    return true
  })
}

/**
 * expireHolds — bulk expiry for a given kind.
 * Uses findExpiredHolds pattern (excludes bookings with active pending/processing Payment).
 */
export async function expireHolds(kind: PayableKind): Promise<number> {
  const adapter = getAdapter(kind)

  // For trip bookings, use the existing findExpiredHolds
  if (kind === "trip") {
    const { findExpiredHolds } = await import("../bookings/repository.js")
    const expired = await findExpiredHolds()
    let count = 0
    for (const b of expired) {
      if (await expireHold("trip", b.id)) count++
    }
    return count
  }

  // For other kinds, query expired pending_payment entities without active payments
  const expired = await (prisma as Record<string, unknown>)[`${kind}Booking`].findMany({
    where: {
      status: "pending_payment",
      holdExpiresAt: { lt: new Date() },
      payment: { none: { status: { in: ["pending", "processing"] } } },
    },
  }) as EntityRow[]

  let count = 0
  for (const e of expired) {
    if (await expireHold(kind, e.id)) count++
  }
  return count
}