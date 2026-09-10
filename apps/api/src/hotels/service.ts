import { prisma } from "@camermove/db"
import { getAppSettingsCached } from "@camermove/db"
import { AppError, ConflictError, NotFoundError, BadRequestError, ForbiddenError, loadEnv } from "@camermove/config"
import { invalidateCache } from "../lib/cache.js"

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

async function publishHotelBookingCreated(data: Record<string, unknown>) {
  try {
    const env = loadEnv() as unknown as Record<string, unknown>
    const { createKafkaClient } = await import("@camermove/events")
    const kafka = createKafkaClient(env as never)
    const producer = kafka.producer({ idempotent: true })
    await producer.connect().catch(() => {})
    await producer
      .send({
        topic: "hotel.booking.created" as never,
        messages: [{ key: String(data.id ?? ""), value: JSON.stringify({ type: "hotel.booking.created", ts: new Date().toISOString(), data }) }],
      })
      .catch(() => {})
    await producer.disconnect().catch(() => {})
  } catch {}
}

export function hotelBookingReference(id: string): string {
  return `HOTEL-${id.slice(0, 8).toUpperCase()}`
}

async function publishHotelConfirmedNotification(typedEvent: Record<string, unknown>, key: string) {
  try {
    const env = loadEnv() as unknown as Record<string, unknown>
    const { createKafkaClient, EVENT_TOPICS } = await import("@camermove/events")
    const kafka = createKafkaClient(env as never)
    const producer = kafka.producer({ idempotent: true })
    await producer.connect().catch(() => {})
    await producer
      .send({
        topic: (EVENT_TOPICS as unknown as Record<string, string>).hotelBookingConfirmed ?? "camermove.hotel.booking.confirmed",
        messages: [
          {
            key,
            value: JSON.stringify({
              id: `hotel-booking-confirmed-${key}`,
              type: "hotel.booking.confirmed",
              ts: new Date().toISOString(),
              aggregateId: key,
              data: typedEvent,
            }),
          },
        ],
      })
      .catch(() => {})
    await producer.disconnect().catch(() => {})
  } catch {}
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
  await publishHotelBookingCreated({
    id: created.id,
    hotelId: input.hotelId,
    roomTypeId: input.roomTypeId,
    userId: input.userId,
    checkInDate: input.checkInDate.toISOString(),
    checkOutDate: input.checkOutDate.toISOString(),
    guestCount: input.guestCount,
    totalAmount: created.totalAmount,
  })
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
  // Guard against a misconfigured provider (missing env keys) before we burn
  // a transaction opening + a network round-trip.
  const envCheck = loadEnv() as unknown as Record<string, string | undefined>
  if (input.provider === "notchpay" && !envCheck.NOTCHPAY_PUBLIC_KEY) {
    throw new AppError(503, "PAYMENT_PROVIDER_NOT_CONFIGURED", "NotchPay n'est pas configuré sur ce serveur")
  }
  if (input.provider === "cinetpay" && (!envCheck.CINETPAY_APIKEY || !envCheck.CINETPAY_SITE_ID)) {
    throw new AppError(503, "PAYMENT_PROVIDER_NOT_CONFIGURED", "CinetPay n'est pas configuré sur ce serveur")
  }

  try {
  const hb = await prisma.hotelBooking.findUnique({ where: { id: input.hotelBookingId } })
  if (!hb) throw new NotFoundError("Réservation hôtel introuvable")
  if ((hb as unknown as { userId: string }).userId !== input.userId) {
    const { ForbiddenError } = await import("@camermove/config")
    throw new ForbiddenError("Accès refusé")
  }
  if ((hb as unknown as { status: string }).status !== "pending_payment") {
    throw new ConflictError(`Réservation non payable — statut: ${(hb as unknown as { status: string }).status}`)
  }
  const existing = await prisma.payment.findFirst({
    where: { id: (hb as unknown as { paymentId: string | null }).paymentId ?? undefined } as never,
  }).catch(() => null)
  // one-pending guard via paymentId linked payment check (if already linked and pending)
  if (existing && ["pending", "processing"].includes((existing as unknown as { status: string }).status)) {
    const authUrl = ((existing as unknown as { webhookPayload: Record<string, unknown> | null }).webhookPayload)?.authorizationUrl as string | undefined
    return { payment: existing, authorizationUrl: authUrl ?? null }
  }

  const amount = (hb as unknown as { totalAmount: number }).totalAmount
  if (input.provider === "cinetpay" && amount % 5 !== 0) throw new BadRequestError("Montant doit être multiple de 5 (XAF)")

  const env = loadEnv()
  const reference = hotelBookingReference(input.hotelBookingId)
  const baseUrl = env.API_URL as string | undefined
  const frontendUrl = env.FRONTEND_URL as string | undefined
  const callbackBase = (frontendUrl ?? baseUrl ?? "https://camermove.cm") as string
  const callbackUrl = `${String(callbackBase).replace(/\/$/, "")}/payment/callback?reference=${reference}`
  const notifyUrl = `${String((baseUrl ?? "https://camermove.cm") as string).replace(/\/$/, "")}/api/v1/webhooks/${input.provider}`
  const methodToChannels = (m?: string): "ALL" | "MOBILE_MONEY" | "CREDIT_CARD" | "WALLET" => {
    if (m === "mobile_money") return "MOBILE_MONEY"
    if (m === "card") return "CREDIT_CARD"
    if (m === "bank_transfer") return "WALLET"
    return "ALL"
  }
  const { getProvider } = await import("../payments/providers/index.js")
  const provider = getProvider(input.provider as never)
  const result = await provider.createPayment({
    bookingId: input.hotelBookingId,
    reference,
    amount,
    currency: "XAF",
    email: input.email,
    phone: input.phone,
    description: `CamerMove Hotel ${reference}`,
    callbackUrl,
    notifyUrl,
    channels: methodToChannels(input.method),
  })

  const payment = await prisma.$transaction(async (tx: any) => {
    // re-check duplicate inside tx
    const fresh = await tx.hotelBooking.findUnique({ where: { id: input.hotelBookingId } })
    if (!fresh) throw new NotFoundError("Réservation hôtel introuvable")
    if (fresh.paymentId) {
      const linked = await tx.payment.findUnique({ where: { id: fresh.paymentId } }).catch(() => null)
      if (linked && ["pending", "processing"].includes((linked as { status: string }).status)) return linked
    }
    const created = await tx.payment.create({
      data: {
        bookingId: null as never,
        provider: input.provider as never,
        providerRef: result.providerRef,
        amount,
        currency: "XAF",
        method: (input.method as never) ?? "mobile_money",
        status: "pending" as never,
        webhookPayload: { ...((result.rawResponse as Record<string, unknown>) ?? {}), authorizationUrl: result.authorizationUrl, bookingReference: reference, entityKind: "hotel" } as never,
      },
    })
    await tx.hotelBooking.update({ where: { id: input.hotelBookingId }, data: { paymentId: created.id } as never })
    await tx.auditLog.create({
      data: {
        actorId: input.userId,
        action: "payment.create",
        entityType: "Payment",
        entityId: created.id,
        metadata: { hotelBookingId: input.hotelBookingId, provider: input.provider, amount, ip: (input.meta as Record<string, unknown> | undefined)?.ip, ua: (input.meta as Record<string, unknown> | undefined)?.userAgent } as never,
      },
    })
    return created
  })

  try {
    const { createKafkaClient } = await import("@camermove/events")
    const { EVENT_TOPICS } = await import("@camermove/events")
    const kafka = createKafkaClient(env as never)
    const producer = kafka.producer({ idempotent: true })
    await producer.connect().catch(() => {})
    await producer
      .send({
        topic: (EVENT_TOPICS as unknown as Record<string, string>).paymentInitiated ?? "camermove.payment.initiated",
        messages: [{ key: (payment as { id: string }).id, value: JSON.stringify({ paymentId: (payment as { id: string }).id, hotelBookingId: input.hotelBookingId, provider: input.provider, amount }) }],
      })
      .catch(() => {})
    await producer.disconnect().catch(() => {})
  } catch {}

  return { payment, authorizationUrl: result.authorizationUrl }
  } catch (err) {
    // Surface 4xx errors as-is; everything else becomes a 500 with a
    // structured log line so the next payment failure is diagnosable from
    // the server log alone (without having to reproduce client-side).
    if (err instanceof AppError) throw err
    console.error("[hotels.payment] createHotelBookingPayment failed", {
      hotelBookingId: input.hotelBookingId,
      userId: input.userId,
      provider: input.provider,
      method: input.method,
      errName: (err as Error)?.name,
      errMessage: (err as Error)?.message,
    })
    throw new AppError(500, "PAYMENT_INIT_FAILED", "Impossible d'initialiser le paiement — réessayez ou contactez le support")
  }
}

