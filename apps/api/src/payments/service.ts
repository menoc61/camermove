import { getAppSettingsCached, prisma, Prisma } from "@camermove/db"
import { AppError, BadRequestError, ConflictError, ForbiddenError, NotFoundError, loadEnv, createLogger } from "@camermove/config"
import { findPaymentById } from "./repository.js"
import { getProvider } from "./providers/index.js"
import type { SupportedProvider } from "./providers/types.js"
import { scheduleHoldExpiry } from "@camermove/shared/queues"
import { invalidateCache } from "../lib/cache.js"
import { EVENT_TOPICS, makeEvent, publishEvent } from "@camermove/events"
import { referenceForKind } from "../booking-kernel/index.js"

const log = createLogger()

// Named model-shape aliases for dynamic Prisma model access (per-kind polymorphism).
type PaymentIdModel = { findUnique: (a: unknown) => Promise<{ paymentId: string | null } | null> }
type HoldModel = { findUnique: (a: unknown) => Promise<{ holdExpiresAt: Date | null } | null>; update: (a: unknown) => Promise<unknown> }
type EntityModel = { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> }
type UpdateModel = { update: (a: unknown) => Promise<unknown> }

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

/** Guard against a misconfigured provider before burning a transaction + network call. */
export function assertProviderConfigured(provider: SupportedProvider): void {
  const env = loadEnv() as unknown as Record<string, string | undefined>
  if (provider === "notchpay" && !env.NOTCHPAY_PUBLIC_KEY) {
    throw new AppError(503, "PAYMENT_PROVIDER_NOT_CONFIGURED", "NotchPay n'est pas configuré sur ce serveur")
  }
  if (provider === "cinetpay" && (!env.CINETPAY_APIKEY || !env.CINETPAY_SITE_ID)) {
    throw new AppError(503, "PAYMENT_PROVIDER_NOT_CONFIGURED", "CinetPay n'est pas configuré sur ce serveur")
  }
}

/** Per-kind payable amount column: trip/hotel/rental/event use totalAmount,
 *  parcel uses shippingCost, insurance uses premium. */
function amountForKind(kind: InitiatePaymentInput["kind"], entity: Record<string, unknown>): number {
  const field = kind === "parcel" ? "shippingCost" : kind === "insurance" ? "premium" : "totalAmount"
  return Number(entity[field] ?? 0)
}

