/**
 * Typed notification dispatcher — refactored from Phase 3's bare {userId, bookingId}
 * contract. Consumes NotificationEvent (typed union from @camermove/shared),
 * resolves the user, renders the right template per channel, fans out to
 * email/WhatsApp/push in parallel via Promise.allSettled, retries 3x with
 * exponential backoff (1s/4s/16s), persists Notification rows (status queued → sent|failed),
 * and never throws to the caller (per AGENTS.md §3). Failures also publish to
 * the notifications.failed Kafka topic (added in this plan).
 */
import { prisma } from "@camermove/db"
import type { Env } from "@camermove/config"
import { sendEmail } from "./channels/email"
import { sendWhatsApp } from "./channels/whatsapp"
import { sendPush } from "./channels/push"
import { renderBookingConfirmed, renderPaymentConfirmed, renderTicketIssued, renderTripReminder24h } from "./templates/index.js"
import { createKafkaClient } from "@camermove/events"
import type { NotificationEvent, NotificationEventPayload } from "@camermove/shared"

type Rendered = {
  email?: { to: string; subject: string; text: string; html?: string }
  whatsapp?: { to: string; body: string }
  push?: { topic: string; title: string; message: string }
}

const RETRY_DELAYS_MS = [1000, 4000, 16000] // exponential backoff x3

function ntfyTopicForUser(userId: string): string {
  // ntfy topic rules: [a-zA-Z0-9_-], max 64 chars, no leading underscore.
  // Use last 12 chars of cuid to keep topics short and unreadable.
  return `user-${userId.slice(-12)}`
}

async function retryWithBackoff<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]!))
      }
    }
  }
  throw new Error(`[${label}] exhausted retries: ${(lastErr as Error)?.message ?? "unknown"}`)
}

export interface DispatchResult {
  userId: string
  eventType: string
  channelResults: Array<{ channel: "email" | "whatsapp" | "push"; status: "success" | "failed"; error?: string }>
}

export function createNotificationDispatcher(env: Env) {
  return {
    async dispatch(event: NotificationEvent): Promise<DispatchResult> {
      const user = await prisma.user.findUnique({
        where: { id: event.userId },
        select: { id: true, email: true, phone: true, firstName: true, lastName: true },
      })
      if (!user) {
        console.warn(`[dispatcher] user not found: ${event.userId}`)
        return { userId: event.userId, eventType: event.type, channelResults: [] }
      }

      const render = pickRenderer(event.type)
      const rendered: Rendered = render(event.payload, {
        email: user.email,
        phone: user.phone,
        firstName: user.firstName ?? undefined,
      })

      const tasks: Array<Promise<{ channel: "email" | "whatsapp" | "push"; status: "success" | "failed"; error?: string }>> = []

      if (rendered.email && user.email) {
        const row = await prisma.notification.create({
          data: {
            userId: user.id,
            channel: "email",
            type: event.type,
            status: "queued",
            payload: { to: user.email, subject: rendered.email.subject, text: rendered.email.text } as never,
          },
        })
        const task = retryWithBackoff(
          () => sendEmail({ to: user.email!, subject: rendered.email!.subject, text: rendered.email!.text }, env),
          `email:${user.id}`,
        )
          .then(async () => {
            await prisma.notification.update({ where: { id: row.id }, data: { status: "sent", sentAt: new Date() } })
            return { channel: "email" as const, status: "success" as const }
          })
          .catch(async (err) => {
            await prisma.notification.update({ where: { id: row.id }, data: { status: "failed" } })
            return { channel: "email" as const, status: "failed" as const, error: (err as Error).message }
          })
        tasks.push(task)
      }

      if (rendered.whatsapp && user.phone) {
        const to = user.phone.startsWith("+") ? `whatsapp:${user.phone}` : `whatsapp:+${user.phone}`
        const row = await prisma.notification.create({
          data: {
            userId: user.id,
            channel: "whatsapp",
            type: event.type,
            status: "queued",
            payload: { to, body: rendered.whatsapp.body } as never,
          },
        })
        const task = retryWithBackoff(
          () => sendWhatsApp(env, { to, body: rendered.whatsapp!.body }),
          `whatsapp:${user.id}`,
        )
          .then(async () => {
            await prisma.notification.update({ where: { id: row.id }, data: { status: "sent", sentAt: new Date() } })
            return { channel: "whatsapp" as const, status: "success" as const }
          })
          .catch(async (err) => {
            await prisma.notification.update({ where: { id: row.id }, data: { status: "failed" } })
            return { channel: "whatsapp" as const, status: "failed" as const, error: (err as Error).message }
          })
        tasks.push(task)
      }

      if (rendered.push) {
        const topic = ntfyTopicForUser(user.id)
        const row = await prisma.notification.create({
          data: {
            userId: user.id,
            channel: "push",
            type: event.type,
            status: "queued",
            payload: { topic, title: rendered.push.title, message: rendered.push.message } as never,
          },
        })
        const task = retryWithBackoff(
          () => sendPush(env, { userId: topic, title: rendered.push!.title, message: rendered.push!.message }),
          `push:${user.id}`,
        )
          .then(async () => {
            await prisma.notification.update({ where: { id: row.id }, data: { status: "sent", sentAt: new Date() } })
            return { channel: "push" as const, status: "success" as const }
          })
          .catch(async (err) => {
            await prisma.notification.update({ where: { id: row.id }, data: { status: "failed" } })
            return { channel: "push" as const, status: "failed" as const, error: (err as Error).message }
          })
        tasks.push(task)
      }

      const channelResults = await Promise.allSettled(tasks)
      const result: DispatchResult = {
        userId: user.id,
        eventType: event.type,
        channelResults: channelResults.map((r) =>
          r.status === "fulfilled" ? r.value : { channel: "email" as const, status: "failed" as const, error: (r.reason as Error).message },
        ),
      }

      // Publish failures to notifications.failed Kafka topic (best-effort)
      const failures = result.channelResults.filter((c) => c.status === "failed")
      if (failures.length > 0) {
        try {
          const kafka = createKafkaClient(env as never)
          const producer = kafka.producer({ idempotent: true })
          await producer.connect().catch(() => {})
          await producer
            .send({
              topic: "camermove.notifications.failed",
              messages: [
                {
                  key: user.id,
                  value: JSON.stringify({
                    id: `failed-${Date.now()}`,
                    type: "notifications.failed",
                    ts: new Date().toISOString(),
                    aggregateId: user.id,
                    data: {
                      userId: user.id,
                      eventType: event.type,
                      failures: failures.map((f) => ({ channel: f.channel, error: f.error })),
                    },
                  }),
                },
              ],
            })
            .catch(() => {})
          await producer.disconnect().catch(() => {})
        } catch {}
      }

      return result
    },
  }
}

function pickRenderer(type: NotificationEvent["type"]): (data: NotificationEventPayload, user: { email: string | null; phone: string | null; firstName?: string }) => Rendered {
  switch (type) {
    case "booking.confirmed":
      return renderBookingConfirmed as never
    case "payment.confirmed":
      return renderPaymentConfirmed as never
    case "ticket.issued":
      return renderTicketIssued as never
    case "trip.reminder.24h":
      return renderTripReminder24h as never
    default:
      return () => ({}) as never
  }
}
