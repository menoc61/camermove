import { getAppSettingsCached, prisma } from "@camermove/db"
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, loadEnv, createLogger } from "@camermove/config"
import { findPendingPaymentByBookingId, findPaymentById } from "./repository.js"
import { getProvider } from "./providers/index.js"
import type { SupportedProvider } from "./providers/types.js"
import { scheduleHoldExpiry } from "@camermove/shared/queues"
import { invalidateCache } from "../lib/cache.js"
import { EVENT_TOPICS, makeEvent, publishEvent } from "@camermove/events"
import { referenceForKind } from "../booking-kernel/index.js"

const log = createLogger()

/** Single source of truth for method-to-channels mapping. */
export function methodToChannels(method?: string): "ALL" | "MOBILE_MONEY" | "CREDIT_CARD" | "WALLET" {
  if (method === "mobile_money") return "MOBILE_MONEY"
  if (method === "card") return "CREDIT_CARD"
  if (method === "bank_transfer") return "WALLET"
  return "ALL"
}

/** Build callback & notify URLs from env (single source). */
export function buildPaymentUrls(provider: SupportedProvider, reference: string): { callbackUrl: string; notifyUrl: string } {
  const env = loadEnv()
  const baseUrl = env.API_URL as string | undefined
  const frontendUrl = env.FRONTEND_URL as string | undefined
  const callbackBase = frontendUrl ?? baseUrl ?? "https://camermove.cm"
  const callbackUrl = `${String(callbackBase).replace(/\/$/, "")}/payment/callback?reference=${reference}`
  const notifyUrl = `${String(baseUrl ?? "https://camermove.cm").replace(/\/$/, "")}/api/v1/webhooks/${provider}`
  return { callbackUrl, notifyUrl }
}

/** Amount guard for CinetPay (XAF must be multiple of 5). */
export function assertCinetPayAmount(provider: SupportedProvider, amount: number): void {
  if (provider === "cinetpay" && amount % 5 !== 0) {
    throw new BadRequestError("Montant doit être multiple de 5 (XAF)")
  }
}

/**
 * Single payment initiation entry point for all payable kinds.
 * Owns: methodToChannels, amount%5 guard, callback/notify URL building,
 * one-pending guard + in-tx re-check + hold extension, audit, Kafka publish.
 */
export interface InitiatePaymentInput {
  kind: "trip" | "hotel" | "rental" | "event" | "parcel" | "insurance"
  entityId: string
  userId: string
  provider: SupportedProvider
  phone?: string
  email?: string
  method?: string
  meta?: Record<string, unknown>
}

export interface InitiatePaymentResult {
  payment: { id: string; status: string; providerRef: string | null; authorizationUrl: string | null }
  authorizationUrl: string | null
}

