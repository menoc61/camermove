/**
 * Agencies service — list & detail endpoints.
 *
 * Per AGENTS.md §4 and the user's directive ("true source of data and single
 * point of data management for all the services"), the registry in
 * `@camermove/shared/agencies` is the canonical source of agency profiles,
 * routes, fare bands, amenities, brand colors and stat counters. The DB
 * (`Transporter`) only stores the *operational* state — current rating
 * averages (kept in sync by trigger), live departure counts, real fleet
 * numbers. Everything static comes from the registry.
 *
 * This service merges both at runtime so consumers see the union.
 */
import { prisma } from "@camermove/db"
import {
  AGENCIES,
  BRAND_HUES,
  CITIES,
  cityCoords,
  findAgency,
  type AgencyRecord,
  type AgencyRoute,
  type BrandHue,
} from "@camermove/shared"
import { cacheKey, getCached, setCached } from "../lib/cache.js"

export interface AgencyListItem {
  id: string                  // slug from registry — stable across rebrand
  dbId: string | null         // actual Transporter.id in DB (null if not seeded)
  companyName: string
  tagline: string
  city: string | null
  lat: number | null
  lon: number | null
  yearFounded: number
  fleetCount: number
  category: AgencyRecord["category"]
  brand: { primary: string; soft: string; onPrimary: string; emoji: string }
  routes: { origin: string; destination: string; duration: string; priceFromXaf: number }[]
  amenities: string[]
  ratingAvg: number | null
  ratingCount: number
  serviceClasses: string[]
  activeDeparturesToday: number
  servedCities: string[]
  phone: string
  email: string
}

export interface AgencyDetail extends AgencyListItem {
  description: string
  headquartersAddress: string
  branchCities: string[]
  routesDetailed: {
    origin: string
    destination: string
    classType: AgencyRoute["classType"]
    basePriceXaf: number
    durationMinutes: number
    dailyDepartures: number
  }[]
  reviews: {
    items: Array<{
      id: string
      rating: number
      punctuality: number | null
      comfort: number | null
      cleanliness: number | null
      service: number | null
      comment: string | null
      createdAt: string
      author: { firstName: string | null; lastName: string | null }
    }>
    ratingAvg: number | null
    ratingCount: number
    total: number
  }
}

function brandFor(record: AgencyRecord) {
  const hue: BrandHue | undefined = BRAND_HUES[record.brandKey]
  return {
    primary: hue?.primary ?? "#0E0E0E",
    soft: hue?.soft ?? "#E4E1D9",
    onPrimary: hue?.onPrimary ?? "#FFFFFF",
    emoji: record.accentGlyph,
  }
}

function routesFormatted(record: AgencyRecord) {
  return record.routes.map((r) => ({
    origin: CITIES[r.origin].label,
    destination: CITIES[r.destination].label,
    duration: formatDuration(r.durationMinutes),
    priceFromXaf: r.basePriceXaf,
  }))
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h && m) return `${h}h${m.toString().padStart(2, "0")}`
  if (h) return `${h}h`
  return `${m}min`
}

async function enrichAggregates(slug: string) {
  const record = findAgency(slug)
  if (!record) return { ratingAvg: null, ratingCount: 0, activeDeparturesToday: 0, servedCities: [], dbId: null as string | null }
  const transporter = await prisma.transporter.findUnique({
    where: { email: record.email },
    select: {
      id: true,
      ratingAvg: true,
      ratingCount: true,
      routes: {
        select: {
          trips: {
            where: { status: "active", departureAt: { gte: new Date(), lt: nextMidnight() } },
            select: { id: true },
          },
        },
      },
    },
  })
  const activeDeparturesToday = transporter?.routes.reduce((acc, r) => acc + r.trips.length, 0) ?? 0
  const servedCities = Array.from(
    new Set([
      CITIES[record.headquartersCity].label,
      ...record.branchCities.map((c) => CITIES[c].label),
      ...record.routes.flatMap((r) => [CITIES[r.origin].label, CITIES[r.destination].label]),
    ]),
  )
  return {
    ratingAvg: transporter?.ratingAvg ? Number(transporter.ratingAvg) : null,
    ratingCount: transporter?.ratingCount ?? 0,
    activeDeparturesToday,
    servedCities,
    dbId: transporter?.id ?? null,
  }
}

function nextMidnight(): Date {
  const d = new Date()
  d.setUTCHours(24, 0, 0, 0)
  return d
}

