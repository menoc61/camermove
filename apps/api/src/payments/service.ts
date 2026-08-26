import { prisma } from "@camermove/db"
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, loadEnv } from "@camermove/config"
import { findPendingPaymentByBookingId, findPaymentById } from "./repository.js"
import { getAppSettingsCached } from "./commission.js"
import { getProvider } from "./providers/index.js"
import type { SupportedProvider } from "./providers/types.js"

function methodToChannels(method?: string): "ALL" | "MOBILE_MONEY" | "CREDIT_CARD" | "WALLET" {
  if (method === "mobile_money") return "MOBILE_MONEY"
  if (method === "card") return "CREDIT_CARD"
  if (method === "bank_transfer") return "WALLET"
  return "ALL"
}

export async function createPayment(input: {
  bookingId: string
  userId: string
  provider: SupportedProvider
  phone?: string
  email?: string
  method?: string
  meta?: Record<string, unknown>
}) {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: { trip: true, payments: true },
  })
  if (!booking) throw new NotFoundError("Réservation introuvable")
  if (booking.userId !== input.userId) throw new ForbiddenError("Accès refusé")
  if (booking.status !== "pending_payment") throw new ConflictError(`Réservation non payable — statut: ${booking.status}`)

  const existing = await findPendingPaymentByBookingId(input.bookingId)
  if (existing) {
    // Return existing without re-calling provider — one-pending guard
    const authUrl = (existing.webhookPayload as Record<string, unknown> | null)?.authorizationUrl as string | undefined
    return { payment: existing, authorizationUrl: authUrl ?? null }
  }

  const amount = booking.totalAmount
  if (input.provider === "cinetpay" && amount % 5 !== 0) {
    throw new BadRequestError("Montant doit être multiple de 5 (XAF)")
  }

  const env = loadEnv()

  const reference = booking.reference
  const description = `CamerMove ${reference}`
  const baseUrl = (env as Record<string, unknown>).API_URL as string | undefined
  const frontendUrl = (env as Record<string, unknown>).FRONTEND_URL as string | undefined
  const callbackBase = frontendUrl ?? baseUrl ?? "https://camermove.cm"
  const callbackUrl = `${String(callbackBase).replace(/\/$/, "")}/payment/callback?reference=${reference}`
  const notifyUrl = `${String(baseUrl ?? "https://camermove.cm").replace(/\/$/, "")}/api/v1/webhooks/${input.provider}`

  const channels = methodToChannels(input.method)

  const provider = getProvider(input.provider)
  const result = await provider.createPayment({
    bookingId: input.bookingId,
    reference,
    amount,
    currency: "XAF",
    email: input.email,
    phone: input.phone,
    description,
    callbackUrl,
    notifyUrl,
    channels,
  })

  // Persist atomically with hold extension + dedup guard inside transaction
  const payment = await prisma.$transaction(async (tx: any) => {
    // Re-check one-pending inside tx to guard race (SELECT FOR UPDATE on Booking)
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${input.bookingId} FOR UPDATE`
    const dup = await tx.payment.findFirst({
      where: { bookingId: input.bookingId, status: { in: ["pending", "processing"] } },
    })
    if (dup) return dup

    const created = await tx.payment.create({
      data: {
        bookingId: input.bookingId,
        provider: input.provider as never,
        providerRef: result.providerRef,
        amount,
        currency: "XAF",
        method: (input.method as never) ?? "mobile_money",
        status: "pending" as never,
        webhookPayload: { ...((result.rawResponse as Record<string, unknown>) ?? {}), authorizationUrl: result.authorizationUrl } as never,
      },
    })

    // Extend hold if near expiry (<5 min)
    const bookingFresh = await tx.booking.findUnique({ where: { id: input.bookingId } })
    if (bookingFresh?.holdExpiresAt) {
      const nearExpiry = bookingFresh.holdExpiresAt.getTime() < Date.now() + 5 * 60 * 1000
      if (nearExpiry) {
        const settings: any = await getAppSettingsCached().catch(() => ({ holdExpiryMinutes: 15 }))
        const mins = Number(settings.holdExpiryMinutes ?? 15)
        await tx.booking.update({
          where: { id: input.bookingId },
          data: { holdExpiresAt: new Date(Date.now() + mins * 60 * 1000) },
        })
      }
    }

    await tx.auditLog.create({
      data: {
        actorId: input.userId,
        action: "payment.create",
        entityType: "Payment",
        entityId: created.id,
        metadata: {
          bookingId: input.bookingId,
          provider: input.provider,
          amount,
          ip: (input.meta as Record<string, unknown> | undefined)?.ip,
          ua: (input.meta as Record<string, unknown> | undefined)?.userAgent,
        } as never,
      },
    })

    return created
  })

  // Publish Kafka event best-effort — do not block on failure
  try {
    const { createKafkaClient } = await import("@camermove/events")
    const { EVENT_TOPICS } = await import("@camermove/events")
    const kafka = createKafkaClient(env as never)
    const producer = kafka.producer({ idempotent: true })
    await producer.connect().catch(() => {})
    await producer
      .send({
        topic: EVENT_TOPICS.paymentInitiated,
        messages: [{ key: payment.id, value: JSON.stringify({ paymentId: payment.id, bookingId: input.bookingId, provider: input.provider, amount }) }],
      })
      .catch(() => {})
    await producer.disconnect().catch(() => {})
  } catch {}

  return { payment, authorizationUrl: result.authorizationUrl }
}

export async function getPaymentById(id: string, requester: { id: string; role: string }) {
  const payment = await findPaymentById(id)
  if (!payment) throw new NotFoundError("Paiement introuvable")
  const booking = (payment as unknown as { booking: { userId: string } }).booking
  const isAdmin = requester.role === "admin" || requester.role === "super_admin"
  if (!isAdmin && booking.userId !== requester.id) throw new ForbiddenError("Accès refusé")
  return payment
}

export async function listPayments(
  query: { page: number; perPage: number; status?: string; provider?: string; dateFrom?: string; dateTo?: string; q?: string; orderBy?: string },
  requester: { id: string; role: string },
) {
  const where: Record<string, unknown> = {}
  const isAdmin = requester.role === "admin" || requester.role === "super_admin"
  if (!isAdmin) {
    ;(where as Record<string, unknown>).booking = { userId: requester.id }
  }
  if (query.status) where.status = query.status
  if (query.provider) where.provider = query.provider
  if (query.dateFrom || query.dateTo) {
    const createdAt: Record<string, Date> = {}
    if (query.dateFrom) createdAt.gte = new Date(query.dateFrom)
    if (query.dateTo) createdAt.lte = new Date(query.dateTo)
    where.createdAt = createdAt
  }
  if (query.q) {
    where.OR = [{ providerRef: { contains: query.q, mode: "insensitive" } }, { booking: { reference: { contains: query.q, mode: "insensitive" } } }]
  }
  const take = query.perPage
  const skip = (query.page - 1) * take
  let orderBy: Record<string, unknown>[] | undefined
  if (query.orderBy) {
    const parts = query.orderBy.split(",").map((p) => p.trim())
    orderBy = parts.map((p) => {
      const [field, dir] = p.split(".")
      return { [field!]: dir === "desc" ? "desc" : "asc" }
    })
  } else {
    orderBy = [{ createdAt: "desc" }]
  }
  const { prisma: p } = await import("@camermove/db")
  const [data, total] = await Promise.all([
    p.payment.findMany({ where: where as never, skip, take, orderBy: orderBy as never, include: { booking: true } }),
    p.payment.count({ where: where as never }),
  ])
  return { data, total, totalPages: Math.ceil(total / take), page: query.page, perPage: take }
}
