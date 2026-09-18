import type { FastifyInstance } from "fastify"
import { ReviewCreateInput, ReviewListQuery, ReviewTransporterParams, ReviewTripParams } from "./schema.js"
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

  // NOTE: no Fastify `schema:` block — this codebase validates with
  // Zod `.parse()` inside handlers (a raw Zod object is not a JSON schema
  // and crashes route registration). Shape errors surface as 400 via parse.
  app.post("/reviews", {
    preHandler: app.requireAuth(),
  }, async (req) => {
    const userId = (req as unknown as { user: { id: string } }).user.id
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    const input = ReviewCreateInput.parse(req.body)
    const review = await upsertReview(userId, input)
    req.log.info({ ...meta, userId, target: input.target, reviewId: review.id }, "review.upsert")
    return { id: review.id, rating: review.rating, createdAt: review.createdAt.toISOString() }
  })
}