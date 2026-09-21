import { AppError, BadRequestError } from "@camermove/config"
import { verifyNotchSignature } from "../webhooks/verify.js"
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  CreateRefundInput,
  CreateRefundResult,
  PaymentProvider,
  SupportedProvider,
  VerifyPaymentResult,
  VerifyRefundResult,
} from "./types.js"

export class NotchPayAdapter implements PaymentProvider {
  readonly name: SupportedProvider = "notchpay"

  constructor(
    private env: { NOTCHPAY_BASE_URL: string; NOTCHPAY_PUBLIC_KEY: string; NOTCHPAY_HASH_KEY: string; NOTCHPAY_PRIVATE_KEY?: string },
  ) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    // Docs (accept-payments/collect + api-reference/payments): POST /payments
    // requires amount+currency plus at least one of email/phone/customer.
    // Send the canonical `customer` object AND flat email/phone for compat.
    if (!input.email && !input.phone && !input.customerName) {
      throw new BadRequestError("Email ou téléphone requis pour NotchPay")
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const body: Record<string, unknown> = {
        amount: input.amount,
        currency: input.currency,
        reference: input.reference,
        callback: input.callbackUrl,
        description: input.description,
      }
      if (input.email) body.email = input.email
      if (input.phone) body.phone = input.phone
      // Canonical customer object per docs — improves Collect pre-fill.
      if (input.email || input.phone || input.customerName) {
        const customer: Record<string, string> = {}
        if (input.customerName) customer.name = input.customerName
        if (input.email) customer.email = input.email
        if (input.phone) customer.phone = input.phone
        body.customer = customer
      }
      // Spec has no `metadata` field — the equivalent is `customer_meta`.
      // Accept `metadata` from callers and forward it spec-compliantly.
      if (input.metadata && Object.keys(input.metadata).length > 0) {
        body.customer_meta = input.metadata
      }
      const res = await fetch(`${this.env.NOTCHPAY_BASE_URL}/payments`, {
        method: "POST",
        headers: {
          Authorization: this.env.NOTCHPAY_PUBLIC_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new AppError(502, "PROVIDER_ERROR", `NotchPay create failed ${res.status}: ${text}`)
      }
      // Live shape per OpenAPI: { code, status, transaction: "<id-string>",
      // authorization_url }. Older/alternate shape: transaction as object
      // { id, reference, merchant_reference }. Accept string, object, or
      // legacy `payment.reference` so doc-snippet drift never breaks us.
      const json = (await res.json()) as {
        transaction?: string | { id?: string; reference?: string; merchant_reference?: string }
        payment?: { reference?: string; id?: string }
        authorization_url?: string
      }
      const tx = json.transaction ?? json.payment
      const providerRef =
        typeof tx === "string"
          ? tx
          : ((tx as { reference?: string; id?: string; merchant_reference?: string })?.reference ??
            (tx as { id?: string })?.id ??
            (tx as { merchant_reference?: string })?.merchant_reference)
      if (!providerRef || !json.authorization_url) {
        throw new Error("NotchPay create: missing transaction.reference or authorization_url")
      }
      return {
        providerRef,
        authorizationUrl: json.authorization_url,
        rawResponse: json,
      }
    } catch (err) {
      if (err instanceof BadRequestError) throw err
      if ((err as Error).name === "AbortError") {
        throw new Error("NotchPay create timeout after 10s")
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }

  async createRefund(input: CreateRefundInput): Promise<CreateRefundResult> {
    // NotchPay refunds: POST /refunds with Authorization: PUBLIC_KEY + X-Grant: PRIVATE_KEY
    // Body: { payment: <payment_ref>, amount?: number, reason?: string, metadata?: object }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const body: Record<string, unknown> = {
        payment: input.paymentRef,
      }
      if (input.amount !== undefined) body.amount = input.amount
      if (input.reason) body.reason = input.reason
      if (input.metadata && Object.keys(input.metadata).length > 0) body.metadata = input.metadata

      // NotchPay refunds require X-Grant header (private key) for sensitive operations.
      // Private key is injected via constructor from loadEnv() (AGENTS.md §1: no process.env elsewhere).
      const privateKey = this.env.NOTCHPAY_PRIVATE_KEY
      if (!privateKey) {
        throw new AppError(503, "PAYMENT_PROVIDER_NOT_CONFIGURED", "NotchPay private key not configured for refunds")
      }

      const res = await fetch(`${this.env.NOTCHPAY_BASE_URL}/refunds`, {
        method: "POST",
        headers: {
          Authorization: this.env.NOTCHPAY_PUBLIC_KEY,
          "X-Grant": privateKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new AppError(502, "PROVIDER_ERROR", `NotchPay refund create failed ${res.status}: ${text}`)
      }
      const json = (await res.json()) as {
        refund?: { id?: string; reference?: string; status: string; amount: number; currency: string }
        code?: number
        status?: string
        message?: string
        id?: string
        reference?: string
      }
      // Handle both { refund: {...} } and direct response { id, reference, status, ... }
      const refundData = json.refund ?? json
      const providerRefundId = (refundData as { id?: string; reference?: string })?.id ?? (refundData as { reference?: string })?.reference
      if (!providerRefundId) {
        throw new AppError(502, "PROVIDER_ERROR", "NotchPay refund create: missing refund.id/reference")
      }
      const rawStatus = String((refundData as { status?: string })?.status ?? "pending").toLowerCase()
      let status: CreateRefundResult["status"]
      if (rawStatus === "complete" || rawStatus === "success") status = "complete"
      else if (rawStatus === "failed") status = "failed"
      else if (rawStatus === "processing") status = "processing"
      else status = "pending"

      return {
        providerRefundId,
        status,
        amount: Number((refundData as { amount?: number })?.amount ?? 0),
        currency: (refundData as { currency?: string })?.currency ?? "XAF",
        rawResponse: json,
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new AppError(502, "PROVIDER_ERROR", "NotchPay refund create timeout after 10s")
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }

  async verifyRefund(providerRefundId: string): Promise<VerifyRefundResult> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const res = await fetch(`${this.env.NOTCHPAY_BASE_URL}/refunds/${providerRefundId}`, {
        headers: { Authorization: this.env.NOTCHPAY_PUBLIC_KEY },
        signal: controller.signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new AppError(502, "PROVIDER_ERROR", `NotchPay refund verify failed ${res.status}: ${text}`)
      }
      const json = (await res.json()) as {
        refund?: { status: string; amount: number; currency: string }
        status?: string
        amount?: number
        currency?: string
      }
      const refundData = json.refund ?? json
      const rawStatus = String((refundData as { status?: string })?.status ?? "pending").toLowerCase()
      let status: VerifyRefundResult["status"]
      if (rawStatus === "complete" || rawStatus === "success") status = "complete"
      else if (rawStatus === "failed") status = "failed"
      else if (rawStatus === "processing") status = "processing"
      else status = "pending"

      return {
        status,
        amount: Number((refundData as { amount?: number })?.amount ?? 0),
        currency: (refundData as { currency?: string })?.currency ?? "XAF",
        providerRefundId,
        rawPayload: json,
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new Error("NotchPay refund verify timeout after 10s")
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string, secret: string): boolean {
    const bodyStr = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8")
    // Delegate to isolated helper — never inline HMAC
    return verifyNotchSignature(bodyStr, signature, secret)
  }

  async verifyPayment(providerRef: string): Promise<VerifyPaymentResult> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const res = await fetch(`${this.env.NOTCHPAY_BASE_URL}/payments/${providerRef}`, {
        headers: { Authorization: this.env.NOTCHPAY_PUBLIC_KEY },
        signal: controller.signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new AppError(502, "PROVIDER_ERROR", `NotchPay verify failed ${res.status}: ${text}`)
      }
      const json = (await res.json()) as {
        transaction: { status: string; amount?: number; total?: number; currency?: string }
      }
      // Docs statuses: pending, processing, incomplete, complete, failed,
      // canceled, rejected, abandoned, expired, refunded, partialy-refunded.
      const rawStatus = String(json.transaction?.status ?? "pending").toLowerCase()
      let status: VerifyPaymentResult["status"]
      if (rawStatus === "complete" || rawStatus === "success" || rawStatus === "refunded" || rawStatus === "partialy-refunded" || rawStatus === "partially-refunded") status = "success"
      else if (rawStatus === "failed" || rawStatus === "canceled" || rawStatus === "cancelled" || rawStatus === "rejected" || rawStatus === "abandoned") status = "failed"
      else if (rawStatus === "expired") status = "expired"
      else status = "pending"

      return {
        status,
        amount: Number(json.transaction?.amount ?? json.transaction?.total ?? 0),
        currency: json.transaction?.currency ?? "XAF",
        providerRef,
        rawPayload: json,
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new Error("NotchPay verify timeout after 10s")
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }
}
