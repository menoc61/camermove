import { findSearchableTrips, countSearchableTrips } from "./repository"
import { BadRequestError } from "@camermove/config"
import type { SearchQuery } from "./schema"

export function parseDate(iso: string): { start: Date; end: Date } {
  const d = new Date(iso + "T00:00:00.000Z")
  if (Number.isNaN(d.getTime())) throw new BadRequestError("Date invalide")
  const end = new Date(d.getTime() + 86400000)
  return { start: d, end }
}

export async function searchTrips(query: SearchQuery) {
  const { start, end } = parseDate(query.date)
  const skip = (query.page - 1) * query.perPage
  const [items, total] = await Promise.all([
    findSearchableTrips({
      origin: query.origin,
      destination: query.destination,
      dateStart: start,
      dateEnd: end,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      sort: query.sortBy,
      skip,
      take: query.perPage,
      pax: query.pax,
    }),
    countSearchableTrips({
      origin: query.origin,
      destination: query.destination,
      dateStart: start,
      dateEnd: end,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      pax: query.pax,
    }),
  ])
  return {
    items: items.map((t) => ({
      id: t.id,
      departureAt: t.departureAt,
      price: t.price,
      totalSeats: t.totalSeats,
      seatsAvailable: t.seatAvailability?.seatsAvailable ?? 0,
      transporterId: t.transportId,
      companyName: (t as unknown as { transport: { companyName: string } }).transport.companyName,
      vehicleTypeInfo: t.vehicleTypeInfo,
    })),
    pagination: { page: query.page, perPage: query.perPage, total, totalPages: Math.ceil(total / query.perPage) },
  }
}
