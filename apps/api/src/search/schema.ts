import { z } from "zod"
import { loadEnv } from "@camermove/config"

function envMax(key: string, fallback: number): number {
  try {
    const env = loadEnv() as Record<string, unknown>
    const v = env[key]
    return typeof v === "number" && v > 0 ? v : fallback
  } catch {
    return fallback
  }
}

export const SearchQuery = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pax: z.coerce.number().int().min(1).default(1),
  sortBy: z.enum(["price_asc", "price_desc", "departure_asc"]).default("price_asc"),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(envMax("PAGINATION_MAX_PER_PAGE", 100)).default(envMax("PAGINATION_DEFAULT_PER_PAGE", 20)),
})
export type SearchQuery = z.infer<typeof SearchQuery>
