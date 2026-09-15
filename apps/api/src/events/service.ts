import { prisma } from "@camermove/db"
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@camermove/config"
import { invalidateCache } from "../lib/cache.js"
import { generateVerificationCode } from "../tickets/ticket.service.js"
import { initiateEntityPayment, type PaymentProvider } from "../payments/initiate.js"
import { confirmPaymentSuccess, cancelIfPending, referenceForKind, type ConfirmPaymentAdapter, type CancelPendingAdapter, type ConfirmLink } from "../booking-kernel/index.js"

export function eventBookingPaymentReference(eventBookingId: string): string {
  return referenceForKind("event", eventBookingId)
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

  const { publishEvent, makeDataEvent, EVENT_TOPICS } = await import("@camermove/events")
  await publishEvent(
    EVENT_TOPICS.eventBookingCreated,
    makeDataEvent("event.booking.created", booking.id, {
      id: booking.id,
      eventId: input.eventId,
      ticketCategoryId: input.ticketCategoryId,
      userId: input.userId,
      quantity: input.quantity,
      totalAmount,
      ticketNumber,
      qrCode,
    }),
  )

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
  const eb = (await prisma.eventBooking.findUnique({ where: { id: input.eventBookingId } })) as unknown as {
    id: string
    userId: string
    status: string
    totalAmount: number
  } | null
  if (!eb) throw new NotFoundError("Réservation événement introuvable")
  if (eb.userId !== input.userId) {
    const { ForbiddenError } = await import("@camermove/config")
    throw new ForbiddenError("Accès refusé")
  }
  if (eb.status !== "pending_payment") {
    throw new ConflictError(`Réservation non payable — statut: ${eb.status}`)
  }

  return initiateEntityPayment({
    kind: "event",
    entityId: input.eventBookingId,
    userId: input.userId,
    provider: input.provider as PaymentProvider,
    amount: eb.totalAmount,
    reference: eventBookingPaymentReference(input.eventBookingId),
    description: `CamerMove Event ${eventBookingPaymentReference(input.eventBookingId)}`,
    phone: input.phone,
    email: input.email,
    method: input.method,
    meta: input.meta,
    notFoundMessage: "Réservation événement introuvable",
    findFresh: async (tx) => (tx as typeof prisma).eventBooking.findUnique({ where: { id: input.eventBookingId } }) as unknown as { paymentId: string | null } | null,
    linkPayment: async (tx, paymentId) => {
      await (tx as typeof prisma).eventBooking.update({ where: { id: input.eventBookingId }, data: { paymentId } as never })
    },
    auditEntityMeta: { eventBookingId: input.eventBookingId },
  })
}

const confirmAdapter: ConfirmPaymentAdapter = {
  kind: "event",
  notFoundMessage: "Réservation événement introuvable pour ce paiement",
  table: "EventBooking",
  isConfirmable: (e) => e.status === "pending_payment",
  findLink: async (paymentId, tx?) => {
    const client = (tx ?? prisma) as typeof prisma
    return (await client.eventBooking.findFirst({ where: { paymentId }, include: tx ? undefined : { event: true } })) as unknown as (ConfirmLink & {
      quantity: number
      ticketNumber: string | null
      event?: { name: string; venue: string; startDate: Date }
    }) | null
  },
  confirm: async (tx, entityId) => {
    await ((tx as typeof prisma).eventBooking.update({ where: { id: entityId }, data: { status: "confirmed" } as never }))
  },
  notification: (link) => {
    const withEvent = link as unknown as { quantity: number; ticketNumber: string | null; event?: { name: string; venue: string; startDate: Date } }
    return {
      topic: "camermove.event.booking.confirmed" as const,
      type: "event.booking.confirmed",
      userId: link.userId,
      payload: {
        bookingId: link.id,
        reference: withEvent.ticketNumber,
        ticketNumber: withEvent.ticketNumber,
        amount: link.totalAmount,
        quantity: withEvent.quantity,
        eventName: withEvent.event?.name,
        venue: withEvent.event?.venue,
        startDate: withEvent.event?.startDate instanceof Date ? withEvent.event.startDate.toISOString().slice(0, 10) : String(withEvent.event?.startDate),
      },
    }
  },
}

/**
 * Confirm an event booking after ticket payment success (webhook / reconciliation).
 * ACID + idempotency ceremony lives in the booking-kernel.
 */
export async function confirmEventPaymentSuccess(paymentId: string, event: unknown): Promise<{ confirmed: boolean; bookingId: string }> {
  const { entityId, confirmed } = await confirmPaymentSuccess(confirmAdapter, paymentId, event)
  return { confirmed, bookingId: entityId }
}

const cancelAdapter: CancelPendingAdapter<{ id: string; userId: string; status: string; totalAmount: number; quantity: number; ticketCategoryId: string; ticketNumber: string | null; event: { name: string } | null }> = {
  notFoundMessage: "Réservation événement introuvable",
  table: "EventBooking",
  find: async (id) =>
    (await prisma.eventBooking.findUnique({ where: { id }, include: { event: true } })) as unknown as { id: string; userId: string; status: string; totalAmount: number; quantity: number; ticketCategoryId: string; ticketNumber: string | null; event: { name: string } | null } | null,
  findFresh: async (tx, id) =>
    (await (tx as typeof prisma).eventBooking.findUnique({ where: { id } })) as unknown as { id: string; userId: string; status: string; totalAmount: number; quantity: number; ticketCategoryId: string } | null,
  assertCancellable: (entity) => {
    if (entity.status !== "pending_payment") {
      if (entity.status === "confirmed") throw new ConflictError("Réservation déjà confirmée et payée — contactez le support pour toute annulation")
      throw new ConflictError(`Réservation non annulable — statut: ${entity.status}`)
    }
  },
  releaseInventory: async (tx, entity) => {
    // Release the held tickets back to the category (mirror of create increment)
    await (tx as typeof prisma).ticketCategory.update({ where: { id: entity.ticketCategoryId }, data: { sold: { decrement: entity.quantity } } as never })
  },
  cancel: async (tx, entity) => (tx as typeof prisma).eventBooking.update({ where: { id: entity.id }, data: { status: "cancelled" } as never }),
  auditAction: "event.booking.cancel",
  auditEntityType: "EventBooking",
  auditExtra: (entity) => ({ quantity: entity.quantity }),
  notification: (entity) => ({
    topic: "camermove.booking.status.changed" as const,
    type: "booking.status.changed",
    userId: entity.userId,
    payload: {
      bookingId: entity.id,
      reference: entity.ticketNumber,
      ticketNumber: entity.ticketNumber ?? undefined,
      amount: entity.totalAmount,
      quantity: entity.quantity,
      serviceLabel: "Événement",
      entityLabel: entity.event?.name,
      eventName: entity.event?.name,
      newStatus: "cancelled",
      status: "cancelled",
    },
  }),
}

/**
 * User cancellation for an event booking. Cancellable only from pending_payment —
 * a confirmed (paid) booking must go through support (409).
 * ACID ceremony lives in the booking-kernel.
 */
export async function cancelEventBooking(id: string, actorId: string, actorRole = "traveler") {
  return cancelIfPending(cancelAdapter, id, actorId, actorRole)
}
