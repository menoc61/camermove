import { prisma } from "@camermove/db"
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, createLogger, loadEnv } from "@camermove/config"
import { invalidateCache } from "../lib/cache.js"
import { reserve, confirmPaymentSuccess, cancel, eventAdapter } from "../booking-kernel/index.js"
import { initiatePayment, createEventBookingPayment as createPayment } from "../payments/service.js"
import { generateVerificationCode } from "../tickets/ticket.service.js"

const log = createLogger()

export function eventBookingPaymentReference(eventBookingId: string): string {
  return `EVENT-${eventBookingId.slice(0, 8).toUpperCase()}`
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
  price?: number
  meta?: Record<string, unknown>
}) {
  if (input.quantity < 1 || input.quantity > 10) {
    throw new BadRequestError("Quantité invalide (1..10)")
  }

  const verificationCode = generateVerificationCode()
  const ticketNumber = generateTicketNumber()
  const { qrCode, qrDataUrl } = await generateQrCode(verificationCode)

  const result = await reserve({
    kind: "event",
    userId: input.userId,
    quantity: input.quantity,
    meta: { eventId: input.eventId, ticketCategoryId: input.ticketCategoryId, ticketNumber, qrCode, verificationCode, qrDataUrl, price: input.price ?? 5000, ...input.meta },
  })

  // Attach qrDataUrl transiently for response
  return { ...result, ticketNumber: result.meta?.ticketNumber as string | undefined, qrDataUrl: result.meta?.qrDataUrl as string | null }
}

export async function verifyEventTicket(input: { code: string }) {
  const code = String(input.code ?? "").trim()
  if (!code) throw new BadRequestError("Code requis")

  const booking = await prisma.eventBooking.findFirst({
    where: {
      OR: [{ ticketNumber: code }, { qrCode: code }, { qrCode: `CM-T:${code}` }],
    } as never,
    include: { event: true, ticketCategory: true, user: { select: { id: true, email: true, firstName: true, lastName: true } } },
  })

  if (!booking) {
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
  return createPayment({
    eventBookingId: input.eventBookingId,
    userId: input.userId,
    provider: input.provider,
    phone: input.phone,
    email: input.email,
    method: input.method,
    meta: input.meta,
  })
}

/**
 * Confirm an event booking after ticket payment success (webhook / reconciliation).
 * ACID: status flip inside $transaction with SELECT ... FOR UPDATE row locks.
 * Idempotent: replay returns { confirmed: false } without re-executing, but
 * still re-publishes the typed notification event for fan-out safety.
 */
export async function confirmEventPaymentSuccess(paymentId: string, event: unknown): Promise<{ confirmed: boolean; bookingId: string }> {
  const result = await confirmPaymentSuccess("event", paymentId, event)
  return { confirmed: result.confirmed, bookingId: result.entityId }
}

/**
 * User cancellation for an event booking. Cancellable only from pending_payment —
 * a confirmed (paid) booking must go through support (409).
 * ACID: status flip + sold decrement inside $transaction with SELECT ... FOR UPDATE.
 */
export async function cancelEventBooking(id: string, actorId: string, actorRole = "traveler") {
  const result = await cancel("event", { entityId: id, actorId, actorRole })
  return result
}

export { eventAdapter }