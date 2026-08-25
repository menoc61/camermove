export const PAYMENT_PROVIDERS = {
  notchpay: "notchpay",
  cinetpay: "cinetpay",
} as const

export type SupportedProvider = (typeof PAYMENT_PROVIDERS)[keyof typeof PAYMENT_PROVIDERS]

export type PaymentMethod = "mobile_money" | "card" | "bank_transfer"

export interface CreatePaymentInput {
  bookingId: string
  reference: string
  amount: number
  currency: "XAF"
  email?: string
  phone?: string
  customerName?: string
  description: string
  callbackUrl: string
  notifyUrl: string
  channels?: "ALL" | "MOBILE_MONEY" | "CREDIT_CARD" | "WALLET"
}

export interface CreatePaymentResult {
  providerRef: string
  authorizationUrl: string
  rawResponse: unknown
}

export interface VerifyPaymentResult {
  status: "success" | "failed" | "pending" | "expired"
  amount: number
  currency: string
  providerRef: string
  rawPayload: unknown
}

export interface PaymentProvider {
  readonly name: SupportedProvider
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>
  verifyPayment(providerRef: string): Promise<VerifyPaymentResult>
  verifyWebhookSignature(rawBody: string | Buffer, signature: string, secret: string): boolean
}
