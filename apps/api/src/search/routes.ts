import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { ForbiddenError } from "@camermove/config"
import { SearchQuery } from "./schema"
import { searchTrips } from "./service"
import { AdvancedSearchQuery, advancedSearch, BulkActionSchema, bulkTripAction } from "./advanced"
import { TripStatusActionSchema, setTripStatus } from "./trip-status"

const TripIdParams = z.object({ id: z.string().cuid() })

export async function searchRoutes(app: FastifyInstance) {
  app.get("/search", async (req) => {
    const query = SearchQuery.parse(req.query)
    return searchTrips(query)
  })

  app.get("/search/advanced", async (req) => {
    const query = AdvancedSearchQuery.parse(req.query)
    return advancedSearch(query)
  })

  // Admin-only bulk primitive — cross-owner operations are never transporter-reachable
  app.post("/trips/bulk", { preHandler: app.requireAuth() }, async (req) => {
    const body = BulkActionSchema.parse(req.body)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    if (user.role !== "admin" && user.role !== "super_admin") throw new ForbiddenError("Accès refusé")
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, ids: body.ids, action: body.action, actorId: user.id }, "trips.bulk")
    const result = await bulkTripAction(body)
    try {
      const { prisma } = await import("@camermove/db")
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: `trip.bulk.${body.action}`,
          entityType: "Trip",
          entityId: body.ids.join(","),
          metadata: { ids: body.ids, action: body.action, affected: result.affected } as never,
        },
      })
    } catch {}
    return result
  })

  // Transporter-owned / admin pause-close-reopen (SC3)
  app.post("/trips/:id/status", { preHandler: app.requireAuth() }, async (req) => {
    const { id } = TripIdParams.parse(req.params)
    const body = TripStatusActionSchema.parse(req.body)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, entityId: id, userId: user.id, role: user.role }, "trip.status")
    return setTripStatus({ tripId: id, action: body.action, actor: { id: user.id, role: user.role } })
  })

  app.get("/trips/:id", async (req) => {
    const { id } = req.params as { id: string }
    const { prisma } = await import("@camermove/db")
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: { route: true, transport: { select: { companyName: true } }, seatAvailability: true },
    })
    if (!trip) {
      const { NotFoundError } = await import("@camermove/config")
      throw new NotFoundError("Trajet introuvable")
    }
    return trip
  })
}
