import { z } from "zod"
import { prisma } from "@camermove/db"
import { BadRequestError } from "@camermove/config"

export const AdvancedSearchQuery = z.object({
  origin: z.string().optional(),
  destination: z.string().optional(),
  q: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  pax: z.coerce.number().int().min(1).default(1),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  transporterId: z.string().optional(),
  vehicleType: z.string().optional(),
  sortBy: z.enum(["price_asc", "price_desc", "departure_asc"]).optional(),
  orderBy: z.string().optional(),
  groupBy: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  status: z.string().optional().default("active"),
})

export type AdvancedSearchQuery = z.infer<typeof AdvancedSearchQuery>

function parseDateRange(input: AdvancedSearchQuery): { start: Date; end: Date } | null {
  if (input.date) {
    const d = new Date(input.date + "T00:00:00.000Z")
    if (Number.isNaN(d.getTime())) throw new BadRequestError("Date invalide")
    return { start: d, end: new Date(d.getTime() + 86400000) }
  }
  if (input.dateFrom || input.dateTo) {
    const start = input.dateFrom ? new Date(input.dateFrom) : new Date(0)
    const end = input.dateTo ? new Date(input.dateTo) : new Date("2099-12-31")
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new BadRequestError("Date invalide")
    return { start, end }
  }
  return null
}

export async function advancedSearch(query: AdvancedSearchQuery) {
  const dateRange = parseDateRange(query)
  const pagination = query.limit !== undefined || query.offset !== undefined
    ? { take: query.limit ?? 20, skip: query.offset ?? 0, page: 1, perPage: query.limit ?? 20 }
    : { take: query.perPage, skip: (query.page - 1) * query.perPage, page: query.page, perPage: query.perPage }

  const where: Record<string, unknown> = {
    status: query.status ?? "active",
    ...(query.transporterId ? { transportId: query.transporterId } : {}),
    ...(query.vehicleType ? { vehicleTypeInfo: { contains: query.vehicleType, mode: "insensitive" } } : {}),
    ...(dateRange ? { departureAt: { gte: dateRange.start, lte: dateRange.end } } : {}),
    ...(query.minPrice !== undefined || query.maxPrice !== undefined
      ? { price: { gte: query.minPrice ?? 0, lte: query.maxPrice ?? 9999999 } }
      : {}),
    ...(query.q
      ? {
          OR: [
            { route: { originCity: { contains: query.q, mode: "insensitive" } } },
            { route: { destinationCity: { contains: query.q, mode: "insensitive" } } },
            { transport: { companyName: { contains: query.q, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(query.origin || query.destination
      ? {
          route: {
            ...(query.origin ? { originCity: { contains: query.origin, mode: "insensitive" } } : {}),
            ...(query.destination ? { destinationCity: { contains: query.destination, mode: "insensitive" } } : {}),
          },
        }
      : {}),
    seatAvailability: { seatsAvailable: { gte: query.pax } },
  }

  let orderBy: Record<string, "asc" | "desc"> | undefined
  if (query.orderBy) {
    const [field, dir] = query.orderBy.split(".")
    orderBy = { [field!]: (dir as "asc" | "desc") ?? "asc" }
  } else if (query.sortBy === "price_desc") orderBy = { price: "desc" }
  else if (query.sortBy === "departure_asc") orderBy = { departureAt: "asc" }
  else orderBy = { price: "asc" }

  const [items, total] = await Promise.all([
    prisma.trip.findMany({
      where: where as never,
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
      include: { route: true, transport: { select: { companyName: true, id: true } }, seatAvailability: true },
    }),
    prisma.trip.count({ where: where as never }),
  ])

  const mapped = items.map((t) => ({
    id: t.id,
    departureAt: t.departureAt,
    price: t.price,
    totalSeats: t.totalSeats,
    seatsAvailable: t.seatAvailability?.seatsAvailable ?? 0,
    transporterId: t.transportId,
    companyName: (t as unknown as { transport: { companyName: string } }).transport.companyName,
    vehicleTypeInfo: t.vehicleTypeInfo,
    route: t.route,
  }))

  if (query.groupBy) {
    const grouped: Record<string, typeof mapped> = {}
    for (const item of mapped) {
      const key = String((item as unknown as Record<string, unknown>)[query.groupBy!] ?? "unknown")
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(item)
    }
    return { grouped, pagination: { page: pagination.page, perPage: pagination.perPage, total, totalPages: Math.ceil(total / pagination.perPage) }, meta: { groupBy: query.groupBy } }
  }

  return {
    items: mapped,
    pagination: { page: pagination.page, perPage: pagination.perPage, total, totalPages: Math.ceil(total / pagination.perPage) },
    meta: { cached: false },
  }
}

export const BulkActionSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
  action: z.enum(["activate", "deactivate", "delete"]),
})

export async function bulkTripAction(input: z.infer<typeof BulkActionSchema>) {
  if (input.action === "delete") {
    const res = await prisma.trip.deleteMany({ where: { id: { in: input.ids } } })
    return { affected: res.count }
  }
  const status = input.action === "activate" ? "active" : "inactive"
  const res = await prisma.trip.updateMany({ where: { id: { in: input.ids } }, data: { status } })
  return { affected: res.count }
}
