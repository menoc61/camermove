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
  /** Free-form order context. Forwarded as `customer_meta` (spec field). */
  metadata?: Record<string, unknown>
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

export interface CreateRefundInput {
  paymentRef: string
  amount?: number
  reason?: string
  metadata?: Record<string, unknown>
}

export interface CreateRefundResult {
  providerRefundId: string
  status: "pending" | "processing" | "complete" | "failed"
  amount: number
  currency: string
  rawResponse: unknown
}

export interface VerifyRefundResult {
  status: "pending" | "processing" | "complete" | "failed"
  amount: number
  currency: string
  providerRefundId: string
  rawPayload: unknown
}

export interface PaymentProvider {
  readonly name: SupportedProvider
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>
  verifyPayment(providerRef: string): Promise<VerifyPaymentResult>
  verifyWebhookSignature(rawBody: string | Buffer, signature: string, secret: string): boolean
  createRefund(input: CreateRefundInput): Promise<CreateRefundResult>
  verifyRefund(providerRefundId: string): Promise<VerifyRefundResult>
}
