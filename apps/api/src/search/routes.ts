import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { ForbiddenError } from "@camermove/config"
import { SearchQuery } from "./schema"
import { searchTrips } from "./service"
import { AdvancedSearchQuery, advancedSearch, BulkActionSchema, bulkTripAction } from "./advanced"
import { TripStatusActionSchema, setTripStatus } from "./trip-status"
import { getCached, setCached, cacheKey } from "../lib/cache"
import { observeSearch } from "@camermove/observability"

const TripIdParams = z.object({ id: z.string().cuid() })

export async function searchRoutes(app: FastifyInstance) {
  app.get("/search", async (req) => {
    const query = SearchQuery.parse(req.query)
    const meta = (req as unknown as { meta?: Record<string, unknown> }).meta ?? {}
    req.log.info(
      { ...meta, origin: query.origin, destination: query.destination, date: query.date, pax: query.pax, sort: query.sortBy, page: query.page, limit: query.perPage, minPrice: query.minPrice, maxPrice: query.maxPrice },
      "search.list",
    )
    observeSearch(query.origin, query.destination)
    const key = cacheKey("search", query as unknown as Record<string, unknown>)
    const cached = await getCached<Record<string, unknown>>(key)
    if (cached) return { ...(cached as object), meta: { cached: true } }
    const result = await searchTrips(query)
    await setCached(key, result, 60).catch(() => {})
    return { ...result, meta: { cached: false } }
  })

  app.get("/search/advanced", async (req) => {
    const query = AdvancedSearchQuery.parse(req.query)
    const meta = (req as unknown as { meta?: Record<string, unknown> }).meta ?? {}
    req.log.info(
      { ...meta, origin: query.origin, destination: query.destination, q: query.q, pax: query.pax, filters: { minPrice: query.minPrice, maxPrice: query.maxPrice, transporterId: query.transporterId, vehicleType: query.vehicleType }, sort: query.sortBy ?? query.orderBy, page: query.page, limit: query.perPage },
      "search.advanced",
    )
    observeSearch(query.origin, query.destination)
    const key = cacheKey("search-advanced", query as unknown as Record<string, unknown>)
    const cached = await getCached<Record<string, unknown>>(key)
    if (cached) {
      if (cached && typeof cached === "object" && "meta" in (cached as object)) return { ...(cached as object), meta: { cached: true } }
      return { ...(cached as object), meta: { cached: true } }
    }
    const result = await advancedSearch(query)
    await setCached(key, result, 60).catch(() => {})
    return result
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
    const meta = (req as unknown as { meta?: Record<string, unknown> }).meta
    req.log.info({ ...meta, entityId: id }, "trip.get")
    const { prisma } = await import("@camermove/db")
    const trip = await prisma.trip.findUnique({
      where: { id },
      select: {
        id: true,
        departureAt: true,
        arrivalEstimateAt: true,
        price: true,
        totalSeats: true,
        transportId: true,
        vehicleTypeInfo: true,
        departurePointInfo: true,
        status: true,
        route: { select: { id: true, originCity: true, destinationCity: true } },
        transport: { select: { id: true, companyName: true } },
        seatAvailability: { select: { seatsAvailable: true, seatsHeld: true, seatsBooked: true } },
      },
    })
    if (!trip) {
      const { NotFoundError } = await import("@camermove/config")
      throw new NotFoundError("Trajet introuvable")
    }
    return trip
  })
}
