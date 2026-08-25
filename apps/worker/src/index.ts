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

  // Keep reference to clear on SIGTERM
  ;(globalThis as unknown as { __reconcileInterval?: NodeJS.Timeout }).__reconcileInterval = interval
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

process.on("SIGTERM", async () => {
  const interval = (globalThis as unknown as { __reconcileInterval?: NodeJS.Timeout }).__reconcileInterval
  if (interval) clearInterval(interval)
  await telemetry.shutdown()
  await consumer.disconnect()
  process.exit(0)
})
