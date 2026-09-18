/**
 * Reviews service — implements multi-rating.
 *
 * Per the user directive ("there have multiple rating there have multiple
 * agencies like general buca touristic global princess voyage etc all of
 * them do reaseaches"), each transporter can be rated independently of its
 * trips, and each trip can be rated independently of its transporter. Both
 * rows are independent — re-rating is an upsert.
 *
 * ACID: every write happens inside `prisma.$transaction([])`. The
 * `ratingAvg` / `ratingCount` aggregates on `Transporter` and `Trip` are
 * kept in sync by a Postgres trigger (see migration
 * 20260918000000_reviews_seats_metadata).
 */
import { prisma } from "@camermove/db"
import { cacheKey, getCached, invalidateCache, setCached } from "../lib/cache.js"

export interface ReviewAuthor {
  id: string
  firstName: string | null
  lastName: string | null
}

export interface ReviewItem {
  id: string
  rating: number
  punctuality: number | null
  comfort: number | null
  cleanliness: number | null
  service: number | null
  comment: string | null
  createdAt: string
  author: ReviewAuthor
}

export interface ReviewListResponse {
  items: ReviewItem[]
  page: number
  limit: number
  total: number
  totalPages: number
  ratingAvg: number | null
  ratingCount: number
}

/** Upsert (user, target) review. Returns the resulting row. */
export async function upsertReview(userId: string, input: {
  target: "trip" | "transporter"
  tripId?: string
  transporterId?: string
  bookingId: string
  rating: number
  punctuality?: number
  comfort?: number
  cleanliness?: number
  service?: number
  comment?: string
}) {
  if (input.target === "trip" && !input.tripId) {
    const err = new Error("tripId requis pour target=trip")
    ;(err as Error & { statusCode: number }).statusCode = 400
    throw err
  }
  if (input.target === "transporter" && !input.transporterId) {
    const err = new Error("transporterId requis pour target=transporter")
    ;(err as Error & { statusCode: number }).statusCode = 400
    throw err
  }

  const where =
    input.target === "trip"
      ? { userId_tripId_target: { userId, tripId: input.tripId!, target: "trip" as const } }
      : { userId_transporterId_target: { userId, transporterId: input.transporterId!, target: "transporter" as const } }
  const data = {
    userId,
    target: input.target,
    tripId: input.target === "trip" ? input.tripId! : null,
    transporterId: input.target === "transporter" ? input.transporterId! : null,
    bookingId: input.bookingId ?? null,
    rating: input.rating,
    punctuality: input.punctuality ?? null,
    comfort: input.comfort ?? null,
    cleanliness: input.cleanliness ?? null,
    service: input.service ?? null,
    comment: input.comment ?? null,
    isPublished: true,
  }

  const review = await prisma.$transaction(async (tx) => {
    // Verified-stay gate (bookingId is required by schema): the booking must
    // exist, belong to the rater, and match the rated trip/transporter.
    // Only confirmed (travelled) bookings can rate.
    const bk = await tx.booking.findFirst({
      where: { id: input.bookingId, userId },
      select: { id: true, tripId: true, status: true, trip: { select: { transportId: true } } },
    })
    if (!bk) {
      const err = new Error("Réservation introuvable ou non autorisée")
      ;(err as Error & { statusCode: number }).statusCode = 403
      throw err
    }
    if (bk.status !== "confirmed") {
      const err = new Error("Seuls les voyages effectués peuvent être notés")
      ;(err as Error & { statusCode: number }).statusCode = 403
      throw err
    }
    if (input.target === "trip" && bk.tripId !== input.tripId) {
      const err = new Error("La réservation ne correspond pas à ce trajet")
      ;(err as Error & { statusCode: number }).statusCode = 403
      throw err
    }
    if (input.target === "transporter" && bk.trip.transportId !== input.transporterId) {
      const err = new Error("La réservation ne correspond pas à cette agence")
      ;(err as Error & { statusCode: number }).statusCode = 403
      throw err
    }
    return tx.review.upsert({
      where,
      update: data,
      create: data,
      select: { id: true, rating: true, createdAt: true },
    })
  })

  // Invalidate cached aggregates so the new rating is visible immediately.
  await invalidateCache(`reviews:*id=${input.target === "trip" ? input.tripId : input.transporterId}*`).catch(() => {})
  await invalidateCache("agencies*").catch(() => {})

  return review
}

