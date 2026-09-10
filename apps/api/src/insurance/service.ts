import { randomUUID } from "node:crypto"
import { getAppSettingsCached, prisma } from "@camermove/db"
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, loadEnv } from "@camermove/config"
import { invalidateCache } from "../lib/cache.js"
import { buildInsuranceWhere, countPolicies, findPolicies, findPolicyByIdForUser, type InsuranceWhereInput } from "./repository.js"

// Fallback prices (XAF per traveler). Overridable at runtime via
// AppSettings.featureFlags.insurancePricing — no redeploy needed.
export const DEFAULT_COVERAGE_PRICES: Record<string, number> = {
  basic: 2500,
  standard: 5000,
  premium: 10000,
  family: 15000,
}

export function resolveInsurancePricing(featureFlags?: Record<string, unknown> | null): Record<string, number> {
  const override = (featureFlags?.insurancePricing ?? null) as Record<string, unknown> | null
  if (!override || typeof override !== "object") return { ...DEFAULT_COVERAGE_PRICES }
  const resolved: Record<string, number> = { ...DEFAULT_COVERAGE_PRICES }
  for (const [key, value] of Object.entries(override)) {
    const n = Number(value)
    if (Number.isFinite(n) && n >= 0) resolved[key] = Math.round(n)
  }
  return resolved
}

export function calcPremium(coverageType: string, travelersCount: number, pricing?: Record<string, number>): number {
  const prices = pricing ?? DEFAULT_COVERAGE_PRICES
  const perTraveler = Number(prices[coverageType] ?? prices.basic ?? 2500)
  return Math.round(perTraveler * travelersCount)
}

