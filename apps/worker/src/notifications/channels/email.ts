import nodemailer from "nodemailer"
import type { Env } from "@camermove/config"
export async function sendEmail(msg: { to: string; subject: string; text: string }, env?: Env) {
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
