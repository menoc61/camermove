import { createLogger, loadEnv } from "@camermove/config"
import { createKafkaClient, createEventConsumer, EVENT_TOPICS } from "@camermove/events"
import { createNotificationHandlers } from "./handlers/notifications"
import { initTelemetry, startMetricsServer } from "@camermove/observability"
import { getStorage } from "@camermove/media"
import { startHeartbeat, stopHeartbeat } from "./heartbeat"
import { startQueues, closeQueues } from "./queues"
import { startOutboxRelay } from "./outbox-relay"

const env = loadEnv()
const log = createLogger()
const telemetry = initTelemetry(env)
// Standalone /metrics + /health server so Prometheus can scrape worker:4000
// independently of any HTTP framework (AGENTS.md §1 observability).
const metricsServer = env.METRICS_ENABLED ? startMetricsServer(env, env.WORKER_METRICS_PORT) : undefined
if (metricsServer) {
  log.info({ port: env.WORKER_METRICS_PORT }, "worker metrics server listening")
}
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
  [EVENT_TOPICS.paymentFailed]: notificationHandlers.onPaymentFailed,
  [EVENT_TOPICS.ticketIssued]: notificationHandlers.onTicketIssued,
  [EVENT_TOPICS.tripReminder24h]: notificationHandlers.onTripReminder,
  [EVENT_TOPICS.hotelBookingConfirmed]: notificationHandlers.onHotelBookingConfirmed,
  [EVENT_TOPICS.rentalBookingConfirmed]: notificationHandlers.onRentalBookingConfirmed,
  [EVENT_TOPICS.parcelStatusChanged]: notificationHandlers.onParcelStatusChanged,
  [EVENT_TOPICS.insurancePolicyIssued]: notificationHandlers.onInsurancePolicyIssued,
  [EVENT_TOPICS.eventBookingConfirmed]: notificationHandlers.onEventBookingConfirmed,
  [EVENT_TOPICS.bookingStatusChanged]: notificationHandlers.onBookingStatusChanged,
  [EVENT_TOPICS.bookingCreated]: async () => {},
  [EVENT_TOPICS.paymentCompleted]: async () => {},
  [EVENT_TOPICS.paymentWebhookReceived]: async (event) => {
    // paymentWebhookReceived handler — serializes via SELECT FOR UPDATE inside transaction
    const mod = await import("../../api/src/payments/jobs/reconciliation.js")
    await mod.processPaymentWebhook(event as never)
  },
})

async function main() {
  // Ensure the MinIO bucket exists before any consumer code that may upload artifacts.
  await getStorage().ensureBucket()
  await consumer.connect()
  log.info("worker running — payment handlers registered")
  // BullMQ owns hold-expiry + reconciliation + trip reminders (AGENTS.md §1).
  await startQueues()
  // Transactional-outbox relay: idle until migration 20260922000003_outbox lands.
  stopOutboxRelay = startOutboxRelay(log)
  startHeartbeat()
}

main().catch((err) => {
  log.error({ err }, "worker failed to start")
  process.exit(1)
})

let stopOutboxRelay: (() => void) | undefined

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  log.info({ signal }, "worker shutdown signal received")
  stopOutboxRelay?.()
  await stopHeartbeat().catch(() => {})
  await closeQueues().catch(() => {})
  await metricsServer?.close().catch(() => {})
  await telemetry.shutdown().catch(() => {})
  await consumer.disconnect().catch(() => {})
  process.exit(0)
}

process.on("SIGTERM", () => void shutdown("SIGTERM"))
process.on("SIGINT", () => void shutdown("SIGINT"))
