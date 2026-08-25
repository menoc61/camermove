import { BadRequestError } from "@camermove/config"
import { verifyNotchSignature } from "../webhooks/verify.js"
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  SupportedProvider,
  VerifyPaymentResult,
} from "./types.js"

export class NotchPayAdapter implements PaymentProvider {
  readonly name: SupportedProvider = "notchpay"

  constructor(
    private env: { NOTCHPAY_BASE_URL: string; NOTCHPAY_PUBLIC_KEY: string; NOTCHPAY_HASH_KEY: string },
  ) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const res = await fetch(`${this.env.NOTCHPAY_BASE_URL}/payments`, {
        method: "POST",
        headers: {
          Authorization: this.env.NOTCHPAY_PUBLIC_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: input.amount,
          currency: input.currency,
          email: input.email,
          phone: input.phone,
          reference: input.reference,
          callback: input.callbackUrl,
          description: input.description,
        }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(`NotchPay create failed ${res.status}: ${text}`)
      }
      const json = (await res.json()) as {
        transaction: { id: string }
        authorization_url: string
      }
      if (!json.transaction?.id || !json.authorization_url) {
        throw new Error("NotchPay create: missing transaction.id or authorization_url")
      }
      return {
        providerRef: json.transaction.id,
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
        throw new Error(`NotchPay verify failed ${res.status}: ${text}`)
      }
      const json = (await res.json()) as {
        transaction: { status: string; amount: number; currency: string }
      }
      const rawStatus = json.transaction?.status ?? "pending"
      let status: VerifyPaymentResult["status"]
      if (rawStatus === "complete" || rawStatus === "success") status = "success"
      else if (rawStatus === "failed") status = "failed"
      else if (rawStatus === "expired") status = "expired"
      else status = "pending"

      return {
        status,
        amount: json.transaction.amount,
        currency: json.transaction.currency,
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
