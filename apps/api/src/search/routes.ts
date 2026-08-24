import type { FastifyInstance } from "fastify"
import { SearchQuery } from "./schema"
import { searchTrips } from "./service"
import { AdvancedSearchQuery, advancedSearch, BulkActionSchema, bulkTripAction } from "./advanced"

export async function searchRoutes(app: FastifyInstance) {
  app.get("/search", async (req) => {
    const query = SearchQuery.parse(req.query)
    return searchTrips(query)
  })

  app.get("/search/advanced", async (req) => {
    const query = AdvancedSearchQuery.parse(req.query)
    return advancedSearch(query)
  })

  app.post("/trips/bulk", async (req) => {
    const body = BulkActionSchema.parse(req.body)
    return bulkTripAction(body)
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
