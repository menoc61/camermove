import { prisma, getAppSettingsCached } from "@camermove/db"
import { AppError, BadRequestError, ConflictError, ForbiddenError, NotFoundError, createLogger } from "@camermove/config"
import { invalidateCache } from "../lib/cache.js"
import { initiateEntityPayment, type PaymentProvider } from "../payments/initiate.js"
import { confirmPaymentSuccess, cancelIfPending, referenceForKind, type ConfirmPaymentAdapter, type CancelPendingAdapter, type ConfirmLink } from "../booking-kernel/index.js"

const log = createLogger()

async function getHoldExpiryMinutes(): Promise<number> {
  try {
    const s = await getAppSettingsCached()
    const v = Number((s as unknown as { holdExpiryMinutes?: unknown }).holdExpiryMinutes ?? 15)
    return Number.isFinite(v) && v > 0 ? v : 15
  } catch {}
  return 15
}

function calcNights(checkInDate: Date, checkOutDate: Date): number {
  const ms = checkOutDate.getTime() - checkInDate.getTime()
  return Math.max(1, Math.ceil(ms / 86400000))
}

export function hotelBookingReference(id: string): string {
  return referenceForKind("hotel", id)
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

  const booking = await prisma.$transaction(async (tx: any) => {
    // FOR UPDATE on HotelRoom to serialize concurrent availability checks
    const rows: Array<{ id: string; hotelId: string; quantity: number; pricePerNight: number }> = await tx.$queryRaw`
      SELECT "id","hotelId","quantity","pricePerNight" FROM "HotelRoom" WHERE "id"=${input.roomTypeId} FOR UPDATE
    `
    const room = rows[0]
    if (!room) throw new NotFoundError("Type de chambre introuvable")
    if (room.hotelId !== input.hotelId) throw new BadRequestError("Chambre invalide pour cet hôtel")

    // Overlap count: status in pending_payment,confirmed AND checkInDate < newCheckOut AND checkOutDate > newCheckIn (strict lt/gt so adjacent dates do not overlap)
    const overlapping: number = await tx.hotelBooking.count({
      where: {
        roomTypeId: input.roomTypeId,
        status: { in: ["pending_payment", "confirmed"] },
        checkInDate: { lt: input.checkOutDate },
        checkOutDate: { gt: input.checkInDate },
      },
    })
    if (overlapping >= room.quantity) {
      throw new ConflictError("Plus de disponibilité pour ces dates")
    }

    const nights = calcNights(input.checkInDate, input.checkOutDate)
    const totalAmount = room.pricePerNight * nights
    const holdExpiryMinutes = await getHoldExpiryMinutes()
    const holdExpiresAt = new Date(Date.now() + holdExpiryMinutes * 60 * 1000)

    const created = await tx.hotelBooking.create({
      data: {
        hotelId: input.hotelId,
        roomTypeId: input.roomTypeId,
        userId: input.userId,
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        guestCount: input.guestCount,
        guestNames: input.guestNames,
        specialRequests: input.specialRequests,
        totalAmount,
        status: "pending_payment" as never,
      } as never,
      include: { hotel: true, roomType: true },
    })
    return { created, holdExpiresAt, nights, totalAmount }
  })

  // Best-effort audit + kafka + cache invalidation (outside tx)
  const created = (booking as { created: Record<string, unknown>; holdExpiresAt: Date }).created as { id: string; totalAmount: number }
  const holdExpiresAt: Date = (booking as { holdExpiresAt: Date }).holdExpiresAt
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.userId,
        action: "hotel.booking.create",
        entityType: "HotelBooking",
        entityId: created.id,
        metadata: {
          hotelId: input.hotelId,
          roomTypeId: input.roomTypeId,
          guestCount: input.guestCount,
          totalAmount: created.totalAmount,
          checkInDate: input.checkInDate.toISOString(),
          checkOutDate: input.checkOutDate.toISOString(),
          ...(input.meta ?? {}),
        } as never,
      },
    })
  } catch {}
  const { publishEvent, makeDataEvent, EVENT_TOPICS } = await import("@camermove/events")
  await publishEvent(
    EVENT_TOPICS.hotelBookingCreated,
    makeDataEvent("hotel.booking.created", created.id, {
      id: created.id,
      hotelId: input.hotelId,
      roomTypeId: input.roomTypeId,
      userId: input.userId,
      checkInDate: input.checkInDate.toISOString(),
      checkOutDate: input.checkOutDate.toISOString(),
      guestCount: input.guestCount,
      totalAmount: created.totalAmount,
    }),
  )
  try {
    await invalidateCache("hotels*")
    await invalidateCache("search*")
  } catch {}

  return { ...(created as unknown as Record<string, unknown>), holdExpiresAt } as unknown as typeof created & { holdExpiresAt: Date }
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
  // Defensive input validation — every failure here is a 4xx (caller's fault),
  // not a 500. Without this, an unknown provider or a malformed method value
  // would surface as a Prisma enum error → 500.
  if (!input.hotelBookingId || typeof input.hotelBookingId !== "string") {
    throw new BadRequestError("Identifiant de réservation manquant")
  }
  if (input.provider !== "notchpay" && input.provider !== "cinetpay") {
    throw new BadRequestError(`Provider de paiement inconnu: ${String(input.provider)}`)
  }
  if (input.method && !["mobile_money", "card", "bank_transfer"].includes(input.method)) {
    throw new BadRequestError(`Méthode de paiement inconnue: ${input.method}`)
  }

  try {
    const hb = (await prisma.hotelBooking.findUnique({ where: { id: input.hotelBookingId } })) as unknown as {
      id: string
      userId: string
      status: string
      totalAmount: number
      paymentId: string | null
    } | null
    if (!hb) throw new NotFoundError("Réservation hôtel introuvable")
    if (hb.userId !== input.userId) {
      const { ForbiddenError } = await import("@camermove/config")
      throw new ForbiddenError("Accès refusé")
    }
    if (hb.status !== "pending_payment") {
      throw new ConflictError(`Réservation non payable — statut: ${hb.status}`)
    }

    return await initiateEntityPayment({
      kind: "hotel",
      entityId: input.hotelBookingId,
      userId: input.userId,
      provider: input.provider as PaymentProvider,
      amount: hb.totalAmount,
      reference: hotelBookingReference(input.hotelBookingId),
      description: `CamerMove Hotel ${hotelBookingReference(input.hotelBookingId)}`,
      phone: input.phone,
      email: input.email,
      method: input.method,
      meta: input.meta,
      notFoundMessage: "Réservation hôtel introuvable",
      findFresh: async (tx) => (tx as typeof prisma).hotelBooking.findUnique({ where: { id: input.hotelBookingId } }) as unknown as { paymentId: string | null } | null,
      linkPayment: async (tx, paymentId) => {
        await (tx as typeof prisma).hotelBooking.update({ where: { id: input.hotelBookingId }, data: { paymentId } as never })
      },
      auditEntityMeta: { hotelBookingId: input.hotelBookingId },
    })
  } catch (err) {
    // Surface 4xx errors as-is; everything else becomes a 500 with a
    // structured log line so the next payment failure is diagnosable from
    // the server log alone (without having to reproduce client-side).
    if (err instanceof AppError) throw err
    log.error({ hotelBookingId: input.hotelBookingId, userId: input.userId, provider: input.provider, method: input.method, errName: (err as Error)?.name, errMessage: (err as Error)?.message }, "hotels.payment createHotelBookingPayment failed")
    throw new AppError(500, "PAYMENT_INIT_FAILED", "Impossible d'initialiser le paiement — réessayez ou contactez le support")
  }
}