// Idempotency-safe policy number: random suffix, never bare Date.now()
// (retries must not collide on a shared timestamp bucket).
export function buildPolicyNumber(userId: string): string {
  const userPart = String(userId ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase() || "XXXXXX"
  const randPart = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
  return `INS-${userPart}-${randPart}`
}

export async function getInsurancePricing(): Promise<Record<string, number>> {
  try {
    const settings = (await getAppSettingsCached()) as unknown as { featureFlags?: Record<string, unknown> }
    return resolveInsurancePricing(settings?.featureFlags ?? null)
  } catch {
    return { ...DEFAULT_COVERAGE_PRICES }
  }
}

export function insurancePaymentReference(policyId: string): string {
  return `INS-${policyId.slice(0, 8).toUpperCase()}`
}

async function publishInsuranceIssuedNotification(typedEvent: Record<string, unknown>, key: string) {
  try {
    const env = loadEnv() as unknown as Record<string, unknown>
    const { createKafkaClient, EVENT_TOPICS } = await import("@camermove/events")
    const kafka = createKafkaClient(env as never)
    const producer = kafka.producer({ idempotent: true })
    await producer.connect().catch(() => {})
    await producer
      .send({
        topic: (EVENT_TOPICS as unknown as Record<string, string>).insurancePolicyIssued ?? "camermove.insurance.policy.issued",
        messages: [
          {
            key,
            value: JSON.stringify({
              id: `insurance-policy-issued-${key}`,
              type: "insurance.policy.issued",
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

async function publishInsuranceEvent(topic: string, data: Record<string, unknown>) {
  try {
    const env = loadEnv() as unknown as Record<string, unknown>
    const { createKafkaClient } = await import("@camermove/events")
    const kafka = createKafkaClient(env as never)
    const producer = kafka.producer({ idempotent: true })
    await producer.connect().catch(() => {})
    await producer
      .send({
        topic: topic as never,
        messages: [{ key: String(data.id ?? data.policyNumber ?? ""), value: JSON.stringify({ type: topic, ts: new Date().toISOString(), data }) }],
      })
      .catch(() => {})
    await producer.disconnect().catch(() => {})
  } catch {}
}

export async function createPolicy(input: {
  userId: string
  destination: string
  startDate: string
  endDate: string
  travelersCount: number
  coverageType: string
  meta?: Record<string, unknown>
}) {
  const start = new Date(input.startDate + "T00:00:00.000Z")
  const end = new Date(input.endDate + "T00:00:00.000Z")
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new BadRequestError("Dates invalides")
  if (end.getTime() < start.getTime()) throw new BadRequestError("endDate doit être après startDate")

  const pricing = await getInsurancePricing()
  const premium = calcPremium(input.coverageType, input.travelersCount, pricing)
  const policyNumber = buildPolicyNumber(input.userId)

  const policy = await prisma.insurancePolicy.create({
    data: {
      userId: input.userId,
      providerName: "CamerMove Assurance",
      destination: input.destination,
      startDate: start,
      endDate: end,
      travelers: input.travelersCount,
      coverageType: input.coverageType as never,
      premium,
      policyNumber,
    } as never,
  })

  const created = policy as unknown as { id: string }
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.userId,
        action: "insurance.policy.create",
        entityType: "InsurancePolicy",
        entityId: created.id,
        metadata: {
          policyNumber,
          destination: input.destination,
          coverageType: input.coverageType,
          travelers: input.travelersCount,
          premium,
          ...(input.meta ?? {}),
        } as never,
      },
    })
  } catch {}

  await publishInsuranceEvent("insurance.policy.created", {
    id: created.id,
    policyNumber,
    userId: input.userId,
    destination: input.destination,
    coverageType: input.coverageType,
    premium,
  })

  try {
    await invalidateCache("insurance*")
    await invalidateCache("search*")
  } catch {}

  return policy
}

export async function listPolicies(where: InsuranceWhereInput, skip: number, take: number, orderBy?: Record<string, unknown>) {
  const [items, total] = await Promise.all([findPolicies(where, skip, take, orderBy as never), countPolicies(where)])
  return { items, total }
}

export async function getPolicy(id: string, userId: string) {
  const policy = await findPolicyByIdForUser(id, userId)
  if (!policy) throw new NotFoundError("Police d'assurance introuvable")
  return policy
}

export async function createPolicyPayment(input: {
  policyId: string
  userId: string
  provider: "notchpay" | "cinetpay"
  phone?: string
  email?: string
  method?: string
  meta?: Record<string, unknown>
}) {
  const policy = (await prisma.insurancePolicy.findUnique({ where: { id: input.policyId } })) as unknown as {
    id: string
    userId: string
    premium: number
    paymentId: string | null
  } | null
  if (!policy) throw new NotFoundError("Police d'assurance introuvable")
  if (policy.userId !== input.userId) {
    throw new ForbiddenError("Accès refusé")
  }
  const amount = policy.premium
  if (input.provider === "cinetpay" && amount % 5 !== 0) throw new BadRequestError("Montant doit être multiple de 5 (XAF)")

  const existing = await prisma.payment.findFirst({ where: { id: policy.paymentId ?? undefined } as never }).catch(() => null)
  if (existing && ["pending", "processing"].includes((existing as unknown as { status: string }).status)) {
    const authUrl = ((existing as unknown as { webhookPayload: Record<string, unknown> | null }).webhookPayload)?.authorizationUrl as string | undefined
    return { payment: existing, authorizationUrl: authUrl ?? null }
  }

  const env = loadEnv()
  const reference = insurancePaymentReference(input.policyId)
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
    bookingId: input.policyId,
    reference,
    amount,
    currency: "XAF",
    email: input.email,
    phone: input.phone,
    description: `CamerMove Insurance ${reference}`,
    callbackUrl,
    notifyUrl,
    channels: methodToChannels(input.method),
  })

  const payment = await prisma.$transaction(async (tx: unknown) => {
    const t = tx as {
      insurancePolicy: { findUnique: (a: unknown) => Promise<unknown>; update: (a: unknown) => Promise<unknown> }
      payment: { findUnique: (a: unknown) => Promise<unknown>; create: (a: unknown) => Promise<unknown> }
      auditLog: { create: (a: unknown) => Promise<unknown> }
    }
    const fresh = (await t.insurancePolicy.findUnique({ where: { id: input.policyId } })) as unknown as { paymentId: string | null } | null
    if (!fresh) throw new NotFoundError("Police d'assurance introuvable")
    if (fresh.paymentId) {
      const linked = await t.payment.findUnique({ where: { id: fresh.paymentId } }).catch(() => null)
      if (linked && ["pending", "processing"].includes((linked as { status: string }).status)) return linked
    }
    const created = await t.payment.create({
      data: {
        bookingId: null as never,
        provider: input.provider as never,
        providerRef: result.providerRef,
        amount,
        currency: "XAF",
        method: (input.method as never) ?? "mobile_money",
        status: "pending" as never,
        webhookPayload: { ...((result.rawResponse as Record<string, unknown>) ?? {}), authorizationUrl: result.authorizationUrl, bookingReference: reference, entityKind: "insurance" } as never,
      },
    })
    await t.insurancePolicy.update({ where: { id: input.policyId }, data: { paymentId: (created as { id: string }).id } as never })
    await t.auditLog.create({
      data: {
        actorId: input.userId,
        action: "payment.create",
        entityType: "Payment",
        entityId: (created as { id: string }).id,
        metadata: { policyId: input.policyId, provider: input.provider, amount, ip: (input.meta as Record<string, unknown> | undefined)?.ip, ua: (input.meta as Record<string, unknown> | undefined)?.userAgent } as never,
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
        messages: [{ key: (payment as { id: string }).id, value: JSON.stringify({ paymentId: (payment as { id: string }).id, policyId: input.policyId, provider: input.provider, amount }) }],
      })
      .catch(() => {})
    await producer.disconnect().catch(() => {})
  } catch {}

  return { payment, authorizationUrl: result.authorizationUrl }
}

/**
 * Confirm an insurance policy after premium payment success (webhook / reconciliation).
 * ACID: status flip inside $transaction with SELECT ... FOR UPDATE row locks.
 * Idempotent: replay returns { confirmed: false } without re-executing, but
 * still re-publishes the typed notification event for fan-out safety.
 */
export async function confirmInsurancePaymentSuccess(paymentId: string, event: unknown): Promise<{ confirmed: boolean; policyId: string }> {
  const link = (await prisma.insurancePolicy.findFirst({ where: { paymentId } })) as unknown as {
    id: string
    userId: string
    status: string
    premium: number
    policyNumber: string | null
    coverageType: string
    startDate: Date
    endDate: Date
  } | null
  if (!link) throw new NotFoundError("Police d'assurance introuvable pour ce paiement")

  let wasNew = false
  await prisma.$transaction(async (tx: unknown) => {
    const t = tx as {
      insurancePolicy: { findUnique: (a: unknown) => Promise<unknown>; update: (a: unknown) => Promise<unknown> }
      payment: { findUnique: (a: unknown) => Promise<unknown>; update: (a: unknown) => Promise<unknown> }
      auditLog: { create: (a: unknown) => Promise<unknown> }
    }
    await (tx as unknown as { $queryRaw: (q: TemplateStringsArray, ...v: unknown[]) => Promise<unknown> }).$queryRaw`SELECT "id" FROM "InsurancePolicy" WHERE "id"=${link.id} FOR UPDATE`
    await (tx as unknown as { $queryRaw: (q: TemplateStringsArray, ...v: unknown[]) => Promise<unknown> }).$queryRaw`SELECT "id" FROM "Payment" WHERE "id"=${paymentId} FOR UPDATE`
    const freshPayment = (await t.payment.findUnique({ where: { id: paymentId } })) as unknown as { status: string; provider: string } | null
    const freshPolicy = (await t.insurancePolicy.findUnique({ where: { id: link.id } })) as unknown as { status: string } | null
    if (!freshPayment || !freshPolicy) return
    if (freshPayment.status === "success") return
    if (["failed", "expired", "refunded"].includes(freshPayment.status as string)) return
    if (freshPolicy.status !== "pending_payment") return
    await t.payment.update({ where: { id: paymentId }, data: { status: "success", webhookPayload: event as never } })
    await t.insurancePolicy.update({ where: { id: link.id }, data: { status: "confirmed" } })
    try {
      await t.auditLog.create({
        data: {
          actorId: "system",
          action: "payment.success",
          entityType: "Payment",
          entityId: paymentId,
          metadata: { provider: freshPayment.provider, policyId: link.id, deliveryId: (event as Record<string, unknown>)?.id ?? null } as never,
        },
      })
    } catch {}
    wasNew = true
  })

  const typedEvent = {
    type: "insurance.policy.issued",
    userId: link.userId,
    payload: {
      policyId: link.id,
      policyNumber: link.policyNumber,
      reference: link.policyNumber,
      amount: link.premium,
      coverageType: link.coverageType,
      startDate: link.startDate instanceof Date ? link.startDate.toISOString().slice(0, 10) : String(link.startDate),
      endDate: link.endDate instanceof Date ? link.endDate.toISOString().slice(0, 10) : String(link.endDate),
    },
  }
  await publishInsuranceIssuedNotification(typedEvent, link.id)
  return { confirmed: wasNew, policyId: link.id }
}

async function publishInsuranceStatusChanged(typedEvent: Record<string, unknown>, key: string) {
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
 * User cancellation for an insurance policy. Cancellable only from pending_payment —
 * a confirmed (paid/issued) policy must go through support (409).
 * ACID: status flip inside $transaction with SELECT ... FOR UPDATE row lock.
 */
export async function cancelInsurancePolicy(id: string, actorId: string, actorRole = "traveler") {
  const policy = (await prisma.insurancePolicy.findUnique({ where: { id } })) as unknown as {
    id: string
    userId: string
    status: string
    premium: number
    policyNumber: string | null
    destination: string
    coverageType: string
  } | null
  if (!policy) throw new NotFoundError("Police d'assurance introuvable")
  const isAdmin = actorRole === "admin" || actorRole === "super_admin"
  if (!isAdmin && policy.userId !== actorId) throw new ForbiddenError("Accès refusé")
  if (policy.status !== "pending_payment") {
    if (policy.status === "confirmed") throw new ConflictError("Police déjà confirmée et payée — contactez le support pour toute annulation")
    throw new ConflictError(`Police non annulable — statut: ${policy.status}`)
  }

  const updated = await prisma.$transaction(async (tx: unknown) => {
    const t = tx as {
      insurancePolicy: { findUnique: (a: unknown) => Promise<unknown>; update: (a: unknown) => Promise<unknown> }
    }
    await (tx as unknown as { $queryRaw: (q: TemplateStringsArray, ...v: unknown[]) => Promise<unknown> }).$queryRaw`SELECT "id" FROM "InsurancePolicy" WHERE "id"=${id} FOR UPDATE`
    const fresh = (await t.insurancePolicy.findUnique({ where: { id } })) as unknown as { status: string } | null
    if (!fresh) throw new NotFoundError("Police d'assurance introuvable")
    if (fresh.status !== "pending_payment") {
      if (fresh.status === "confirmed") throw new ConflictError("Police déjà confirmée et payée — contactez le support pour toute annulation")
      throw new ConflictError(`Police non annulable — statut: ${fresh.status}`)
    }
    return t.insurancePolicy.update({ where: { id }, data: { status: "cancelled" } })
  })

  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action: "insurance.booking.cancel",
        entityType: "InsurancePolicy",
        entityId: id,
        metadata: { userId: policy.userId, status: "cancelled", premium: policy.premium, policyNumber: policy.policyNumber } as never,
      },
    })
  } catch {}
  await publishInsuranceStatusChanged({
    type: "booking.status.changed",
    userId: policy.userId,
    payload: {
      policyId: id,
      policyNumber: policy.policyNumber ?? undefined,
      reference: policy.policyNumber ?? undefined,
      amount: policy.premium,
      coverageType: policy.coverageType,
      destination: policy.destination,
      serviceLabel: "Assurance",
      entityLabel: policy.destination,
      newStatus: "cancelled",
      status: "cancelled",
    },
  }, id)
  return updated
}