/** Per-kind payable statuses. Parcel stays `registered` (paid flag is Payment.status). */
function payableStatusesForKind(kind: InitiatePaymentInput["kind"]): string[] {
  return kind === "parcel" ? ["registered"] : ["pending_payment"]
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
  // 0. Fail fast on misconfigured provider (503, before any tx/network work)
  assertProviderConfigured(input.provider)

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

  // NotchPay requires at least one of email/phone/customer — fall back to
  // the payer's account so a missing phone field is never a 422.
  let email = input.email
  let phone = input.phone
  let customerName: string | undefined
  if (!email || !phone) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, phone: true, firstName: true, lastName: true },
    })
    email = email ?? user?.email ?? undefined
    phone = phone ?? user?.phone ?? undefined
    const fullName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()
    if (fullName) customerName = fullName
  }

  const provider = getProvider(input.provider)
  const result = await provider.createPayment({
    bookingId: input.entityId,
    reference,
    amount,
    currency: "XAF",
    email,
    phone,
    customerName,
    description,
    callbackUrl,
    notifyUrl,
    channels,
    metadata: { ...(input.meta ?? {}), entityKind: input.kind, entityId: input.entityId },
  })

  // 4. Persist atomically with hold extension + dedup guard inside transaction
  const payment = await prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<{ id: string; status: string; providerRef: string | null; authorizationUrl: string | null }> => {
    // Re-check one-pending inside tx to guard race (SELECT FOR UPDATE on entity)
    await tx.$queryRawUnsafe(`SELECT "id" FROM "${getTableName(input.kind)}" WHERE "id" = $1 FOR UPDATE`, input.entityId)
    const dup = await findPendingPaymentByEntityIdInTx(tx, input.kind, input.entityId)
    if (dup) return dup

    // Create payment record
    const created = await tx.payment.create({
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
    await linkPaymentToEntity(tx, input.kind, input.entityId, created.id)

    // Extend hold if near expiry (<5 min) — only for kinds with holdExpiresAt.
    // Trip holds live on Booking (not "tripBooking").
    if (input.kind !== "parcel" && input.kind !== "insurance") {
      const modelKey = input.kind === "trip" ? "booking" : `${input.kind}Booking`
      const models = tx as unknown as Record<string, { findUnique: (a: unknown) => Promise<{ holdExpiresAt: Date | null } | null>; update: (a: unknown) => Promise<unknown> } | undefined>
      const entityFresh = await models[modelKey]?.findUnique({ where: { id: input.entityId } })
      if (entityFresh?.holdExpiresAt) {
        const nearExpiry = entityFresh.holdExpiresAt.getTime() < Date.now() + 5 * 60 * 1000
        if (nearExpiry) {
          const settings = await getAppSettingsCached().catch(() => ({ holdExpiryMinutes: 15 }))
          const mins = Number(settings.holdExpiryMinutes ?? 15)
          await models[modelKey]!.update({
            where: { id: input.entityId },
            data: { holdExpiresAt: new Date(Date.now() + mins * 60 * 1000) },
          })
          // Reschedule BullMQ job
          await scheduleHoldExpiry(input.entityId, mins * 60 * 1000).catch((e) => {
            log.error({ err: e.message, entityId: input.entityId }, "rescheduleHoldExpiry failed")
          })
        }
      }
    }

    // AuditLog
    await tx.auditLog.create({
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

    return { ...created, authorizationUrl: result.authorizationUrl }
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
  if (!payableStatusesForKind(input.kind).includes(status)) {
    throw new ConflictError(`${capitalize(input.kind)} reservation not payable — status: ${status}`)
  }

  const reference = input.kind === "trip"
    ? (entity as Record<string, unknown>).reference as string
    : referenceForKind(input.kind, input.entityId)

  const amount = amountForKind(input.kind, entity)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ConflictError(`${capitalize(input.kind)} reservation has no payable amount`)
  }
  assertCinetPayAmount(input.provider, amount)

  return { entity, reference, amount }
}

/** Find entity by ID (per-kind). Trip bookings live on Booking (there is no
 *  TripBooking model); other kinds use their *Booking tables. */
async function findEntityById(kind: string, entityId: string): Promise<Record<string, unknown> | null> {
  if (kind === "trip") {
    return prisma.booking.findUnique({ where: { id: entityId } })
  }
  if (kind === "parcel") {
    return prisma.parcel.findUnique({ where: { id: entityId } })
  }
  if (kind === "insurance") {
    return prisma.insurancePolicy.findUnique({ where: { id: entityId } })
  }
  const modelName = `${capitalize(kind)}Booking`
  const models = prisma as unknown as Record<string, EntityModel | undefined>
  return models[modelName]?.findUnique({ where: { id: entityId } }) ?? null
}

/** Find pending payment by entity ID (per-kind). Trip payments link via
 *  Payment.bookingId (Booking has no paymentId column); other kinds read
 *  the entity's paymentId. */
async function findPendingPaymentByEntityId(kind: string, entityId: string): Promise<{ id: string; status: string; providerRef: string | null; authorizationUrl: string | null; webhookPayload: unknown } | null> {
  if (kind === "trip") {
    const payment = await prisma.payment.findFirst({
      where: { bookingId: entityId, status: { in: ["pending", "processing"] as never } },
      orderBy: { createdAt: "desc" },
    })
    if (!payment) return null
    const authUrl = (payment.webhookPayload as Record<string, unknown> | null)?.authorizationUrl as string | undefined
    return { id: payment.id, status: payment.status, providerRef: payment.providerRef, authorizationUrl: authUrl ?? null, webhookPayload: payment.webhookPayload }
  }
  let paymentId: string | null = null
  if (kind === "parcel") {
    const parcel = await prisma.parcel.findUnique({ where: { id: entityId }, select: { paymentId: true } })
    paymentId = parcel?.paymentId ?? null
  } else if (kind === "insurance") {
    const policy = await prisma.insurancePolicy.findUnique({ where: { id: entityId }, select: { paymentId: true } })
    paymentId = policy?.paymentId ?? null
  } else {
    const modelName = `${capitalize(kind)}Booking`
    const entity = await (prisma as unknown as Record<string, PaymentIdModel | undefined>)[modelName]?.findUnique({
      where: { id: entityId },
      select: { paymentId: true },
    })
    paymentId = entity?.paymentId ?? null
  }

  if (!paymentId) return null

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
  if (!payment || !["pending", "processing"].includes(payment.status)) return null

  const authUrl = (payment.webhookPayload as Record<string, unknown> | null)?.authorizationUrl as string | undefined
  return { id: payment.id, status: payment.status, providerRef: payment.providerRef, authorizationUrl: authUrl ?? null, webhookPayload: payment.webhookPayload }
}

/** Find pending payment by entity ID inside transaction. */
async function findPendingPaymentByEntityIdInTx(tx: Prisma.TransactionClient, kind: string, entityId: string): Promise<{ id: string; status: string; providerRef: string | null; authorizationUrl: string | null; webhookPayload: unknown } | null> {
  if (kind === "trip") {
    const payment = await tx.payment.findFirst({
      where: { bookingId: entityId, status: { in: ["pending", "processing"] } },
      orderBy: { createdAt: "desc" },
    })
    if (!payment) return null
    const authUrl = (payment.webhookPayload as Record<string, unknown> | null)?.authorizationUrl as string | undefined
    return { id: payment.id, status: payment.status, providerRef: payment.providerRef, authorizationUrl: authUrl ?? null, webhookPayload: payment.webhookPayload }
  }
  let paymentId: string | null = null
  if (kind === "parcel") {
    const parcel = await tx.parcel.findUnique({ where: { id: entityId }, select: { paymentId: true } })
    paymentId = parcel?.paymentId ?? null
  } else if (kind === "insurance") {
    const policy = await tx.insurancePolicy.findUnique({ where: { id: entityId }, select: { paymentId: true } })
    paymentId = policy?.paymentId ?? null
  } else {
    const modelName = `${capitalize(kind)}Booking`
    const models = tx as unknown as Record<string, PaymentIdModel | undefined>
    const entity = await models[modelName]?.findUnique({
      where: { id: entityId },
      select: { paymentId: true },
    })
    paymentId = entity?.paymentId ?? null
  }

  if (!paymentId) return null

  const payment = await tx.payment.findUnique({ where: { id: paymentId } })
  if (!payment || !["pending", "processing"].includes(payment.status)) return null

  const authUrl = (payment.webhookPayload as Record<string, unknown> | null)?.authorizationUrl as string | undefined
  return { id: payment.id, status: payment.status, providerRef: payment.providerRef, authorizationUrl: authUrl ?? null, webhookPayload: payment.webhookPayload }
}

/** Get physical table name for FOR UPDATE. */
function getTableName(kind: string): string {
  if (kind === "trip") return "Booking"
  return `${capitalize(kind)}Booking`
}

/** Link payment to entity (per-kind). Trip needs no link update — the
 *  payment row itself carries bookingId (set at create). */
async function linkPaymentToEntity(tx: Prisma.TransactionClient, kind: string, entityId: string, paymentId: string): Promise<void> {
  if (kind === "trip") return
  if (kind === "parcel") {
    await tx.parcel.update({ where: { id: entityId }, data: { paymentId } as never })
  } else if (kind === "insurance") {
    await tx.insurancePolicy.update({ where: { id: entityId }, data: { paymentId } as never })
  } else {
    const modelName = `${capitalize(kind)}Booking`
    const models = tx as unknown as Record<string, UpdateModel | undefined>
    await models[modelName]?.update({ where: { id: entityId }, data: { paymentId } as never })
  }
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

export async function createInsurancePolicyPayment(input: {
  policyId: string
  userId: string
  provider: SupportedProvider
  phone?: string
  email?: string
  method?: string
  meta?: Record<string, unknown>
}) {
  const result = await initiatePayment({ kind: "insurance", entityId: input.policyId, userId: input.userId, provider: input.provider, phone: input.phone, email: input.email, method: input.method, meta: input.meta })
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