import { prisma, getAppSettingsCached } from "@camermove/db"
import { cacheKey, getCached, setCached } from "../lib/cache.js"
import { resolveInsurancePricing } from "../insurance/service.js"
import type { LandingRailType } from "./schema.js"

export interface LandingAgency {
  id: string
  companyName: string
  city: string | null
  lat: number | null
  lon: number | null
  departurePointInfo: string | null
}

export interface LandingStats {
  minPrice: number | null
  nextDepartureAt: string | null
  hotelsCount: number
  rentalsCount: number
  agencies: LandingAgency[]
}

export async function getLandingStats(): Promise<LandingStats> {
  const key = cacheKey("landing", { view: "stats" })
  const cached = await getCached<LandingStats>(key)
  if (cached) return cached

  const [minTrip, nextTrip, hotelsCount, rentalsCount, agencyRows] =
    await Promise.all([
      prisma.trip.findFirst({
        where: { status: "active", seatAvailability: { seatsAvailable: { gte: 1 } } },
        orderBy: { price: "asc" },
        select: { price: true },
      }),
      prisma.trip.findFirst({
        where: {
          status: "active",
          departureAt: { gte: new Date() },
          seatAvailability: { seatsAvailable: { gte: 1 } },
        },
        orderBy: { departureAt: "asc" },
        select: { departureAt: true },
      }),
      prisma.hotel.count({ where: { status: "active" } }),
      prisma.rentalVehicle.count({ where: { status: "available" } }),
      prisma.transporter.findMany({
        where: { status: "approved" },
        select: { id: true, companyName: true, city: true },
        take: 20,
      }),
    ])

  const result: LandingStats = {
    minPrice: minTrip?.price ?? null,
    nextDepartureAt: nextTrip?.departureAt.toISOString() ?? null,
    hotelsCount,
    rentalsCount,
    agencies: agencyRows.map((r) => ({
      id: r.id,
      companyName: r.companyName,
      city: r.city,
      lat: null,
      lon: null,
      departurePointInfo: null,
    })),
  }
  await setCached(key, result, 60).catch(() => {})
  return result
}

export type LandingRailPayload =
  | { type: "transport"; items: TransportRailItem[] }
  | { type: "hotels"; items: HotelRailItem[] }
  | { type: "rentals"; items: RentalRailItem[] }
  | { type: "events"; items: EventRailItem[] }
  | { type: "insurance"; pricing: Record<string, number> }

export interface TransportRailItem {
  id: string
  departureAt: string
  price: number
  vehicleTypeInfo: string | null
  seatsAvailable: number
  origin: string
  destination: string
  companyName: string
}

export interface HotelRailItem {
  id: string
  name: string
  city: string
  starRating: number | null
  image: string
  fromPrice: number | null
}

export interface RentalRailItem {
  id: string
  title: string
  top: string
  bottom: string
  image: string
}

export interface EventRailItem {
  id: string
  name: string
  city: string
  startDate: string
  posterUrl: string | null
  minPrice: number | null
}

export async function getLandingRail(type: LandingRailType): Promise<LandingRailPayload> {
  const key = cacheKey("landing", { view: "rail", type })
  const cached = await getCached<LandingRailPayload>(key)
  if (cached) return cached

  let result: LandingRailPayload
  if (type === "transport") {
    const rows = await prisma.trip.findMany({
      where: {
        status: "active",
        departureAt: { gte: new Date() },
        seatAvailability: { seatsAvailable: { gte: 1 } },
      },
      orderBy: { departureAt: "asc" },
      take: 8,
      select: {
        id: true,
        departureAt: true,
        price: true,
        vehicleTypeInfo: true,
        route: { select: { originCity: true, destinationCity: true } },
        transport: { select: { companyName: true } },
        seatAvailability: { select: { seatsAvailable: true } },
      },
    })
    result = {
      type: "transport",
      items: rows.map((t) => ({
        id: t.id,
        departureAt: t.departureAt.toISOString(),
        price: t.price,
        vehicleTypeInfo: t.vehicleTypeInfo,
        seatsAvailable: t.seatAvailability?.seatsAvailable ?? 0,
        origin: t.route.originCity,
        destination: t.route.destinationCity,
        companyName: t.transport.companyName,
      })),
    }
  } else if (type === "hotels") {
    const rows = await prisma.hotel.findMany({
      where: { status: "active", partnerStatus: "approved", rooms: { some: {} } },
      orderBy: { starRating: "desc" },
      take: 8,
      select: {
        id: true,
        name: true,
        city: true,
        starRating: true,
        photos: true,
        rooms: { select: { pricePerNight: true } },
      },
    })
    result = {
      type: "hotels",
      items: rows
        .map((h) => ({
          id: h.id,
          name: h.name,
          city: h.city,
          starRating: h.starRating,
          image: h.photos[0] ?? "",
          fromPrice:
            h.rooms.length > 0
              ? Math.min(...h.rooms.map((r) => r.pricePerNight))
              : null,
        }))
        .filter((h) => h.fromPrice != null),
    }
  } else if (type === "rentals") {
    const rows = await prisma.rentalVehicle.findMany({
      where: { status: "available" },
      orderBy: { pricePerUnit: "asc" },
      take: 8,
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        category: true,
        pickupCity: true,
        pricePerUnit: true,
        durationUnit: true,
        hasDriver: true,
        photos: true,
      },
    })
    const unitLabel: Record<string, string> = {
      hour: "heure",
      day: "jour",
      week: "semaine",
      month: "mois",
    }
    const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n)
    result = {
      type: "rentals",
      items: rows.map((v) => ({
        id: v.id,
        title: v.year ? `${v.make} ${v.model} · ${v.year}` : `${v.make} ${v.model}`,
        top: `${v.pickupCity} · ${v.category}`,
        bottom: `${fmt(v.pricePerUnit)} XAF / ${unitLabel[v.durationUnit] ?? "jour"} · ${v.hasDriver ? "avec chauffeur" : "sans chauffeur"}`,
        image: v.photos[0] ?? "",
      })),
    }
  } else if (type === "events") {
    const rows = await prisma.event.findMany({
      where: { status: "on_sale", partnerStatus: "approved", startDate: { gte: new Date() } },
      orderBy: { startDate: "asc" },
      take: 8,
      select: {
        id: true,
        name: true,
        city: true,
        startDate: true,
        posterUrl: true,
        ticketCategories: { select: { price: true } },
      },
    })
    result = {
      type: "events",
      items: rows.map((e) => {
        const prices = e.ticketCategories.map((c) => c.price).filter((p) => Number.isFinite(p))
        return {
          id: e.id,
          name: e.name,
          city: e.city,
          startDate: e.startDate.toISOString(),
          posterUrl: e.posterUrl,
          minPrice: prices.length > 0 ? Math.min(...prices) : null,
        }
      }),
    }
  } else {
    let pricing: Record<string, number>
    try {
      const settings = (await getAppSettingsCached()) as unknown as {
        featureFlags?: Record<string, unknown> | null
      }
      pricing = resolveInsurancePricing(settings?.featureFlags ?? null)
    } catch {
      pricing = resolveInsurancePricing(null)
    }
    result = { type: "insurance", pricing }
  }

  await setCached(key, result, 60).catch(() => {})
  return result
}
