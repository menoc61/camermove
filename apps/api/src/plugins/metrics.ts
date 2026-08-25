import fp from "fastify-plugin"
import fastifyMetrics from "fastify-metrics"
import type { FastifyInstance } from "fastify"
export const metricsPlugin = fp(async (app: FastifyInstance) => {
  await app.register(fastifyMetrics, { endpoint: "/metrics" })
})
