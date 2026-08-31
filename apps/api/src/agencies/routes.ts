import type { FastifyInstance } from "fastify"
import { AgencyQuery } from "./schema"
import { listAgencies } from "./service"

export async function agenciesRoutes(app: FastifyInstance) {
  app.get("/agencies", async (req) => {
    const query = AgencyQuery.parse(req.query)
    return listAgencies(query)
  })
}
