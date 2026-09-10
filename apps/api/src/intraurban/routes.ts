import type { FastifyInstance } from "fastify"
import { listUrbanLines, urbanSchedule } from "./service"
import { ScheduleQuery } from "./schema"

export async function intraurbanRoutes(app: FastifyInstance) {
  // Public — no auth, like /search
  app.get("/intraurban/lines", async (req) => {
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta }, "intraurban.lines")
    return listUrbanLines()
  })

  app.get("/intraurban/schedule", async (req) => {
    const raw = req.query as Record<string, unknown>
    const parsed = ScheduleQuery.parse({ ...raw, dest: (raw.dest as string) ?? (raw.destination as string) })
    const dest = parsed.dest ?? parsed.destination
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, origin: parsed.origin, dest, date: parsed.date, pax: parsed.pax }, "intraurban.schedule")
    return urbanSchedule({ origin: parsed.origin, dest, date: parsed.date, pax: parsed.pax })
  })

  // Alias for existing search clients: /intraurban/search mirrors /search but urban-only
  app.get("/intraurban/search", async (req) => {
    const raw = req.query as Record<string, unknown>
    const parsed = ScheduleQuery.parse({ ...raw, dest: (raw.dest as string) ?? (raw.destination as string) })
    const dest = parsed.dest ?? parsed.destination
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, origin: parsed.origin, dest, date: parsed.date }, "intraurban.search")
    const items = await urbanSchedule({ origin: parsed.origin, dest, date: parsed.date, pax: parsed.pax })
    return { items, meta: { isUrban: true, flatFare: true, holdMinutes: 5 } }
  })
}