export { calcNights, getHoldExpiryMinutes }

/**
 * Confirm a hotel booking after payment success (webhook / reconciliation).
 * ACID: status flip inside $transaction with SELECT ... FOR UPDATE row locks.
 * Idempotent: replay returns { confirmed: false } without re-executing, but
 * still re-publishes the typed notification event for fan-out safety.
 */
export async function confirmHotelPaymentSuccess(paymentId: string, event: unknown): Promise<{ confirmed: boolean; bookingId: string }> {
  const link = (await prisma.hotelBooking.findFirst({
    where: { paymentId },
    include: { hotel: true, roomType: true },
  })) as unknown as {
    id: string
    userId: string
    status: string
    totalAmount: number
    checkInDate: Date
    checkOutDate: Date
    hotel: { name: string }
    roomType: { name: string }
  } | null
  if (!link) throw new NotFoundError("Réservation hôtel introuvable pour ce paiement")

  let wasNew = false
  await prisma.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT "id" FROM "HotelBooking" WHERE "id"=${link.id} FOR UPDATE`
    await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id"=${paymentId} FOR UPDATE`
    const freshPayment = await tx.payment.findUnique({ where: { id: paymentId } })
    const freshBooking = await tx.hotelBooking.findUnique({ where: { id: link.id } })
    if (!freshPayment || !freshBooking) return
    if (freshPayment.status === "success") return
    if (["failed", "expired", "refunded"].includes(freshPayment.status as string)) return
    if (freshBooking.status !== "pending_payment") return
    await tx.payment.update({ where: { id: paymentId }, data: { status: "success", webhookPayload: event as never } })
    await tx.hotelBooking.update({ where: { id: link.id }, data: { status: "confirmed" } })
    try {
      await tx.auditLog.create({
        data: {
          actorId: "system",
          action: "payment.success",
          entityType: "Payment",
          entityId: paymentId,
          metadata: { provider: freshPayment.provider, hotelBookingId: link.id, deliveryId: (event as Record<string, unknown>)?.id ?? null } as never,
        },
      })
    } catch {}
    wasNew = true
  })

  const typedEvent = {
    type: "hotel.booking.confirmed",
    userId: link.userId,
    payload: {
      bookingId: link.id,
      reference: hotelBookingReference(link.id),
      amount: link.totalAmount,
      hotelName: link.hotel?.name,
      roomName: link.roomType?.name,
      checkInDate: link.checkInDate instanceof Date ? link.checkInDate.toISOString().slice(0, 10) : String(link.checkInDate),
      checkOutDate: link.checkOutDate instanceof Date ? link.checkOutDate.toISOString().slice(0, 10) : String(link.checkOutDate),
    },
  }
  await publishHotelConfirmedNotification(typedEvent, link.id)
  return { confirmed: wasNew, bookingId: link.id }
}

