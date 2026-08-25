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
