import { z } from "zod"
import { zId, dateRange } from "@camermove/shared"

/**
 * Reviews API — both per-trip and per-transporter ratings live here.
 *
 * Multi-rating: a traveller can submit one review per (user, trip) pair AND
 * one per (user, transporter) pair. They are independent rows with
 * composite unique indexes so re-rating is an UPDATE not a duplicate.
 *
 * ACID: rating writes happen inside Prisma `$transaction`. Sub-scores are
 * optional; the main `rating` field is mandatory between 1 and 5. Aggregate
 * `ratingAvg`/`ratingCount` fields on `Transporter` and `Trip` are kept in
 * sync by a Postgres trigger (migration 20260918000000_reviews_seats_metadata).
 */
export const ReviewTripParams = z.object({ tripId: zId })
export const ReviewTransporterParams = z.object({ transporterId: zId })

const subScore = z.number().int().min(1).max(5).optional()

// Presence rule lives here (Zod, 400 on shape violation) AND in upsertReview
// (service layer). No Fastify `schema:` block anywhere — see routes.ts.
export const ReviewCreateInput = z.object({
  target: z.enum(["trip", "transporter"]),
  tripId: zId.optional(),
  transporterId: zId.optional(),
  // Verified-stay only: every rating must attach the booking it comes from
  // (anti-fraud; competitors gate on verified stays the same way).
  bookingId: zId,
  rating: z.number().int().min(1).max(5),
  punctuality: subScore,
  comfort: subScore,
  cleanliness: subScore,
  service: subScore,
  comment: z.string().max(2000).optional(),
}).superRefine((val, ctx) => {
  if (val.target === "trip" && !val.tripId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tripId"], message: "tripId requis pour target=trip" })
  }
  if (val.target === "transporter" && !val.transporterId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["transporterId"], message: "transporterId requis pour target=transporter" })
  }
})

export const ReviewListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  includeUnpublished: z.coerce.boolean().optional().default(false),
})

export const ReviewResponse = z.object({
  items: z.array(z.object({
    id: zId,
    rating: z.number().int(),
    punctuality: z.number().int().nullable(),
    comfort: z.number().int().nullable(),
    cleanliness: z.number().int().nullable(),
    service: z.number().int().nullable(),
    comment: z.string().nullable(),
    createdAt: z.string(),
    author: z.object({
      id: zId,
      firstName: z.string().nullable(),
      lastName: z.string().nullable(),
    }),
  })),
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  ratingAvg: z.number().nullable(),
  ratingCount: z.number().int(),
})

export const ReviewUpsertResponse = z.object({
  id: zId,
  rating: z.number().int(),
  createdAt: z.string(),
})

export const ReviewIdParams = z.object({ id: zId })

const updateScore = z.number().int().min(1).max(5).optional()

export const ReviewUpdateInput = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  punctuality: updateScore,
  comfort: updateScore,
  cleanliness: updateScore,
  service: updateScore,
  comment: z.string().max(2000).nullable().optional(),
})

// Re-exported for callers
export { dateRange }
