/**
 * Deep payment seam — the one module owning payment initiation for every
 * payable kind. Domain adapters pass kind + entity + amount + reference and a
 * link hook; the seam owns: provider-config guard (503), CinetPay amount rule,
 * channels mapping, callback/notify URL building, the in-tx one-pending
 * dedup guard, payment row creation, entity linking, AuditLog and the
 * paymentInitiated event publish (via the outbox adapter).
 */
import { prisma } from "@camermove/db"
import { AppError, BadRequestError, NotFoundError, loadEnv } from "@camermove/config"
import { EVENT_TOPICS, makeDataEvent, publishEvent } from "@camermove/events"
import { getProvider } from "./providers/index.js"
import type { PayableKind } from "../booking-kernel"

export type PaymentProvider = "notchpay" | "cinetpay"

export function methodToChannels(method?: string): "ALL" | "MOBILE_MONEY" | "CREDIT_CARD" | "WALLET" {
  if (method === "mobile_money") return "MOBILE_MONEY"
  if (method === "card") return "CREDIT_CARD"
  if (method === "bank_transfer") return "WALLET"
  return "ALL"
}

/** Guard against a misconfigured provider before burning a transaction + network call. */
export function assertProviderConfigured(provider: PaymentProvider): void {
  const env = loadEnv() as unknown as Record<string, string | undefined>
  if (provider === "notchpay" && !env.NOTCHPAY_PUBLIC_KEY) {
    throw new AppError(503, "PAYMENT_PROVIDER_NOT_CONFIGURED", "NotchPay n'est pas configuré sur ce serveur")
  }
  if (provider === "cinetpay" && (!env.CINETPAY_APIKEY || !env.CINETPAY_SITE_ID)) {
    throw new AppError(503, "PAYMENT_PROVIDER_NOT_CONFIGURED", "CinetPay n'est pas configuré sur ce serveur")
  }
}

export function assertCinetpayAmount(provider: PaymentProvider, amount: number): void {
  if (provider === "cinetpay" && amount % 5 !== 0) {
    throw new BadRequestError("Montant doit être multiple de 5 (XAF)")
  }
}

export function buildPaymentUrls(provider: PaymentProvider, reference: string): { callbackUrl: string; notifyUrl: string } {
  const env = loadEnv() as unknown as Record<string, string | undefined>
  const baseUrl = env.API_URL
  const frontendUrl = env.FRONTEND_URL
  const callbackBase = frontendUrl ?? baseUrl ?? "https://camermove.cm"
  const callbackUrl = `${String(callbackBase).replace(/\/$/, "")}/payment/callback?reference=${reference}`
  const notifyUrl = `${String(baseUrl ?? "https://camermove.cm").replace(/\/$/, "")}/api/v1/webhooks/${provider}`
  return { callbackUrl, notifyUrl }
}

export interface InitiatePaymentInput {
  kind: PayableKind
  entityId: string
  userId: string
  provider: PaymentProvider
  amount: number
  reference: string
  description: string
  phone?: string
  email?: string
  method?: string
  meta?: Record<string, unknown>
  /** Adapter: re-read the entity inside the tx (fresh paymentId + existence). */
  findFresh: (tx: unknown) => Promise<{ paymentId: string | null } | null>
  notFoundMessage: string
  /** Adapter: link the created payment id onto the entity (paymentId column). */
  linkPayment: (tx: unknown, paymentId: string) => Promise<void>
  /** Domain-distinct audit metadata, e.g. { hotelBookingId: ... }. */
  auditEntityMeta: Record<string, unknown>
}

export interface InitiatedPayment {
  payment: unknown
  authorizationUrl: string | null
}

export async function initiateEntityPayment(input: InitiatePaymentInput): Promise<InitiatedPayment> {
  assertProviderConfigured(input.provider)
  assertCinetpayAmount(input.provider, input.amount)

  const { callbackUrl, notifyUrl } = buildPaymentUrls(input.provider, input.reference)
  const provider = getProvider(input.provider)
  const result = await provider.createPayment({
    bookingId: input.entityId,
    reference: input.reference,
    amount: input.amount,
    currency: "XAF",
    email: input.email,
    phone: input.phone,
    description: input.description,
    callbackUrl,
    notifyUrl,
    channels: methodToChannels(input.method),
  })

  const payment = await prisma.$transaction(async (tx: unknown) => {
    const t = tx as {
      payment: { findUnique: (a: unknown) => Promise<{ status: string } | null>; create: (a: unknown) => Promise<unknown> }
      auditLog: { create: (a: unknown) => Promise<unknown> }
    }
    const fresh = await input.findFresh(tx)
    if (!fresh) throw new NotFoundError(input.notFoundMessage)
    if (fresh.paymentId) {
      const linked = await t.payment.findUnique({ where: { id: fresh.paymentId } }).catch(() => null)
      if (linked && ["pending", "processing"].includes((linked as { status: string }).status)) return linked
    }
    const created = await t.payment.create({
      data: {
        bookingId: null as never,
        provider: input.provider as never,
        providerRef: result.providerRef,
        amount: input.amount,
        currency: "XAF",
        method: (input.method as never) ?? "mobile_money",
        status: "pending" as never,
        webhookPayload: { ...((result.rawResponse as Record<string, unknown>) ?? {}), authorizationUrl: result.authorizationUrl, bookingReference: input.reference, entityKind: input.kind } as never,
      },
    })
    await input.linkPayment(tx, (created as { id: string }).id)
    await t.auditLog.create({
      data: {
        actorId: input.userId,
        action: "payment.create",
        entityType: "Payment",
        entityId: (created as { id: string }).id,
        metadata: { ...input.auditEntityMeta, provider: input.provider, amount: input.amount, ip: input.meta?.ip, ua: input.meta?.userAgent } as never,
      },
    })
    return created
  })

  await publishEvent(
    EVENT_TOPICS.paymentInitiated,
    makeDataEvent("payment.initiated", (payment as { id: string }).id, {
      paymentId: (payment as { id: string }).id,
      kind: input.kind,
      [`${input.kind}Id`]: input.entityId,
      provider: input.provider,
      amount: input.amount,
    }),
  )

  return { payment, authorizationUrl: result.authorizationUrl }
}
