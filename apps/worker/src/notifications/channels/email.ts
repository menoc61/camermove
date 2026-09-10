import nodemailer from "nodemailer"
import { createLogger, type Env } from "@camermove/config"

const log = createLogger()

/**
 * Email channel adapter — Phase 4 typed signature.
 * Falls back to structured logger (dev-only, silenced in production) if NOTIF_DRIVER=stub.
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
    // Dev-only visibility: silenced in production.
    if ((env?.NODE_ENV ?? process.env.NODE_ENV) !== "production") {
      log.info({ to: msg.to, subject: msg.subject, textLength: msg.text.length }, "email stub send")
    }
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
