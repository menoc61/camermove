import type { FastifyInstance } from "fastify"
import { AgencySlugParams, AgencyListQuery } from "./schema.js"
import { getAgencyDetail, listAllAgencies } from "./service.js"

/**
 * Agencies endpoints — REGISTRY-backed.
 *
 * - GET /agencies                  — list, filter by city/category/q
 * - GET /agencies/:slug            — full detail (description, branchCities, reviews)
 *
 * The list endpoint accepts the same query schema used by `/results` and the
 * agencies directory page. Detail is slug-driven, never free text — the
 * slug is the canonical key (central source of data).
 */
export async function agenciesRoutes(app: FastifyInstance) {
  app.get("/agencies", async (req) => {
    const q = AgencyListQuery.parse(req.query)
    return listAllAgencies({ city: q.city, category: q.category, q: q.q })
  })

  app.get("/agencies/:slug", async (req) => {
    const { slug } = AgencySlugParams.parse(req.params)
    const detail = await getAgencyDetail(slug)
    if (!detail) {
      const err = new Error("Agence introuvable")
      ;(err as Error & { statusCode: number }).statusCode = 404
      throw err
    }
    return detail
  })
}