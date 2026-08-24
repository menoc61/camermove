import { loadEnv } from "@camermove/config"
import { createKafkaClient, createEventConsumer, EVENT_TOPICS } from "@camermove/events"
import { createNotificationService } from "./notifications/service"
import { initTelemetry } from "@camermove/observability"
const env = loadEnv()
const telemetry = initTelemetry(env)
const kafka = createKafkaClient(env)
const notifications = createNotificationService(env)
const consumer = createEventConsumer(kafka, env, {
  [EVENT_TOPICS.notificationShouldSend]: async (event) => { await notifications.send(event.data as never) },
  [EVENT_TOPICS.bookingCreated]: async () => {},
  [EVENT_TOPICS.paymentCompleted]: async () => {},
  [EVENT_TOPICS.ticketIssued]: async () => {},
})
async function main() { await consumer.connect(); console.log("worker running") }
main().catch((err) => { console.error(err); process.exit(1) })
process.on("SIGTERM", async () => { await telemetry.shutdown(); await consumer.disconnect(); process.exit(0) })
