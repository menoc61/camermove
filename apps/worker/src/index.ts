import { loadEnv } from "@camermove/config"
import { createKafkaClient, createEventConsumer, EVENT_TOPICS } from "@camermove/events"
import { createNotificationService } from "./notifications/service"
import { initTelemetry } from "@camermove/observability"

const env = loadEnv()
const telemetry = initTelemetry(env)
const kafka = createKafkaClient(env)
const notifications = createNotificationService(env)

const consumer = createEventConsumer(kafka, env, {
  [EVENT_TOPICS.notificationShouldSend]: async (event) => {
    await notifications.send(event.data as never)
  },
  [EVENT_TOPICS.bookingCreated]: async () => {},
  [EVENT_TOPICS.paymentCompleted]: async () => {},
  [EVENT_TOPICS.paymentWebhookReceived]: async (event) => {
    // paymentWebhookReceived handler — serializes via SELECT FOR UPDATE inside transaction
    const mod = await import("../../api/src/payments/jobs/reconciliation.js")
    await mod.processPaymentWebhook(event as never)
  },
  [EVENT_TOPICS.ticketIssued]: async () => {},
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

  // Keep references to clear on SIGTERM
  ;(globalThis as unknown as { __reconcileInterval?: NodeJS.Timeout }).__reconcileInterval = interval
  ;(globalThis as unknown as { __expireHoldsInterval?: NodeJS.Timeout }).__expireHoldsInterval = expireInterval
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

process.on("SIGTERM", async () => {
  const handles = globalThis as unknown as { __reconcileInterval?: NodeJS.Timeout; __expireHoldsInterval?: NodeJS.Timeout }
  if (handles.__reconcileInterval) clearInterval(handles.__reconcileInterval)
  if (handles.__expireHoldsInterval) clearInterval(handles.__expireHoldsInterval)
  await telemetry.shutdown()
  await consumer.disconnect()
  process.exit(0)
})