export { calcNights, getHoldExpiryMinutes }

const confirmAdapter: ConfirmPaymentAdapter = {
  kind: "hotel",
  notFoundMessage: "Réservation hôtel introuvable pour ce paiement",
  table: "HotelBooking",
  isConfirmable: (e) => e.status === "pending_payment",
  findLink: async (paymentId, tx?) => {
    const client = (tx ?? prisma) as typeof prisma
    const link = (await client.hotelBooking.findFirst({
      where: { paymentId },
      include: tx ? undefined : { hotel: true, roomType: true },
    })) as unknown as ({
      id: string
      userId: string
      status: string
      totalAmount: number
      hotel?: { name: string }
      roomType?: { name: string }
    } & ConfirmLink) | null
    return link
  },
  confirm: async (tx, entityId) => {
    await ((tx as typeof prisma).hotelBooking.update({ where: { id: entityId }, data: { status: "confirmed" } as never }))
  },
  notification: (link) => ({
    topic: "camermove.hotel.booking.confirmed" as const,
    type: "hotel.booking.confirmed",
    userId: link.userId,
    payload: {
      bookingId: link.id,
      reference: hotelBookingReference(link.id),
      amount: link.totalAmount,
      hotelName: (link as { hotel?: { name: string } }).hotel?.name,
      roomName: (link as { roomType?: { name: string } }).roomType?.name,
      checkInDate: (link as unknown as { checkInDate: Date | string }).checkInDate instanceof Date ? (link as unknown as { checkInDate: Date }).checkInDate.toISOString().slice(0, 10) : String((link as unknown as { checkInDate: Date | string }).checkInDate),
      checkOutDate: (link as unknown as { checkOutDate: Date | string }).checkOutDate instanceof Date ? (link as unknown as { checkOutDate: Date }).checkOutDate.toISOString().slice(0, 10) : String((link as unknown as { checkOutDate: Date | string }).checkOutDate),
    },
  }),
}