async function buildListItem(record: AgencyRecord): Promise<AgencyListItem> {
  const coords = cityCoords(CITIES[record.headquartersCity].label)
  const agg = await enrichAggregates(record.slug)
  return {
    id: record.slug,
    dbId: agg.dbId,
    companyName: record.displayName,
    tagline: record.tagline,
    city: CITIES[record.headquartersCity].label,
    lat: coords?.lat ?? null,
    lon: coords?.lon ?? null,
    yearFounded: record.yearFounded,
    fleetCount: record.fleetCount,
    category: record.category,
    brand: brandFor(record),
    routes: routesFormatted(record),
    amenities: record.amenities,
    ratingAvg: agg.ratingAvg,
    ratingCount: agg.ratingCount,
    serviceClasses: record.serviceClasses,
    activeDeparturesToday: agg.activeDeparturesToday,
    servedCities: agg.servedCities,
    phone: record.phone,
    email: record.email,
  }
}

export async function listAllAgencies(filter?: {
  city?: string
  category?: AgencyRecord["category"]
  q?: string
}): Promise<{ items: AgencyListItem[]; total: number }> {
  const key = cacheKey("agencies", { v: "v2", city: filter?.city ?? null, category: filter?.category ?? null, q: filter?.q ?? null })
  const cached = await getCached<{ items: AgencyListItem[]; total: number }>(key)
  if (cached) return cached

  let matches = AGENCIES
  if (filter?.category) matches = matches.filter((a) => a.category === filter.category)
  if (filter?.city) {
    const norm = filter.city.toLowerCase()
    matches = matches.filter((a) => {
      const hq = CITIES[a.headquartersCity].label.toLowerCase()
      if (hq.includes(norm)) return true
      if (a.branchCities.some((c) => CITIES[c].label.toLowerCase().includes(norm))) return true
      return a.routes.some((r) => {
        const o = CITIES[r.origin].label.toLowerCase()
        const d = CITIES[r.destination].label.toLowerCase()
        return o.includes(norm) || d.includes(norm)
      })
    })
  }
  if (filter?.q) {
    const q = filter.q.toLowerCase()
    matches = matches.filter((a) =>
      a.displayName.toLowerCase().includes(q) ||
      a.tagline.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q),
    )
  }

  const items = await Promise.all(matches.map((r) => buildListItem(r)))
  const result = { items, total: items.length }
  await setCached(key, result, 60).catch(() => {})
  return result
}

export async function listAgencies(query: { city: string }): Promise<{ items: AgencyListItem[]; total: number }> {
  // Legacy signature for backward-compatibility with the existing agencies endpoint.
  return listAllAgencies({ city: query.city })
}

export async function getAgencyDetail(slug: string): Promise<AgencyDetail | null> {
  const record = findAgency(slug)
  if (!record) return null
  const base = await buildListItem(record)
  const transporter = await prisma.transporter.findUnique({
    where: { email: record.email },
    select: { id: true },
  })

  const reviewsRaw = transporter
    ? await prisma.review.findMany({
        where: { transporterId: transporter.id, target: "transporter", isPublished: true },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          rating: true,
          punctuality: true,
          comfort: true,
          cleanliness: true,
          service: true,
          comment: true,
          createdAt: true,
          user: { select: { firstName: true, lastName: true } },
        },
      })
    : []

  const reviewsCount = transporter
    ? await prisma.review.count({ where: { transporterId: transporter.id, target: "transporter", isPublished: true } })
    : 0

  return {
    ...base,
    description: record.description,
    headquartersAddress: record.headquartersAddress,
    branchCities: record.branchCities.map((c) => CITIES[c].label),
    routesDetailed: record.routes.map((r) => ({
      origin: CITIES[r.origin].label,
      destination: CITIES[r.destination].label,
      classType: r.classType,
      basePriceXaf: r.basePriceXaf,
      durationMinutes: r.durationMinutes,
      dailyDepartures: r.dailyDepartures,
    })),
    reviews: {
      items: reviewsRaw.map((r) => ({
        id: r.id,
        rating: r.rating,
        punctuality: r.punctuality,
        comfort: r.comfort,
        cleanliness: r.cleanliness,
        service: r.service,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
        author: { firstName: r.user.firstName, lastName: r.user.lastName },
      })),
      ratingAvg: base.ratingAvg,
      ratingCount: reviewsCount,
      total: reviewsCount,
    },
  }
}

/** Returns the rating aggregates for one or many agencies in a single query. */
export async function ratingAggregates(slugs: string[]): Promise<Record<string, { avg: number | null; count: number }>> {
  const out: Record<string, { avg: number | null; count: number }> = {}
  for (const slug of slugs) {
    const r = findAgency(slug)
    if (!r) continue
    const t = await prisma.transporter.findUnique({
      where: { email: r.email },
      select: { ratingAvg: true, ratingCount: true },
    })
    out[slug] = {
      avg: t?.ratingAvg ? Number(t.ratingAvg) : null,
      count: t?.ratingCount ?? 0,
    }
  }
  return out
}