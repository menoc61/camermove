import twilio from "twilio"
import type { Env } from "@camermove/config"
export async function sendWhatsApp(env: Env, msg: { to: string; body: string }) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_FROM) return
  const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
  await client.messages.create({ from: env.TWILIO_WHATSAPP_FROM, to: msg.to, body: msg.body })
}
