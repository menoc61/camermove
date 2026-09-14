import type { FastifyInstance } from "fastify"
import { LandingRailsQuery } from "./schema.js"
import { getLandingRail, getLandingStats } from "./service.js"

export async function landingRoutes(app: FastifyInstance) {
  app.get("/landing/stats", async (req) => {
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.(
      { ...meta },
      "landing.stats",
    )
    return getLandingStats()
  })

  app.get("/landing/rails", async (req) => {
    const q = LandingRailsQuery.parse(req.query)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.(
      { ...meta, type: q.type },
      "landing.rails",
    )
    return getLandingRail(q.type)
  })
}
