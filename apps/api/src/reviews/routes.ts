import type { FastifyInstance } from "fastify"
import { ReviewCreateInput, ReviewListQuery, ReviewResponse, ReviewTransporterParams, ReviewTripParams } from "./schema.js"
import { listTransporterReviews, listTripReviews, upsertReview } from "./service.js"

/**
 * Reviews API.
 *
 * Implements multi-rating per AGENTS.md and the user directive:
 *   • /reviews/transporter/:id          list reviews + aggregates
 *   • /reviews/trip/:id                 list reviews + aggregates
 *   • POST /reviews                     submit/upsert (auth required)
 */
export async function reviewRoutes(app: FastifyInstance) {
  app.get("/reviews/trip/:tripId", async (req) => {
    const { tripId } = ReviewTripParams.parse(req.params)
    const q = ReviewListQuery.parse(req.query)
    return listTripReviews(tripId, q.page, q.limit)
  })

  app.get("/reviews/transporter/:transporterId", async (req) => {
    const { transporterId } = ReviewTransporterParams.parse(req.params)
    const q = ReviewListQuery.parse(req.query)
    return listTransporterReviews(transporterId, q.page, q.limit)
  })

  app.post("/reviews", {
    preHandler: app.requireAuth(),
    schema: {
      body: ReviewCreateInput,
      response: { 200: ReviewResponse },
    },
  }, async (req) => {
    const userId = (req as unknown as { user: { id: string } }).user.id
    const input = (req.body as unknown) as Parameters<typeof upsertReview>[1]
    await upsertReview(userId, input)
    return { ok: true }
  })
}