async function fetchReviewsForTrip(tripId: string, page: number, limit: number): Promise<ReviewListResponse> {
  const [items, total, agg] = await Promise.all([
    prisma.review.findMany({
      where: { tripId, target: "trip", isPublished: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        rating: true,
        punctuality: true,
        comfort: true,
        cleanliness: true,
        service: true,
        comment: true,
        createdAt: true,
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.review.count({ where: { tripId, target: "trip", isPublished: true } }),
    prisma.trip.findUnique({ where: { id: tripId }, select: { ratingAvg: true, ratingCount: true } }),
  ])
  return {
    items: items.map((r) => ({
      id: r.id,
      rating: r.rating,
      punctuality: r.punctuality,
      comfort: r.comfort,
      cleanliness: r.cleanliness,
      service: r.service,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      author: { id: r.user.id, firstName: r.user.firstName, lastName: r.user.lastName },
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    ratingAvg: agg?.ratingAvg ? Number(agg.ratingAvg) : null,
    ratingCount: agg?.ratingCount ?? 0,
  }
}

async function fetchReviewsForTransporter(transporterId: string, page: number, limit: number): Promise<ReviewListResponse> {
  const [items, total, agg] = await Promise.all([
    prisma.review.findMany({
      where: { transporterId, target: "transporter", isPublished: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        rating: true,
        punctuality: true,
        comfort: true,
        cleanliness: true,
        service: true,
        comment: true,
        createdAt: true,
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.review.count({ where: { transporterId, target: "transporter", isPublished: true } }),
    prisma.transporter.findUnique({
      where: { id: transporterId },
      select: { ratingAvg: true, ratingCount: true },
    }),
  ])
  return {
    items: items.map((r) => ({
      id: r.id,
      rating: r.rating,
      punctuality: r.punctuality,
      comfort: r.comfort,
      cleanliness: r.cleanliness,
      service: r.service,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      author: { id: r.user.id, firstName: r.user.firstName, lastName: r.user.lastName },
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    ratingAvg: agg?.ratingAvg ? Number(agg.ratingAvg) : null,
    ratingCount: agg?.ratingCount ?? 0,
  }
}

export async function listTripReviews(tripId: string, page: number, limit: number): Promise<ReviewListResponse> {
  const key = cacheKey("reviews", { kind: "trip", id: tripId, page, limit })
  const cached = await getCached<ReviewListResponse>(key)
  if (cached) return cached
  const fresh = await fetchReviewsForTrip(tripId, page, limit)
  await setCached(key, fresh, 60).catch(() => {})
  return fresh
}

export async function listTransporterReviews(transporterId: string, page: number, limit: number): Promise<ReviewListResponse> {
  const key = cacheKey("reviews", { kind: "transporter", id: transporterId, page, limit })
  const cached = await getCached<ReviewListResponse>(key)
  if (cached) return cached
  const fresh = await fetchReviewsForTransporter(transporterId, page, limit)
  await setCached(key, fresh, 60).catch(() => {})
  return fresh
}

/** Quick aggregate for a list of transporter ids — used by the agencies directory. */
export async function transporterAggregates(ids: string[]): Promise<Record<string, { ratingAvg: number | null; ratingCount: number }>> {
  if (ids.length === 0) return {}
  const rows = await prisma.transporter.findMany({
    where: { id: { in: ids } },
    select: { id: true, ratingAvg: true, ratingCount: true },
  })
  const out: Record<string, { ratingAvg: number | null; ratingCount: number }> = {}
  for (const r of rows) {
    out[r.id] = {
      ratingAvg: r.ratingAvg ? Number(r.ratingAvg) : null,
      ratingCount: r.ratingCount,
    }
  }
  return out
}