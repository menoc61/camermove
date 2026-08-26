import twilio from "twilio"
import type { Env } from "@camermove/config"

/**
 * WhatsApp channel adapter — Phase 4 typed signature.
 * Falls back to console.log if NOTIF_DRIVER=stub; rejects with
 * channel_not_configured:whatsapp if Twilio env is missing outside stub/test.
 * Twilio sandbox sender: whatsapp:+14155238886 (set via WHATSAPP_FROM).
 */
export interface WhatsAppMessage {
  to: string
  body: string
}

export async function sendWhatsApp(env: Env, msg: WhatsAppMessage): Promise<void> {
  if (env.NODE_ENV === "test" || process.env.NOTIF_DRIVER === "stub") {
    console.log(`[whatsapp:stub] to=${msg.to} body.length=${msg.body.length} body=${JSON.stringify(msg.body)}`)
    return
  }
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_FROM) {
    throw new Error("channel_not_configured:whatsapp")
  }
  const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
  await client.messages.create({ from: env.TWILIO_WHATSAPP_FROM, to: msg.to, body: msg.body })
}
