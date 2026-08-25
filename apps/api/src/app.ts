import Fastify, { type FastifyInstance } from "fastify"
import cors from "@fastify/cors"
import { loadEnv, AppError } from "@camermove/config"
import { authRoutes } from "./auth/routes"
import { authPlugin } from "./auth/plugins"
import { searchRoutes } from "./search/routes"
import { bookingRoutes } from "./bookings/routes"
import { paymentRoutes } from "./payments/routes"
import { notchpayWebhookRoutes } from "./payments/webhooks/notchpay"
import { cinetpayWebhookRoutes } from "./payments/webhooks/cinetpay"
import { adminSettingsRoutes } from "./admin/settings"
import { ticketLookupRoutes } from "./routes/tickets/lookup"
import { swaggerPlugin } from "./plugins/swagger"
import { metricsPlugin } from "./plugins/metrics"
import { rawBodyPlugin } from "./plugins/rawBody"
import { metadataPlugin } from "./plugins/metadata"
import { rateLimitPlugin } from "./plugins/rateLimit"
import { idempotencyPlugin } from "./plugins/idempotency"

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true, trustProxy: true })
  await app.register(cors, { origin: true, credentials: true })
  await app.register(swaggerPlugin)
  const env = loadEnv()
  if ((env as unknown as { METRICS_ENABLED: boolean }).METRICS_ENABLED) {
    await app.register(metricsPlugin)
  }
  // rawBody must be before metadata/rateLimit so HMAC can use raw string (T-03-14)
  await app.register(rawBodyPlugin)
  await app.register(metadataPlugin)
  await app.register(rateLimitPlugin)
  await app.register(idempotencyPlugin)
  await app.register(authPlugin)
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.status).send({ error: err.code, message: err.message })
    }
    if (err && typeof err === "object" && "issues" in (err as Record<string, unknown>)) {
      return reply.code(400).send({ error: "VALIDATION", message: (err as Error).message })
    }
    req.log.error(err)
    return reply.code(500).send({ error: "INTERNAL", message: "Erreur interne" })
  })
  await app.register(authRoutes, { prefix: "/api/v1" })
  await app.register(searchRoutes, { prefix: "/api/v1" })
  await app.register(bookingRoutes, { prefix: "/api/v1" })
  await app.register(paymentRoutes, { prefix: "/api/v1" })
  // webhooks use same /api/v1 prefix so notify_url is ${API_URL}/api/v1/webhooks/{provider}
  await app.register(notchpayWebhookRoutes, { prefix: "/api/v1" })
  await app.register(cinetpayWebhookRoutes, { prefix: "/api/v1" })
  await app.register(adminSettingsRoutes, { prefix: "/api/v1" })
  await app.register(ticketLookupRoutes, { prefix: "/api/v1" })
  app.get("/health", async () => ({ status: "ok" }))
  return app
}
