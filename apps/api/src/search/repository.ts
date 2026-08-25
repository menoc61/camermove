import { prisma } from "@camermove/db"

export function findSearchableTrips(input: {
  origin: string
  destination: string
  dateStart: Date
  dateEnd: Date
  minPrice?: number
  maxPrice?: number
  sort: "price_asc" | "price_desc" | "departure_asc"
  skip: number
  take: number
  pax: number
}) {
  const priceFilter: Record<string, number> = {}
  if (input.minPrice !== undefined) priceFilter.gte = input.minPrice
  if (input.maxPrice !== undefined) priceFilter.lte = input.maxPrice

  return prisma.trip.findMany({
    where: {
      status: "active",
      route: {
        originCity: { equals: input.origin, mode: "insensitive" as const },
        destinationCity: { equals: input.destination, mode: "insensitive" as const },
      },
      departureAt: { gte: input.dateStart, lte: input.dateEnd },
      ...(Object.keys(priceFilter).length > 0 ? { price: priceFilter } : {}),
      seatAvailability: { seatsAvailable: { gte: input.pax } },
    },
    orderBy: input.sort === "departure_asc" ? { departureAt: "asc" } : { price: input.sort === "price_asc" ? "asc" : "desc" },
    skip: input.skip,
    take: input.take,
    include: { route: true, transport: { select: { companyName: true, id: true } }, seatAvailability: true },
  })
}

export async function countSearchableTrips(input: {
  origin: string
  destination: string
  dateStart: Date
  dateEnd: Date
  minPrice?: number
  maxPrice?: number
  pax: number
}) {
  const priceFilter2: Record<string, number> = {}
  if (input.minPrice !== undefined) priceFilter2.gte = input.minPrice
  if (input.maxPrice !== undefined) priceFilter2.lte = input.maxPrice

  return prisma.trip.count({
    where: {
      status: "active",
      route: {
        originCity: { equals: input.origin, mode: "insensitive" as const },
        destinationCity: { equals: input.destination, mode: "insensitive" as const },
      },
      departureAt: { gte: input.dateStart, lte: input.dateEnd },
      ...(Object.keys(priceFilter2).length > 0 ? { price: priceFilter2 } : {}),
      seatAvailability: { seatsAvailable: { gte: input.pax } },
    },
  })
}