/**
 * Confirm a hotel booking after payment success (webhook / reconciliation).
 * ACID + idempotency ceremony lives in the booking-kernel.
 */
export async function confirmHotelPaymentSuccess(paymentId: string, event: unknown): Promise<{ confirmed: boolean; bookingId: string }> {
  const { entityId, confirmed } = await confirmPaymentSuccess(confirmAdapter, paymentId, event)
  return { confirmed, bookingId: entityId }
}

const cancelAdapter: CancelPendingAdapter<{ id: string; userId: string; status: string; totalAmount: number; hotel: { name: string } | null; roomType: { name: string } | null }> = {
  notFoundMessage: "Réservation hôtel introuvable",
  table: "HotelBooking",
  find: async (id) =>
    (await prisma.hotelBooking.findUnique({ where: { id }, include: { hotel: true, roomType: true } })) as unknown as { id: string; userId: string; status: string; totalAmount: number; hotel: { name: string } | null; roomType: { name: string } | null } | null,
  findFresh: async (tx, id) =>
    (await (tx as typeof prisma).hotelBooking.findUnique({ where: { id } })) as unknown as { id: string; userId: string; status: string; totalAmount: number } | null,
  assertCancellable: (entity) => {
    if (entity.status !== "pending_payment") {
      if (entity.status === "confirmed") throw new ConflictError("Réservation déjà confirmée et payée — contactez le support pour toute annulation")
      throw new ConflictError(`Réservation non annulable — statut: ${entity.status}`)
    }
  },
  cancel: async (tx, entity) => (tx as typeof prisma).hotelBooking.update({ where: { id: entity.id }, data: { status: "cancelled" } as never }),
  auditAction: "hotel.booking.cancel",
  auditEntityType: "HotelBooking",
  auditExtra: () => ({}),
  notification: (entity) => ({
    topic: "camermove.booking.status.changed" as const,
    type: "booking.status.changed",
    userId: entity.userId,
    payload: {
      bookingId: entity.id,
      reference: hotelBookingReference(entity.id),
      amount: entity.totalAmount,
      serviceLabel: "Hôtel",
      entityLabel: entity.hotel?.name,
      roomName: entity.roomType?.name,
      newStatus: "cancelled",
      status: "cancelled",
    },
  }),
}

/**
 * User cancellation for a hotel booking. Cancellable only from pending_payment —
 * a confirmed (paid) booking must go through support (409).
 * No inventory to restore: availability is computed via overlap count over
 * pending_payment/confirmed only, so flipping to cancelled frees the room.
 * ACID ceremony lives in the booking-kernel.
 */
export async function cancelHotelBooking(id: string, actorId: string, actorRole = "traveler") {
  return cancelIfPending(cancelAdapter, id, actorId, actorRole)
}
