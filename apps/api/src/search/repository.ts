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
  return prisma.trip.findMany({
    where: {
      status: "active",
      route: {
        originCity: { equals: input.origin, mode: "insensitive" as const },
        destinationCity: { equals: input.destination, mode: "insensitive" as const },
      },
      departureAt: { gte: input.dateStart, lte: input.dateEnd },
      price: { gte: input.minPrice ?? 0, lte: input.maxPrice ?? Number.MAX_SAFE_INTEGER },
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
  return prisma.trip.count({
    where: {
      status: "active",
      route: {
        originCity: { equals: input.origin, mode: "insensitive" as const },
        destinationCity: { equals: input.destination, mode: "insensitive" as const },
      },
      departureAt: { gte: input.dateStart, lte: input.dateEnd },
      price: { gte: input.minPrice ?? 0, lte: input.maxPrice ?? Number.MAX_SAFE_INTEGER },
      seatAvailability: { seatsAvailable: { gte: input.pax } },
    },
  })
}
