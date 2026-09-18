import { z } from "zod"

/**
 * /agencies — list, filter, and detail. Backed by the SSOT registry in
 * `@camermove/shared/agencies`, enriched with live aggregates from Prisma
 * (ratings, active departure counts).
 */
export const AgencyListQuery = z.object({
  city: z.string().min(1).max(100).optional(),
  category: z.enum(["interurban", "urban", "mixed", "parcel", "rental", "vip"]).optional(),
  q: z.string().min(1).max(100).optional(),
})

export const AgencySlugParams = z.object({
  slug: z.string().min(1).max(100),
})

/** Backward-compatible city-only filter. */
export const AgencyCityQuery = z.object({
  city: z.string().min(1).max(100),
})