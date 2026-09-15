import { randomUUID } from "node:crypto"
import { getAppSettingsCached, prisma } from "@camermove/db"
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@camermove/config"
import { invalidateCache } from "../lib/cache.js"
import { buildInsuranceWhere, countPolicies, findPolicies, findPolicyByIdForUser, type InsuranceWhereInput } from "./repository.js"
import { initiateEntityPayment, type PaymentProvider } from "../payments/initiate.js"
import { confirmPaymentSuccess, cancelIfPending, referenceForKind, type ConfirmPaymentAdapter, type CancelPendingAdapter, type ConfirmLink } from "../booking-kernel/index.js"

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
  return referenceForKind("insurance", policyId)
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

  const { publishEvent, makeDataEvent, EVENT_TOPICS } = await import("@camermove/events")
  await publishEvent(
    EVENT_TOPICS.insurancePolicyCreated,
    makeDataEvent("insurance.policy.created", created.id, {
      id: created.id,
      policyNumber,
      userId: input.userId,
      destination: input.destination,
      coverageType: input.coverageType,
      premium,
    }),
  )

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
  } | null
  if (!policy) throw new NotFoundError("Police d'assurance introuvable")
  if (policy.userId !== input.userId) {
    throw new ForbiddenError("Accès refusé")
  }

  return initiateEntityPayment({
    kind: "insurance",
    entityId: input.policyId,
    userId: input.userId,
    provider: input.provider as PaymentProvider,
    amount: policy.premium,
    reference: insurancePaymentReference(input.policyId),
    description: `CamerMove Insurance ${insurancePaymentReference(input.policyId)}`,
    phone: input.phone,
    email: input.email,
    method: input.method,
    meta: input.meta,
    notFoundMessage: "Police d'assurance introuvable",
    findFresh: async (tx) => (tx as typeof prisma).insurancePolicy.findUnique({ where: { id: input.policyId } }) as unknown as { paymentId: string | null } | null,
    linkPayment: async (tx, paymentId) => {
      await (tx as typeof prisma).insurancePolicy.update({ where: { id: input.policyId }, data: { paymentId } as never })
    },
    auditEntityMeta: { policyId: input.policyId },
  })
}

const confirmAdapter: ConfirmPaymentAdapter = {
  kind: "insurance",
  notFoundMessage: "Police d'assurance introuvable pour ce paiement",
  table: "InsurancePolicy",
  isConfirmable: (e) => e.status === "pending_payment",
  findLink: async (paymentId, tx?) => {
    const client = (tx ?? prisma) as typeof prisma
    return (await client.insurancePolicy.findFirst({ where: { paymentId } })) as unknown as (ConfirmLink & {
      policyNumber: string | null
      coverageType: string
      startDate: Date
      endDate: Date
    }) | null
  },
  confirm: async (tx, entityId) => {
    await ((tx as typeof prisma).insurancePolicy.update({ where: { id: entityId }, data: { status: "confirmed" } as never }))
  },
  notification: (link) => {
    const withPolicy = link as unknown as { policyNumber: string | null; coverageType: string; startDate: Date; endDate: Date }
    return {
      topic: "camermove.insurance.policy.issued" as const,
      type: "insurance.policy.issued",
      userId: link.userId,
      payload: {
        policyId: link.id,
        policyNumber: withPolicy.policyNumber,
        reference: withPolicy.policyNumber,
        amount: link.totalAmount,
        coverageType: withPolicy.coverageType,
        startDate: withPolicy.startDate instanceof Date ? withPolicy.startDate.toISOString().slice(0, 10) : String(withPolicy.startDate),
        endDate: withPolicy.endDate instanceof Date ? withPolicy.endDate.toISOString().slice(0, 10) : String(withPolicy.endDate),
      },
    }
  },
}

/**
 * Confirm an insurance policy after premium payment success (webhook / reconciliation).
 * ACID + idempotency ceremony lives in the booking-kernel.
 */
export async function confirmInsurancePaymentSuccess(paymentId: string, event: unknown): Promise<{ confirmed: boolean; policyId: string }> {
  const { entityId, confirmed } = await confirmPaymentSuccess(confirmAdapter, paymentId, event)
  return { confirmed, policyId: entityId }
}

const cancelAdapter: CancelPendingAdapter<{ id: string; userId: string; status: string; totalAmount: number; premium: number; policyNumber: string | null; destination: string; coverageType: string }> = {
  notFoundMessage: "Police d'assurance introuvable",
  table: "InsurancePolicy",
  find: async (id) => {
    const row = (await prisma.insurancePolicy.findUnique({ where: { id } })) as unknown as { id: string; userId: string; status: string; premium: number; policyNumber: string | null; destination: string; coverageType: string } | null
    return row ? { ...row, totalAmount: row.premium } : null
  },
  findFresh: async (tx, id) => {
    const row = (await (tx as typeof prisma).insurancePolicy.findUnique({ where: { id } })) as unknown as { id: string; userId: string; status: string; premium: number } | null
    return row ? { ...row, totalAmount: row.premium } : null
  },
  assertCancellable: (entity) => {
    if (entity.status !== "pending_payment") {
      if (entity.status === "confirmed") throw new ConflictError("Police déjà confirmée et payée — contactez le support pour toute annulation")
      throw new ConflictError(`Police non annulable — statut: ${entity.status}`)
    }
  },
  cancel: async (tx, entity) => (tx as typeof prisma).insurancePolicy.update({ where: { id: entity.id }, data: { status: "cancelled" } as never }),
  auditAction: "insurance.booking.cancel",
  auditEntityType: "InsurancePolicy",
  auditExtra: (entity) => ({ premium: entity.premium, policyNumber: entity.policyNumber }),
  notification: (entity) => ({
    topic: "camermove.booking.status.changed" as const,
    type: "booking.status.changed",
    userId: entity.userId,
    payload: {
      policyId: entity.id,
      policyNumber: entity.policyNumber ?? undefined,
      reference: entity.policyNumber ?? undefined,
      amount: entity.premium,
      coverageType: entity.coverageType,
      destination: entity.destination,
      serviceLabel: "Assurance",
      entityLabel: entity.destination,
      newStatus: "cancelled",
      status: "cancelled",
    },
  }),
}

/**
 * User cancellation for an insurance policy. Cancellable only from pending_payment —
 * a confirmed (paid/issued) policy must go through support (409).
 * ACID ceremony lives in the booking-kernel.
 */
export async function cancelInsurancePolicy(id: string, actorId: string, actorRole = "traveler") {
  return cancelIfPending(cancelAdapter, id, actorId, actorRole)
}
