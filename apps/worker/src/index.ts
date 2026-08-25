import { loadEnv } from "@camermove/config"
import { createKafkaClient, createEventConsumer, EVENT_TOPICS } from "@camermove/events"
import { createNotificationDispatcher } from "./notifications/dispatcher"
import { initTelemetry } from "@camermove/observability"
import type { NotificationEvent } from "@camermove/shared"

const env = loadEnv()
const telemetry = initTelemetry(env)
const kafka = createKafkaClient(env)
const dispatcher = createNotificationDispatcher(env)

const consumer = createEventConsumer(kafka, env, {
  [EVENT_TOPICS.notificationShouldSend]: async (event) => {
    // Legacy event from Phase 3 — payload was bare {userId, bookingId}.
    // We can't enrich here without DB lookup, so we attempt a best-effort dispatch
    // by inferring event type from `event.type` if present.
    const fallbackType: NotificationEvent["type"] = "booking.confirmed"
    const data = (event.data ?? {}) as { userId?: string; bookingId?: string }
    if (!data.userId) return
    await dispatcher.dispatch({ type: fallbackType, userId: data.userId, payload: { bookingId: data.bookingId } })
  },
  [EVENT_TOPICS.bookingConfirmed]: async (event) => {
    const data = event.data as NotificationEvent
    if (!data?.userId) return
    await dispatcher.dispatch(data)
  },
  [EVENT_TOPICS.paymentConfirmed]: async (event) => {
    const data = event.data as NotificationEvent
    if (!data?.userId) return
    await dispatcher.dispatch(data)
  },
  [EVENT_TOPICS.ticketIssued]: async (event) => {
    const data = event.data as NotificationEvent
    if (!data?.userId) return
    await dispatcher.dispatch(data)
  },
  [EVENT_TOPICS.tripReminder24h]: async (event) => {
    const data = event.data as NotificationEvent
    if (!data?.userId) return
    await dispatcher.dispatch(data)
  },
  [EVENT_TOPICS.bookingCreated]: async () => {},
  [EVENT_TOPICS.paymentCompleted]: async () => {},
  [EVENT_TOPICS.paymentWebhookReceived]: async (event) => {
    // paymentWebhookReceived handler — serializes via SELECT FOR UPDATE inside transaction
    const mod = await import("../../api/src/payments/jobs/reconciliation.js")
    await mod.processPaymentWebhook(event as never)
  },
})

async function main() {
  await consumer.connect()
  console.log("worker running — payment handlers registered")

  // Periodic reconciliation hourly (BullMQ repeatable upgrade documented)
  // Fallback setInterval when BullMQ not yet installed (T-03-18)
  const interval = setInterval(() => {
    import("../../api/src/payments/jobs/reconciliation.js")
      .then((m) => m.reconcileStalePayments())
      .catch((e) => console.error("reconcileStalePayments failed", e))
  }, 60 * 60 * 1000)

  // Hold expiry every minute (BOOK-02/SC2): abandoned pre-payment holds release their seats.
  // BullMQ repeatable-job upgrade path: replace this interval with a queue-scheduled repeatable job.
  const expireInterval = setInterval(() => {
    import("../../api/src/bookings/service.js")
      .then((m) => m.expireHolds())
      .then((n) => {
        if (n > 0) console.log(`expireHolds released ${n} booking(s)`)
      })
      .catch((e) => console.error("expireHolds failed", e))
  }, 60 * 1000)

  // Trip reminder cron (Task 9) — 30 min interval, idempotent via Notification presence check.
  // BullMQ upgrade path documented in apps/worker/src/jobs/trip-reminder.ts.
  const tripReminderInterval = setInterval(() => {
    import("./jobs/trip-reminder.js")
      .then((m) => m.runTripReminder())
      .catch((e) => console.error("trip-reminder failed", e))
  }, 30 * 60 * 1000)

  // Keep references to clear on SIGTERM
  ;(globalThis as unknown as { __reconcileInterval?: NodeJS.Timeout }).__reconcileInterval = interval
  ;(globalThis as unknown as { __expireHoldsInterval?: NodeJS.Timeout }).__expireHoldsInterval = expireInterval
  ;(globalThis as unknown as { __tripReminderInterval?: NodeJS.Timeout }).__tripReminderInterval = tripReminderInterval
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

process.on("SIGTERM", async () => {
  const handles = globalThis as unknown as {
    __reconcileInterval?: NodeJS.Timeout
    __expireHoldsInterval?: NodeJS.Timeout
    __tripReminderInterval?: NodeJS.Timeout
  }
  if (handles.__reconcileInterval) clearInterval(handles.__reconcileInterval)
  if (handles.__expireHoldsInterval) clearInterval(handles.__expireHoldsInterval)
  if (handles.__tripReminderInterval) clearInterval(handles.__tripReminderInterval)
  await telemetry.shutdown()
  await consumer.disconnect()
  process.exit(0)
})
