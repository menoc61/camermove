import { BadRequestError } from "@camermove/config"
import { verifyCinetToken } from "../webhooks/verify.js"
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  SupportedProvider,
  VerifyPaymentResult,
} from "./types.js"

export class CinetPayAdapter implements PaymentProvider {
  readonly name: SupportedProvider = "cinetpay"

  constructor(
    private env: {
      CINETPAY_APIKEY?: string
      CINETPAY_SITE_ID?: string
      CINETPAY_SECRET_KEY?: string
      CINETPAY_BASE_URL: string
    },
  ) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (input.currency !== "XAF") {
      throw new BadRequestError("Devise doit être XAF")
    }
    if (input.amount % 5 !== 0) {
      throw new BadRequestError("Montant doit être multiple de 5")
    }

    const apikey = this.env.CINETPAY_APIKEY
    const site_id = this.env.CINETPAY_SITE_ID
    if (!apikey || !site_id) {
      throw new Error("CinetPay not configured: missing CINETPAY_APIKEY or CINETPAY_SITE_ID")
    }

    // Determine channels from input.channels or PaymentMethod via input.channels mapping already
    // input.channels is typed as "ALL" | "MOBILE_MONEY" etc; if not set, map via description fallback
    const channels = input.channels ?? "ALL"

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const res = await fetch(`${this.env.CINETPAY_BASE_URL}/v2/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apikey,
          site_id,
          transaction_id: input.reference,
          amount: input.amount,
          currency: input.currency,
          description: input.description,
          notify_url: input.notifyUrl,
          return_url: input.callbackUrl,
          channels,
        }),
        signal: controller.signal,
      })

      const json = (await res.json()) as {
        code: string
        message?: string
        data?: { payment_token: string; payment_url: string }
        description?: string
      }

      if (json.code === "201" && json.data?.payment_url) {
        return {
          providerRef: json.data.payment_token ?? input.reference,
          authorizationUrl: json.data.payment_url,
          rawResponse: json,
        }
      }

      throw new Error(`CinetPay create failed code=${json.code} message=${json.message ?? json.description ?? "unknown"}`)
    } catch (err) {
      if (err instanceof BadRequestError) throw err
      if ((err as Error).name === "AbortError") {
        throw new Error("CinetPay create timeout after 10s")
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }

  async verifyPayment(providerRef: string): Promise<VerifyPaymentResult> {
    const apikey = this.env.CINETPAY_APIKEY
    const site_id = this.env.CINETPAY_SITE_ID
    if (!apikey || !site_id) {
      throw new Error("CinetPay not configured: missing CINETPAY_APIKEY or CINETPAY_SITE_ID")
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const res = await fetch(`${this.env.CINETPAY_BASE_URL}/v2/payment/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apikey,
          site_id,
          transaction_id: providerRef,
        }),
        signal: controller.signal,
      })

      const json = (await res.json()) as {
        code: string
        message?: string
        data?: { status: string; amount: string; currency: string }
      }

      // success iff code==="00" && status==="ACCEPTED"
      if (json.code === "00" && json.data?.status === "ACCEPTED") {
        return {
          status: "success",
          amount: parseInt(json.data.amount, 10),
          currency: json.data.currency,
          providerRef,
          rawPayload: json,
        }
      }
      if (json.data?.status === "REFUSED" || json.code !== "00") {
        // Check if REFUSED => failed, else pending
        if (json.data?.status === "REFUSED") {
          return {
            status: "failed",
            amount: json.data.amount ? parseInt(json.data.amount, 10) : 0,
            currency: json.data?.currency ?? "XAF",
            providerRef,
            rawPayload: json,
          }
        }
        // For non-00 and non-REFUSED, treat as pending (could be waiting)
        // But if code indicates not found or expired, map to pending/failed accordingly
        return {
          status: "pending",
          amount: json.data?.amount ? parseInt(json.data.amount, 10) : 0,
          currency: json.data?.currency ?? "XAF",
          providerRef,
          rawPayload: json,
        }
      }

      return {
        status: "pending",
        amount: json.data?.amount ? parseInt(json.data.amount, 10) : 0,
        currency: json.data?.currency ?? "XAF",
        providerRef,
        rawPayload: json,
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new Error("CinetPay verify timeout after 10s")
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string, secret: string): boolean {
    // For CinetPay, rawBody is x-www-form-urlencoded string; parse to form Record
    const bodyStr = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8")
    let form: Record<string, string>
    try {
      // Try to parse as URLSearchParams (form-encoded)
      if (bodyStr.includes("=") && bodyStr.includes("&")) {
        form = Object.fromEntries(new URLSearchParams(bodyStr).entries())
      } else {
        // Fallback: try JSON parse then convert to string record
        const parsed = JSON.parse(bodyStr) as Record<string, unknown>
        form = Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v ?? "")]))
      }
    } catch {
      // If not parseable, treat rawBody as single value form (unlikely)
      form = {}
    }
    // Delegate to isolated helper — never inline HMAC
    return verifyCinetToken(form, signature, secret)
  }
}
