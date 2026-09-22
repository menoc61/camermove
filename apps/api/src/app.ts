import Fastify, { type FastifyInstance } from "fastify"
import cors from "@fastify/cors"
import helmet from "@fastify/helmet"
import { loadEnv, AppError } from "@camermove/config"
import { getStorage } from "@camermove/media"
import { initTelemetry, startMetricsServer } from "@camermove/observability"
import { authRoutes } from "./auth/routes"
import { authPlugin } from "./auth/plugins"
import { searchRoutes } from "./search/routes"
import { bookingRoutes } from "./bookings/routes"
import { paymentRoutes } from "./payments/routes"
import { notchpayWebhookRoutes } from "./payments/webhooks/notchpay"
import { cinetpayWebhookRoutes } from "./payments/webhooks/cinetpay"
import { adminSettingsRoutes } from "./admin/settings"
import { ticketLookupRoutes } from "./routes/tickets/lookup"
import { dashboardRoutes } from "./routes/me/dashboard"
import { meTicketRoutes } from "./routes/me/tickets"
import { meNotificationRoutes } from "./routes/me/notifications"
import { meProfileRoutes } from "./routes/me/profile"
import { partnerApplicationRoutes } from "./partner-applications/routes"
import { partnerServiceRoutes } from "./partners/routes"
import { placesRoutes } from "./places/routes"
import { agenciesRoutes } from "./agencies/routes"
import { reviewRoutes } from "./reviews/routes"
import { transporterRoutes } from "./transporter/routes"
import { adminRoutes } from "./admin/routes"
import { swaggerPlugin } from "./plugins/swagger"
import { metricsPlugin } from "./plugins/metrics"
import { rawBodyPlugin } from "./plugins/rawBody"
import { metadataPlugin } from "./plugins/metadata"
import { rateLimitPlugin } from "./plugins/rateLimit"
import { idempotencyPlugin } from "./plugins/idempotency"
import { hotelRoutes } from "./hotels/routes"
import { rentalRoutes } from "./rentals/routes"
import { parcelRoutes } from "./parcels/routes"
import { eventRoutes } from "./events/routes"
import { insuranceRoutes } from "./insurance"
import { intraurbanRoutes } from "./intraurban/routes"
import { contactRoutes } from "./contact/routes"
import { newsletterRoutes } from "./newsletter/routes"
import { favoriteRoutes } from "./favorites/routes"
import { landingRoutes } from "./landing/routes"

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true, trustProxy: true })
  // Load env up front so plugins (cors, metrics, telemetry, storage) can read it.
  const env = loadEnv()
  await app.register(cors, {
    origin: env.CORS_ALLOWED_ORIGINS,
    credentials: true,
  })
  // Helmet: HSTS + frameguard + nosniff. CSP off — the API serves JSON and the
  // Swagger UI needs inline scripts, which a strict CSP would break.
  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(swaggerPlugin)
  if (env.METRICS_ENABLED) {
    await app.register(metricsPlugin)
  } else if (env.NODE_ENV !== "production") {
    // In dev / staging, expose /metrics by default so Prometheus scrapes and
    // browser dev-tools probes never 404. The env flag stays for prod cost control.
    await app.register(metricsPlugin)
  }
  // Standalone metrics+health server on env.METRICS_PORT so Prometheus can scrape
  // a dedicated port without contending with Fastify routes (AGENTS.md §1).
  let metricsServer: { close: () => Promise<void> } | undefined
  if (env.METRICS_ENABLED) {
    metricsServer = startMetricsServer(env)
    app.log.info({ port: env.METRICS_PORT }, "metrics server listening")
    app.addHook("onClose", async () => {
      await metricsServer?.close().catch(() => {})
    })
  }
  // Initialize OpenTelemetry (no-op when METRICS_ENABLED=false or NODE_ENV=test)
  initTelemetry(env)
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
  // Ensure object storage bucket exists before any route that uploads files runs
  // (presignPut presumes the bucket is present; transporter/hotels/rentals rely on it).
  await getStorage().ensureBucket()
  await app.register(authRoutes, { prefix: "/api/v1" })
  await app.register(searchRoutes, { prefix: "/api/v1" })
  await app.register(bookingRoutes, { prefix: "/api/v1" })
  await app.register(paymentRoutes, { prefix: "/api/v1" })
  // webhooks use same /api/v1 prefix so notify_url is ${API_URL}/api/v1/webhooks/{provider}
  await app.register(notchpayWebhookRoutes, { prefix: "/api/v1" })
  await app.register(cinetpayWebhookRoutes, { prefix: "/api/v1" })
  await app.register(adminRoutes, { prefix: "/api/v1" })
  await app.register(adminSettingsRoutes, { prefix: "/api/v1" })
  await app.register(transporterRoutes, { prefix: "/api/v1" })
  await app.register(ticketLookupRoutes, { prefix: "/api/v1" })
  await app.register(dashboardRoutes, { prefix: "/api/v1" })
  await app.register(meTicketRoutes, { prefix: "/api/v1" })
  await app.register(meNotificationRoutes, { prefix: "/api/v1" })
  await app.register(meProfileRoutes, { prefix: "/api/v1" })
  await app.register(partnerApplicationRoutes, { prefix: "/api/v1" })
  await app.register(partnerServiceRoutes, { prefix: "/api/v1" })
  await app.register(placesRoutes, { prefix: "/api/v1" })
  await app.register(agenciesRoutes, { prefix: "/api/v1" })
  await app.register(hotelRoutes, { prefix: "/api/v1" })
  await app.register(rentalRoutes, { prefix: "/api/v1" })
  await app.register(parcelRoutes, { prefix: "/api/v1" })
  await app.register(eventRoutes, { prefix: "/api/v1" })
  await app.register(insuranceRoutes, { prefix: "/api/v1" })
  await app.register(intraurbanRoutes, { prefix: "/api/v1" })
  await app.register(contactRoutes, { prefix: "/api/v1" })
  await app.register(newsletterRoutes, { prefix: "/api/v1" })
  await app.register(favoriteRoutes, { prefix: "/api/v1" })
  await app.register(landingRoutes, { prefix: "/api/v1" })
  await app.register(reviewRoutes, { prefix: "/api/v1" })
  app.get("/health", async () => ({ status: "ok" }))
  return app
}
