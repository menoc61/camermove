import { createLogger, loadEnv } from "@camermove/config"
import { createKafkaClient, createEventConsumer, EVENT_TOPICS } from "@camermove/events"
import { createNotificationHandlers } from "./handlers/notifications"
import { initTelemetry } from "@camermove/observability"
import { startHeartbeat, stopHeartbeat } from "./heartbeat"
import { startQueues, closeQueues } from "./queues"

const env = loadEnv()
const log = createLogger()
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
  await consumer.connect()
  log.info("worker running — payment handlers registered")
  // BullMQ owns hold-expiry + reconciliation + trip reminders (AGENTS.md §1).
  await startQueues()
  startHeartbeat()
}

main().catch((err) => {
  log.error({ err }, "worker failed to start")
  process.exit(1)
})

process.on("SIGTERM", async () => {
  await stopHeartbeat().catch(() => {})
  await closeQueues().catch(() => {})
  await telemetry.shutdown()
  await consumer.disconnect()
  process.exit(0)
})