export async function initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
  // 1. Load entity and validate
  const { entity, reference, amount } = await loadEntityAndValidate(input)

  // 2. One-pending guard (outside tx — fast path)
  const existing = await findPendingPaymentByEntityId(input.kind, input.entityId)
  if (existing) {
    const authUrl = (existing.webhookPayload as Record<string, unknown> | null)?.authorizationUrl as string | undefined
    return { payment: existing, authorizationUrl: authUrl ?? null }
  }

  // 3. Build payment request
  const { callbackUrl, notifyUrl } = buildPaymentUrls(input.provider, reference)
  const channels = methodToChannels(input.method)
  const description = `CamerMove ${reference}`

  const provider = getProvider(input.provider)
  const result = await provider.createPayment({
    bookingId: input.entityId,
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

  // 4. Persist atomically with hold extension + dedup guard inside transaction
  const payment = await prisma.$transaction(async (tx: unknown): Promise<{ id: string; status: string; providerRef: string | null; authorizationUrl: string | null }> => {
    const t = tx as Record<string, unknown>

    // Re-check one-pending inside tx to guard race (SELECT FOR UPDATE on entity)
    await t.$queryRawUnsafe(`SELECT "id" FROM "${getTableName(input.kind)}" WHERE "id" = $1 FOR UPDATE`, input.entityId)
    const dup = await findPendingPaymentByEntityIdInTx(t, input.kind, input.entityId)
    if (dup) return dup

    // Create payment record
    const created = await t.payment.create({
      data: {
        bookingId: input.kind === "trip" ? input.entityId : null,
        provider: input.provider as never,
        providerRef: result.providerRef,
        amount,
        currency: "XAF",
        method: (input.method as never) ?? "mobile_money",
        status: "pending" as never,
        webhookPayload: {
          ...((result.rawResponse as Record<string, unknown>) ?? {}),
          authorizationUrl: result.authorizationUrl,
          bookingReference: reference,
          entityKind: input.kind,
        } as never,
      },
    })

    // Link payment to entity
    await linkPaymentToEntity(t, input.kind, input.entityId, created.id)

    // Extend hold if near expiry (<5 min)
    const entityFresh = await t[`${input.kind}Booking`]?.findUnique({ where: { id: input.entityId } })
    if (entityFresh?.holdExpiresAt) {
      const nearExpiry = entityFresh.holdExpiresAt.getTime() < Date.now() + 5 * 60 * 1000
      if (nearExpiry) {
        const settings: any = await getAppSettingsCached().catch(() => ({ holdExpiryMinutes: 15 }))
        const mins = Number(settings.holdExpiryMinutes ?? 15)
        await t[`${input.kind}Booking`].update({
          where: { id: input.entityId },
          data: { holdExpiresAt: new Date(Date.now() + mins * 60 * 1000) },
        })
        // Reschedule BullMQ job
        await scheduleHoldExpiry(input.entityId, mins * 60 * 1000).catch((e) => {
          log.error({ err: e.message, entityId: input.entityId }, "rescheduleHoldExpiry failed")
        })
      }
    }

    // AuditLog
    await t.auditLog.create({
      data: {
        actorId: input.userId,
        action: "payment.create",
        entityType: "Payment",
        entityId: created.id,
        metadata: {
          bookingId: input.entityId,
          provider: input.provider,
          amount,
          ip: (input.meta as Record<string, unknown> | undefined)?.ip,
          ua: (input.meta as Record<string, unknown> | undefined)?.userAgent,
        } as never,
      },
    })

    return created
  })

  // 5. Publish Kafka event (best-effort)
  await publishEvent(
    EVENT_TOPICS.paymentInitiated,
    makeEvent("payment.initiated", payment.id, {
      type: "payment.initiated",
      userId: input.userId,
      payload: { paymentId: payment.id, entityId: input.entityId, kind: input.kind, provider: input.provider, amount },
    }),
  ).catch((e) => log.warn({ err: e.message }, "kafka publish payment.initiated failed"))

  return { payment, authorizationUrl: result.authorizationUrl }
}

/** Load entity and validate it's payable (status === pending_payment). */
async function loadEntityAndValidate(input: InitiatePaymentInput): Promise<{ entity: Record<string, unknown>; reference: string; amount: number }> {
  const entity = await findEntityById(input.kind, input.entityId)
  if (!entity) throw new NotFoundError(`${capitalize(input.kind)} reservation not found`)

  const entityUserId = (entity as Record<string, unknown>).userId as string
  if (entityUserId !== input.userId) throw new ForbiddenError("Accès refusé")

  const status = (entity as Record<string, unknown>).status as string
  if (status !== "pending_payment") {
    throw new ConflictError(`${capitalize(input.kind)} reservation not payable — status: ${status}`)
  }

  const reference = input.kind === "trip"
    ? (entity as Record<string, unknown>).reference as string
    : referenceForKind(input.kind, input.entityId)

  const amount = (entity as Record<string, unknown>).totalAmount as number
  assertCinetPayAmount(input.provider, amount)

  return { entity, reference, amount }
}

/** Find entity by ID (per-kind). */
async function findEntityById(kind: string, entityId: string): Promise<Record<string, unknown> | null> {
  const modelName = `${capitalize(kind)}Booking`
  return (prisma as Record<string, unknown>)[modelName]?.findUnique({ where: { id: entityId } }) as Promise<Record<string, unknown> | null>
}

/** Find pending payment by entity ID (per-kind). */
async function findPendingPaymentByEntityId(kind: string, entityId: string): Promise<{ id: string; status: string; providerRef: string | null; authorizationUrl: string | null; webhookPayload: unknown } | null> {
  const modelName = `${capitalize(kind)}Booking`
  const entity = await (prisma as Record<string, unknown>)[modelName]?.findUnique({
    where: { id: entityId },
    select: { paymentId: true },
  }) as { paymentId: string | null } | null

  if (!entity?.paymentId) return null

  const payment = await prisma.payment.findUnique({ where: { id: entity.paymentId } })
  if (!payment || !["pending", "processing"].includes(payment.status)) return null

  const authUrl = (payment.webhookPayload as Record<string, unknown> | null)?.authorizationUrl as string | undefined
  return { id: payment.id, status: payment.status, providerRef: payment.providerRef, authorizationUrl: authUrl ?? null, webhookPayload: payment.webhookPayload }
}

/** Find pending payment by entity ID inside transaction. */
async function findPendingPaymentByEntityIdInTx(tx: Record<string, unknown>, kind: string, entityId: string): Promise<{ id: string; status: string; providerRef: string | null; authorizationUrl: string | null; webhookPayload: unknown } | null> {
  const modelName = `${capitalize(kind)}Booking`
  const entity = await tx[modelName]?.findUnique({
    where: { id: entityId },
    select: { paymentId: true },
  }) as { paymentId: string | null } | null

  if (!entity?.paymentId) return null

  const payment = await tx.payment.findUnique({ where: { id: entity.paymentId } })
  if (!payment || !["pending", "processing"].includes(payment.status)) return null

  const authUrl = (payment.webhookPayload as Record<string, unknown> | null)?.authorizationUrl as string | undefined
  return { id: payment.id, status: payment.status, providerRef: payment.providerRef, authorizationUrl: authUrl ?? null, webhookPayload: payment.webhookPayload }
}

/** Get physical table name for FOR UPDATE. */
function getTableName(kind: string): string {
  if (kind === "trip") return "Booking"
  return `${capitalize(kind)}Booking`
}

/** Link payment to entity (per-kind). */
async function linkPaymentToEntity(tx: Record<string, unknown>, kind: string, entityId: string, paymentId: string): Promise<void> {
  const modelName = `${capitalize(kind)}Booking`
  await tx[modelName]?.update({ where: { id: entityId }, data: { paymentId } as never })
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Thin callers for backward compatibility — delegate to initiatePayment. */
export async function createTripPayment(input: {
  bookingId: string
  userId: string
  provider: SupportedProvider
  phone?: string
  email?: string
  method?: string
  meta?: Record<string, unknown>
}) {
  const result = await initiatePayment({ kind: "trip", entityId: input.bookingId, userId: input.userId, provider: input.provider, phone: input.phone, email: input.email, method: input.method, meta: input.meta })
  return { payment: result.payment, authorizationUrl: result.authorizationUrl }
}

export async function createHotelBookingPayment(input: {
  hotelBookingId: string
  userId: string
  provider: SupportedProvider
  phone?: string
  email?: string
  method?: string
  meta?: Record<string, unknown>
}) {
  const result = await initiatePayment({ kind: "hotel", entityId: input.hotelBookingId, userId: input.userId, provider: input.provider, phone: input.phone, email: input.email, method: input.method, meta: input.meta })
  return { payment: result.payment, authorizationUrl: result.authorizationUrl }
}

export async function createRentalBookingPayment(input: {
  rentalBookingId: string
  userId: string
  provider: SupportedProvider
  phone?: string
  email?: string
  method?: string
  meta?: Record<string, unknown>
}) {
  const result = await initiatePayment({ kind: "rental", entityId: input.rentalBookingId, userId: input.userId, provider: input.provider, phone: input.phone, email: input.email, method: input.method, meta: input.meta })
  return { payment: result.payment, authorizationUrl: result.authorizationUrl }
}

export async function createEventBookingPayment(input: {
  eventBookingId: string
  userId: string
  provider: SupportedProvider
  phone?: string
  email?: string
  method?: string
  meta?: Record<string, unknown>
}) {
  const result = await initiatePayment({ kind: "event", entityId: input.eventBookingId, userId: input.userId, provider: input.provider, phone: input.phone, email: input.email, method: input.method, meta: input.meta })
  return { payment: result.payment, authorizationUrl: result.authorizationUrl }
}

export async function createParcelPayment(input: {
  parcelId: string
  userId: string
  provider: SupportedProvider
  phone?: string
  email?: string
  method?: string
  meta?: Record<string, unknown>
}) {
  const result = await initiatePayment({ kind: "parcel", entityId: input.parcelId, userId: input.userId, provider: input.provider, phone: input.phone, email: input.email, method: input.method, meta: input.meta })
  return { payment: result.payment, authorizationUrl: result.authorizationUrl }
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
  return { items: data, total, totalPages: Math.ceil(total / take), page: query.page, perPage: take }
}