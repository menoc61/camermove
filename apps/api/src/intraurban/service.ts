import type { Prisma } from "@camermove/db"
import { countActiveTripsForRoute, findFirstTripPrice, findUrbanRoutes, findUrbanSchedule } from "./repository"

/**
 * Intraurban service — typical city bus system.
 * - Flat fare (400-500 XAF), no per-km pricing
 * - High frequency (every 30 min, 05:30-22:00)
 * - Short hold (5 min), ticket valid 2h after departure
 * - Routes are stop-to-stop (neighborhoods), not city-to-city
 */

export interface Line {
  origin: string
  dest: string
  price: number
  transporterId: string
  companyName: string
  tripCountToday: number
}

export async function listUrbanLines(): Promise<Line[]> {
  const routes = await findUrbanRoutes()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today.getTime() + 86400000)
  const now = new Date()
  const remainingFrom = now > today ? now : today // count only departures still catchable
  const lines: Line[] = []
  for (const r of routes) {
    const priceRow = await findFirstTripPrice(r.id)
    const count = await countActiveTripsForRoute(r.id, remainingFrom, tomorrow)
    lines.push({
      origin: r.originCity,
      dest: r.destinationCity,
      price: priceRow?.price ?? 500,
      transporterId: r.transporterId,
      companyName: r.transporter.companyName,
      tripCountToday: count,
    })
  }
  return lines
}

export async function urbanSchedule(input: { origin?: string; dest?: string; date: string; pax?: number }) {
  const date = new Date(input.date + "T00:00:00.000Z")
  const end = new Date(date.getTime() + 86400000)
  // Never offer departures that already left: for today, start from "now" (BUG-22).
  const now = new Date()
  const from = end <= now ? end : date < now ? now : date
  const where: Record<string, unknown> = {
    status: "active",
    departureAt: { gte: from, lt: end },
    price: { lt: 1000 }, // flat urban fare
    route: {
      ...(input.origin ? { originCity: { contains: input.origin, mode: "insensitive" as const } } : {}),
      ...(input.dest ? { destinationCity: { contains: input.dest, mode: "insensitive" as const } } : {}),
    },
  }
  if (input.pax) (where as Record<string, unknown>).seatAvailability = { seatsAvailable: { gte: input.pax } }
  const trips = await findUrbanSchedule(where as Prisma.TripWhereInput)
  return trips.map((t: any) => ({
    id: t.id,
    origin: t.route.originCity,
    dest: t.route.destinationCity,
    departureAt: t.departureAt,
    arrivalAt: t.arrivalEstimateAt,
    price: t.price,
    seatsAvailable: t.seatAvailability?.seatsAvailable ?? t.totalSeats,
    totalSeats: t.totalSeats,
    line: `${t.route.originCity} → ${t.route.destinationCity}`,
    vehicleTypeInfo: t.vehicleTypeInfo,
    isUrban: true,
    validUntil: new Date(t.departureAt.getTime() + 2 * 3600000).toISOString(),
  }))
}
