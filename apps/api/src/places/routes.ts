import type { FastifyInstance } from "fastify"
import { PlacesAutocompleteQuery } from "./schema"
import { searchPlaces } from "./service"

export async function placesRoutes(app: FastifyInstance) {
  app.get("/places/autocomplete", async (req) => {
    const query = PlacesAutocompleteQuery.parse(req.query)
    return searchPlaces(query)
  })
}
