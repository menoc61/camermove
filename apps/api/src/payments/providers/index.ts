import { BadRequestError, loadEnv } from "@camermove/config"
import type { PaymentProvider, SupportedProvider } from "./types.js"
import { NotchPayAdapter } from "./notchpay.adapter.js"
import { CinetPayAdapter } from "./cinetpay.adapter.js"

export function getProvider(name: SupportedProvider): PaymentProvider {
  // loadEnv() called inside function (lazy) to keep tests mockable
  const env = loadEnv()
  if (name === "notchpay") {
    return new NotchPayAdapter({
      NOTCHPAY_BASE_URL: env.NOTCHPAY_BASE_URL,
      NOTCHPAY_PUBLIC_KEY: env.NOTCHPAY_PUBLIC_KEY,
      NOTCHPAY_HASH_KEY: env.NOTCHPAY_HASH_KEY,
    })
  }
  if (name === "cinetpay") {
    return new CinetPayAdapter({
      CINETPAY_APIKEY: env.CINETPAY_APIKEY,
      CINETPAY_SITE_ID: env.CINETPAY_SITE_ID,
      CINETPAY_SECRET_KEY: env.CINETPAY_SECRET_KEY,
      CINETPAY_BASE_URL: env.CINETPAY_BASE_URL,
    })
  }
  throw new BadRequestError(`Provider inconnu: ${name}`)
}
