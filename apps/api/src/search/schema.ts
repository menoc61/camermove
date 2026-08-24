import { z } from "zod"

export const SearchQuery = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pax: z.coerce.number().int().min(1).default(1),
  sortBy: z.enum(["price_asc", "price_desc", "departure_asc"]).default("price_asc"),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})
export type SearchQuery = z.infer<typeof SearchQuery>
