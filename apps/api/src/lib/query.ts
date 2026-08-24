import { z } from "zod"

export const OrderBySchema = z
  .string()
  .regex(/^[a-zA-Z_]+\.(asc|desc)(,[a-zA-Z_]+\.(asc|desc))*$/)
  .optional()
  .describe("Comma-separated field.direction, e.g. price.asc,departureAt.desc")

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

export const FilterSchema = z.object({
  filter: z.record(z.string()).optional(),
  q: z.string().optional().describe("Full-text search"),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  groupBy: z.string().optional().describe("Field to group by, e.g. transporterId"),
})

export type QueryInput = z.infer<typeof PaginationSchema> &
  z.infer<typeof FilterSchema> & { orderBy?: string; sortBy?: string }

export function parseOrderBy(orderBy?: string): Array<{ field: string; direction: "asc" | "desc" }> {
  if (!orderBy) return []
  return orderBy.split(",").map((part) => {
    const [field, dir] = part.split(".")
    return { field: field!, direction: (dir as "asc" | "desc") ?? "asc" }
  })
}

export function toPrismaOrderBy(orderBy?: string): Record<string, "asc" | "desc">[] | undefined {
  const parsed = parseOrderBy(orderBy)
  if (parsed.length === 0) return undefined
  return parsed.map(({ field, direction }) => ({ [field]: direction }))
}

export function buildPagination(input: { page?: number; perPage?: number; limit?: number; offset?: number }) {
  if (input.limit !== undefined || input.offset !== undefined) {
    return { take: input.limit ?? 20, skip: input.offset ?? 0 }
  }
  const page = input.page ?? 1
  const perPage = input.perPage ?? 20
  return { take: perPage, skip: (page - 1) * perPage, page, perPage }
}

export const BulkActionSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
  action: z.enum(["delete", "archive", "activate", "deactivate"]),
})

export type BulkActionInput = z.infer<typeof BulkActionSchema>
