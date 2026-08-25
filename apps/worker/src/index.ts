import { loadEnv } from "@camermove/config"
import { createKafkaClient, createEventConsumer, EVENT_TOPICS } from "@camermove/events"
import { createNotificationHandlers } from "./handlers/notifications"
import { initTelemetry } from "@camermove/observability"

const env = loadEnv()
const telemetry = initTelemetry(env)
const kafka = createKafkaClient(env)
const notificationHandlers = createNotificationHandlers(env)

const consumer = createEventConsumer(kafka, env, {
  [EVENT_TOPICS.notificationShouldSend]: async (event) => {
    // Legacy Phase 3 events: payload was bare {userId, bookingId}. We can't enrich
    // here without a DB lookup, so we route through a minimal best-effort path.
    // Phase 4 publishers (reconciliation.ts) emit typed events on the new topics
    // (booking.confirmed, payment.confirmed, ticket.issued) — those are the
    // canonical path going forward. This handler remains for back-compat.
    const data = (event.data ?? {}) as { userId?: string; bookingId?: string }
    if (!data.userId) return
    await notificationHandlers.onBookingConfirmed({ data: { type: "booking.confirmed", userId: data.userId, payload: { bookingId: data.bookingId } } })
  },
  [EVENT_TOPICS.bookingConfirmed]: notificationHandlers.onBookingConfirmed,
  [EVENT_TOPICS.paymentConfirmed]: notificationHandlers.onPaymentConfirmed,
  [EVENT_TOPICS.ticketIssued]: notificationHandlers.onTicketIssued,
  [EVENT_TOPICS.tripReminder24h]: notificationHandlers.onTripReminder,
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
