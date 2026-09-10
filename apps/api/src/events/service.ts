import { prisma } from "@camermove/db"
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, loadEnv } from "@camermove/config"
import { invalidateCache } from "../lib/cache.js"
import { generateVerificationCode } from "../tickets/ticket.service.js"

export function eventBookingPaymentReference(eventBookingId: string): string {
  return `EVENT-${eventBookingId.slice(0, 8).toUpperCase()}`
}

async function publishEventBookingConfirmedNotification(typedEvent: Record<string, unknown>, key: string) {
  try {
    const env = loadEnv() as unknown as Record<string, unknown>
    const { createKafkaClient, EVENT_TOPICS } = await import("@camermove/events")
    const kafka = createKafkaClient(env as never)
    const producer = kafka.producer({ idempotent: true })
    await producer.connect().catch(() => {})
    await producer
      .send({
        topic: (EVENT_TOPICS as unknown as Record<string, string>).eventBookingConfirmed ?? "camermove.event.booking.confirmed",
        messages: [
          {
            key,
            value: JSON.stringify({
              id: `event-booking-confirmed-${key}`,
              type: "event.booking.confirmed",
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

async function publishEventBookingCreated(data: Record<string, unknown>) {
  try {
    const env = loadEnv() as unknown as Record<string, unknown>
    const { createKafkaClient } = await import("@camermove/events")
    const kafka = createKafkaClient(env as never)
    const producer = kafka.producer({ idempotent: true })
    await producer.connect().catch(() => {})
    await producer
      .send({
        topic: "event.booking.created" as never,
        messages: [{ key: String(data.id ?? ""), value: JSON.stringify({ type: "event.booking.created", ts: new Date().toISOString(), data }) }],
      })
      .catch(() => {})
    await producer.disconnect().catch(() => {})
  } catch {}
}

function generateTicketNumber(): string {
  return `EVT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

async function generateQrCode(verificationCode: string): Promise<{ qrCode: string; qrDataUrl: string | null }> {
  const qrCode = `CM-T:${verificationCode}`
  try {
    const QRCode = (await import("qrcode")).default
    const qrDataUrl = await QRCode.toDataURL(qrCode, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 240,
      color: { dark: "#0e9f8f", light: "#ffffff" },
    })
    return { qrCode, qrDataUrl }
  } catch {
    return { qrCode, qrDataUrl: null }
  }
}

export async function createEventBooking(input: {
  eventId: string
  ticketCategoryId: string
  userId: string
  quantity: number
  meta?: Record<string, unknown>
}) {
  if (input.quantity < 1 || input.quantity > 10) {
    throw new BadRequestError("Quantité invalide (1..10)")
  }

  const verificationCode = generateVerificationCode()
  const ticketNumber = generateTicketNumber()
  const { qrCode, qrDataUrl } = await generateQrCode(verificationCode)

  const created = await prisma.$transaction(async (tx: any) => {
    const rows: Array<{ id: string; eventId: string; quantity: number; sold: number; price: number; status: string }> =
      await tx.$queryRaw`SELECT "id","eventId","quantity","sold","price","status" FROM "TicketCategory" WHERE "id"=${input.ticketCategoryId} FOR UPDATE`
    const category = rows[0]
    if (!category) throw new NotFoundError("Catégorie de billet introuvable")
    if (category.eventId !== input.eventId) {
      throw new BadRequestError("Catégorie ne correspond pas à l'événement")
    }

    // Optional: ensure event is still on_sale/limited and approved
    const eventRows: Array<{ id: string; status: string; partnerStatus: string }> = await tx.$queryRaw`SELECT "id","status","partnerStatus" FROM "Event" WHERE "id"=${input.eventId} FOR UPDATE`
    const event = eventRows[0]
    if (!event) throw new NotFoundError("Événement introuvable")

    const available = category.quantity - category.sold
    if (available < input.quantity) {
      throw new ConflictError("Quantité insuffisante")
    }

    const totalAmount = category.price * input.quantity

    const booking = await tx.eventBooking.create({
      data: {
        eventId: input.eventId,
        ticketCategoryId: input.ticketCategoryId,
        userId: input.userId,
        quantity: input.quantity,
        totalAmount,
        ticketNumber,
        qrCode,
        status: "pending_payment" as never,
      } as never,
      include: { event: true, ticketCategory: true },
    })

    await tx.ticketCategory.update({
      where: { id: input.ticketCategoryId },
      data: { sold: { increment: input.quantity } },
    })

    return { booking, totalAmount, qrDataUrl }
  })

  const booking = (created as { booking: { id: string; totalAmount: number } }).booking
  const totalAmount = (created as { totalAmount: number }).totalAmount
  const returnedQrDataUrl = (created as { qrDataUrl: string | null }).qrDataUrl

  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.userId,
        action: "event.booking.create",
        entityType: "EventBooking",
        entityId: booking.id,
        metadata: {
          eventId: input.eventId,
          ticketCategoryId: input.ticketCategoryId,
          seatCount: input.quantity,
          passengerCount: input.quantity,
          totalAmount,
          ticketNumber,
          qrCode,
          ...(input.meta ?? {}),
        } as never,
      },
    })
  } catch {}

  await publishEventBookingCreated({
    id: booking.id,
    eventId: input.eventId,
    ticketCategoryId: input.ticketCategoryId,
    userId: input.userId,
    quantity: input.quantity,
    totalAmount,
    ticketNumber,
    qrCode,
  })

  try {
    await invalidateCache("events*")
    await invalidateCache("search*")
  } catch {}

  // Attach qrDataUrl transiently for response (not persisted, no column)
  return { ...(booking as unknown as Record<string, unknown>), qrDataUrl: returnedQrDataUrl } as unknown as typeof booking & { qrDataUrl: string | null }
}

export async function verifyEventTicket(input: { code: string }) {
  const code = String(input.code ?? "").trim()
  if (!code) throw new BadRequestError("Code requis")

  // ticketNumber OR qrCode; qrCode is CM-T:verificationCode so code may be either
  const booking = await prisma.eventBooking.findFirst({
    where: {
      OR: [{ ticketNumber: code }, { qrCode: code }, { qrCode: `CM-T:${code}` }],
    } as never,
    include: { event: true, ticketCategory: true, user: { select: { id: true, email: true, firstName: true, lastName: true } } },
  })

  if (!booking) {
    // also try matching raw verification tail: find where qrCode endsWith code
    const fallback = await prisma.eventBooking.findFirst({
      where: { qrCode: { endsWith: code } } as never,
      include: { event: true, ticketCategory: true, user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    })
    if (!fallback) throw new NotFoundError("Billet événement introuvable")
    return fallback
  }

  return booking
}

export async function createEventBookingPayment(input: {
  eventBookingId: string
  userId: string
  provider: "notchpay" | "cinetpay"
  phone?: string
  email?: string
  method?: string
  meta?: Record<string, unknown>
}) {
  const eb = await prisma.eventBooking.findUnique({ where: { id: input.eventBookingId } })
  if (!eb) throw new NotFoundError("Réservation événement introuvable")
  if ((eb as unknown as { userId: string }).userId !== input.userId) {
    const { ForbiddenError } = await import("@camermove/config")
    throw new ForbiddenError("Accès refusé")
  }
  if ((eb as unknown as { status: string }).status !== "pending_payment") {
    throw new ConflictError(`Réservation non payable — statut: ${(eb as unknown as { status: string }).status}`)
  }

  const existing = await prisma.payment
    .findFirst({ where: { id: (eb as unknown as { paymentId: string | null }).paymentId ?? undefined } as never })
    .catch(() => null)
  if (existing && ["pending", "processing"].includes((existing as unknown as { status: string }).status)) {
    const authUrl = ((existing as unknown as { webhookPayload: Record<string, unknown> | null }).webhookPayload)?.authorizationUrl as string | undefined
    return { payment: existing, authorizationUrl: authUrl ?? null }
  }

  const amount = (eb as unknown as { totalAmount: number }).totalAmount
  if (input.provider === "cinetpay" && amount % 5 !== 0) throw new BadRequestError("Montant doit être multiple de 5 (XAF)")

  const env = loadEnv()
  const reference = eventBookingPaymentReference(input.eventBookingId)
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
    bookingId: input.eventBookingId,
    reference,
    amount,
    currency: "XAF",
    email: input.email,
    phone: input.phone,
    description: `CamerMove Event ${reference}`,
    callbackUrl,
    notifyUrl,
    channels: methodToChannels(input.method),
  })

  const payment = await prisma.$transaction(async (tx: any) => {
    const fresh = await tx.eventBooking.findUnique({ where: { id: input.eventBookingId } })
    if (!fresh) throw new NotFoundError("Réservation événement introuvable")
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
        webhookPayload: { ...((result.rawResponse as Record<string, unknown>) ?? {}), authorizationUrl: result.authorizationUrl, bookingReference: reference, entityKind: "event" } as never,
      },
    })
    await tx.eventBooking.update({ where: { id: input.eventBookingId }, data: { paymentId: created.id } as never })
    await tx.auditLog.create({
      data: {
        actorId: input.userId,
        action: "payment.create",
        entityType: "Payment",
        entityId: created.id,
        metadata: { eventBookingId: input.eventBookingId, provider: input.provider, amount, ip: (input.meta as Record<string, unknown> | undefined)?.ip, ua: (input.meta as Record<string, unknown> | undefined)?.userAgent } as never,
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
        messages: [{ key: (payment as { id: string }).id, value: JSON.stringify({ paymentId: (payment as { id: string }).id, eventBookingId: input.eventBookingId, provider: input.provider, amount }) }],
      })
      .catch(() => {})
    await producer.disconnect().catch(() => {})
  } catch {}

  return { payment, authorizationUrl: result.authorizationUrl }
}

/**
 * Confirm an event booking after ticket payment success (webhook / reconciliation).
 * ACID: status flip inside $transaction with SELECT ... FOR UPDATE row locks.
 * Idempotent: replay returns { confirmed: false } without re-executing, but
 * still re-publishes the typed notification event for fan-out safety.
 */
export async function confirmEventPaymentSuccess(paymentId: string, event: unknown): Promise<{ confirmed: boolean; bookingId: string }> {
  const link = (await prisma.eventBooking.findFirst({
    where: { paymentId },
    include: { event: true },
  })) as unknown as {
    id: string
    userId: string
    status: string
    totalAmount: number
    quantity: number
    ticketNumber: string | null
    event: { name: string; venue: string; startDate: Date }
  } | null
  if (!link) {
    const { NotFoundError } = await import("@camermove/config")
    throw new NotFoundError("Réservation événement introuvable pour ce paiement")
  }

  let wasNew = false
  await prisma.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT "id" FROM "EventBooking" WHERE "id"=${link.id} FOR UPDATE`
    await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id"=${paymentId} FOR UPDATE`
    const freshPayment = await tx.payment.findUnique({ where: { id: paymentId } })
    const freshBooking = await tx.eventBooking.findUnique({ where: { id: link.id } })
    if (!freshPayment || !freshBooking) return
    if (freshPayment.status === "success") return
    if (["failed", "expired", "refunded"].includes(freshPayment.status as string)) return
    if (freshBooking.status !== "pending_payment") return
    await tx.payment.update({ where: { id: paymentId }, data: { status: "success", webhookPayload: event as never } })
    await tx.eventBooking.update({ where: { id: link.id }, data: { status: "confirmed" } })
    try {
      await tx.auditLog.create({
        data: {
          actorId: "system",
          action: "payment.success",
          entityType: "Payment",
          entityId: paymentId,
          metadata: { provider: freshPayment.provider, eventBookingId: link.id, deliveryId: (event as Record<string, unknown>)?.id ?? null } as never,
        },
      })
    } catch {}
    wasNew = true
  })

  const typedEvent = {
    type: "event.booking.confirmed",
    userId: link.userId,
    payload: {
      bookingId: link.id,
      reference: link.ticketNumber,
      ticketNumber: link.ticketNumber,
      amount: link.totalAmount,
      quantity: link.quantity,
      eventName: link.event?.name,
      venue: link.event?.venue,
      startDate: link.event?.startDate instanceof Date ? link.event.startDate.toISOString().slice(0, 10) : String(link.event?.startDate),
    },
  }
  await publishEventBookingConfirmedNotification(typedEvent, link.id)
  return { confirmed: wasNew, bookingId: link.id }
}

async function publishEventStatusChanged(typedEvent: Record<string, unknown>, key: string) {
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
 * User cancellation for an event booking. Cancellable only from pending_payment —
 * a confirmed (paid) booking must go through support (409).
 * ACID: status flip + sold decrement inside $transaction with SELECT ... FOR UPDATE.
 */
export async function cancelEventBooking(id: string, actorId: string, actorRole = "traveler") {
  const eb = (await prisma.eventBooking.findUnique({ where: { id }, include: { event: true } })) as unknown as {
    id: string
    userId: string
    status: string
    totalAmount: number
    quantity: number
    ticketCategoryId: string
    ticketNumber: string | null
    event: { name: string } | null
  } | null
  if (!eb) throw new NotFoundError("Réservation événement introuvable")
  const isAdmin = actorRole === "admin" || actorRole === "super_admin"
  if (!isAdmin && eb.userId !== actorId) throw new ForbiddenError("Accès refusé")
  if (eb.status !== "pending_payment") {
    if (eb.status === "confirmed") throw new ConflictError("Réservation déjà confirmée et payée — contactez le support pour toute annulation")
    throw new ConflictError(`Réservation non annulable — statut: ${eb.status}`)
  }

  const updated = await prisma.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT "id" FROM "EventBooking" WHERE "id"=${id} FOR UPDATE`
    const fresh = await tx.eventBooking.findUnique({ where: { id } })
    if (!fresh) throw new NotFoundError("Réservation événement introuvable")
    if (fresh.status !== "pending_payment") {
      if (fresh.status === "confirmed") throw new ConflictError("Réservation déjà confirmée et payée — contactez le support pour toute annulation")
      throw new ConflictError(`Réservation non annulable — statut: ${fresh.status}`)
    }
    // Release the held tickets back to the category (mirror of create increment)
    await tx.ticketCategory.update({ where: { id: fresh.ticketCategoryId }, data: { sold: { decrement: fresh.quantity } } })
    return tx.eventBooking.update({ where: { id }, data: { status: "cancelled" } })
  })

  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action: "event.booking.cancel",
        entityType: "EventBooking",
        entityId: id,
        metadata: { userId: eb.userId, status: "cancelled", totalAmount: eb.totalAmount, quantity: eb.quantity } as never,
      },
    })
  } catch {}
  await publishEventStatusChanged(
    {
      type: "booking.status.changed",
      userId: eb.userId,
      payload: {
        bookingId: id,
        reference: eb.ticketNumber,
        ticketNumber: eb.ticketNumber ?? undefined,
        amount: eb.totalAmount,
        quantity: eb.quantity,
        serviceLabel: "Événement",
        entityLabel: eb.event?.name,
        eventName: eb.event?.name,
        newStatus: "cancelled",
        status: "cancelled",
      },
    },
    id,
  )
  return updated
}
