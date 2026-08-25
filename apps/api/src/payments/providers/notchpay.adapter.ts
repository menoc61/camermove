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

  async createPayment(_input: CreatePaymentInput): Promise<CreatePaymentResult> {
    throw new Error("Not implemented — see task 3")
  }

  async verifyPayment(_providerRef: string): Promise<VerifyPaymentResult> {
    throw new Error("Not implemented — see task 3")
  }

  verifyWebhookSignature(_rawBody: string | Buffer, _signature: string, _secret: string): boolean {
    throw new Error("Not implemented — see task 3")
  }
}
