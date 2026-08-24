import Fastify, { type FastifyInstance } from "fastify"
import cors from "@fastify/cors"
import { loadEnv, AppError } from "@camermove/config"
import { authRoutes } from "./auth/routes"
import { authPlugin } from "./auth/plugins"
import { searchRoutes } from "./search/routes"
import { swaggerPlugin } from "./plugins/swagger"
import { metricsPlugin } from "./plugins/metrics"
import { metadataPlugin } from "./plugins/metadata"

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true })
  await app.register(cors, { origin: true, credentials: true })
  await app.register(swaggerPlugin)
  const env = loadEnv()
  if ((env as unknown as { METRICS_ENABLED: boolean }).METRICS_ENABLED) {
    await app.register(metricsPlugin)
  }
  await app.register(metadataPlugin)
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
  app.get("/health", async () => ({ status: "ok" }))
  return app
}