async function publishHotelStatusChanged(typedEvent: Record<string, unknown>, key: string) {
  try {
    const env = loadEnv() as unknown as Record<string, unknown>
    const { createKafkaClient, EVENT_TOPICS } = await import("@camermove/events")
    const kafka = createKafkaClient(env as never)
    const producer = kafka.producer({ idempotent: true })
    await producer.connect().catch(() => {})
    await producer
      .send({
        topic: (EVENT_TOPICS as unknown as Record<string, string>).bookingStatusChanged ?? "camermove.booking.status.changed",
        messages: [
          {
            key,
            value: JSON.stringify({
              id: `booking-status-changed-${key}`,
              type: "booking.status.changed",
              ts: new Date().toISOString(),
              aggregateId: key,
              data: typedEvent,
            }),
          },
        ],
      })
      .catch(() => {})
    await producer.disconnect().catch(() => {})
  } catch {}
}

/**
 * User cancellation for a hotel booking. Cancellable only from pending_payment —
 * a confirmed (paid) booking must go through support (409).
 * ACID: status flip inside $transaction with SELECT ... FOR UPDATE row lock.
 * No inventory to restore: availability is computed via overlap count over
 * pending_payment/confirmed only, so flipping to cancelled frees the room.
 */
export async function cancelHotelBooking(id: string, actorId: string, actorRole = "traveler") {
  const hb = (await prisma.hotelBooking.findUnique({ where: { id }, include: { hotel: true, roomType: true } })) as unknown as {
    id: string
    userId: string
    status: string
    totalAmount: number
    hotel: { name: string } | null
    roomType: { name: string } | null
  } | null
  if (!hb) throw new NotFoundError("Réservation hôtel introuvable")
  const isAdmin = actorRole === "admin" || actorRole === "super_admin"
  if (!isAdmin && hb.userId !== actorId) throw new ForbiddenError("Accès refusé")
  if (hb.status !== "pending_payment") {
    if (hb.status === "confirmed") throw new ConflictError("Réservation déjà confirmée et payée — contactez le support pour toute annulation")
    throw new ConflictError(`Réservation non annulable — statut: ${hb.status}`)
  }

  const updated = await prisma.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT "id" FROM "HotelBooking" WHERE "id"=${id} FOR UPDATE`
    const fresh = await tx.hotelBooking.findUnique({ where: { id } })
    if (!fresh) throw new NotFoundError("Réservation hôtel introuvable")
    if (fresh.status !== "pending_payment") {
      if (fresh.status === "confirmed") throw new ConflictError("Réservation déjà confirmée et payée — contactez le support pour toute annulation")
      throw new ConflictError(`Réservation non annulable — statut: ${fresh.status}`)
    }
    return tx.hotelBooking.update({ where: { id }, data: { status: "cancelled" } })
  })

  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action: "hotel.booking.cancel",
        entityType: "HotelBooking",
        entityId: id,
        metadata: { userId: hb.userId, status: "cancelled", totalAmount: hb.totalAmount } as never,
      },
    })
  } catch {}
  await publishHotelStatusChanged(
    {
      type: "booking.status.changed",
      userId: hb.userId,
      payload: {
        bookingId: id,
        reference: hotelBookingReference(id),
        amount: hb.totalAmount,
        serviceLabel: "Hôtel",
        entityLabel: hb.hotel?.name,
        roomName: hb.roomType?.name,
        newStatus: "cancelled",
        status: "cancelled",
      },
    },
    id,
  )
  return updated
}
