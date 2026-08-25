import nodemailer from "nodemailer"
import type { Env } from "@camermove/config"

/**
 * Email channel adapter — Phase 4 typed signature.
 * Falls back to console.log if NOTIF_DRIVER=stub (dev / smoke test).
 * Uses nodemailer with SMTP env; MailHog (localhost:1025) is the default.
 */
export interface EmailMessage {
  to: string
  subject: string
  text: string
  html?: string
}

export async function sendEmail(msg: EmailMessage, env?: Env): Promise<void> {
  if (env?.NODE_ENV === "test" || process.env.NOTIF_DRIVER === "stub") {
    console.log(`[email:stub] to=${msg.to} subject=${JSON.stringify(msg.subject)} text.length=${msg.text.length}`)
    return
  }
  const host = env?.SMTP_HOST ?? process.env.SMTP_HOST ?? "localhost"
  const port = Number(env?.SMTP_PORT ?? process.env.SMTP_PORT ?? 1025)
  const secure = String(env?.SMTP_SECURE ?? process.env.SMTP_SECURE) === "true"
  const user = env?.SMTP_USER ?? process.env.SMTP_USER
  const pass = env?.SMTP_PASS ?? process.env.SMTP_PASS
  const from = env?.SMTP_FROM ?? process.env.SMTP_FROM ?? "no-reply@camermove.cm"
  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  })
  await transport.sendMail({ from, ...msg })
}
