import type { FastifyInstance } from "fastify"
import { ReviewCreateInput, ReviewIdParams, ReviewListQuery, ReviewTransporterParams, ReviewTripParams, ReviewUpdateInput } from "./schema.js"
import { deleteReview, getReviewById, listTransporterReviews, listTripReviews, upsertReview } from "./service.js"

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

  app.get("/reviews/:id", async (req) => {
    const { id } = ReviewIdParams.parse(req.params)
    return getReviewById(id)
  })

  app.put("/reviews/:id", { preHandler: app.requireAuth() }, async (req) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    const { id } = ReviewIdParams.parse(req.params)
    const patch = ReviewUpdateInput.parse(req.body ?? {})
    const { prisma } = await import("@camermove/db")
    const existing = await prisma.review.findUnique({ where: { id } })
    if (!existing) {
      const { NotFoundError } = await import("@camermove/config")
      throw new NotFoundError("Avis introuvable")
    }
    if (existing.userId !== user.id) {
      const { ForbiddenError } = await import("@camermove/config")
      throw new ForbiddenError("Accès refusé")
    }
    if (!existing.bookingId) {
      const { ForbiddenError } = await import("@camermove/config")
      throw new ForbiddenError("Avis non modifiable")
    }
    const review = await upsertReview(user.id, {
      target: existing.target as "trip" | "transporter",
      tripId: existing.tripId ?? undefined,
      transporterId: existing.transporterId ?? undefined,
      bookingId: existing.bookingId,
      rating: patch.rating ?? existing.rating,
      punctuality: patch.punctuality ?? existing.punctuality ?? undefined,
      comfort: patch.comfort ?? existing.comfort ?? undefined,
      cleanliness: patch.cleanliness ?? existing.cleanliness ?? undefined,
      service: patch.service ?? existing.service ?? undefined,
      comment: patch.comment ?? existing.comment ?? undefined,
    })
    req.log.info({ ...meta, userId: user.id, reviewId: id }, "review.update")
    return { id: review.id, rating: review.rating, createdAt: review.createdAt.toISOString() }
  })

  app.delete("/reviews/:id", { preHandler: app.requireAuth() }, async (req) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    const { id } = ReviewIdParams.parse(req.params)
    req.log.info({ ...meta, userId: user.id, reviewId: id }, "review.delete")
    return deleteReview(id, user)
  })
}