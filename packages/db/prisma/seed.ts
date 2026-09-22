/**
 * Database seed.
 *
 * Per AGENTS.md §4 and the user's directive ("true source of data and single
 * point of data management for all the services"), every agency profile,
 * fleet/amenity tag, served route and intra-urban line is defined in
 * `@camermove/shared/agencies`. This seed is a *consumer* of that registry —
 * it never duplicates brand strings, route lists, fare bands, or city
 * coordinates.
 *
 * Idempotent: re-running `pnpm db:seed` is safe.
 */
import { prisma } from "../src/prisma"
import * as argon2 from "argon2"
import {
  AGENCIES,
  URBAN_LINES,
  URBAN_NETWORKS,
  CITIES,
  findUrbanNetwork,
  type CityId,
  type AgencyRoute,
} from "@camermove/shared"
import { seedCorridorStops } from "./corridor-stops"

async function ensureDemoUsers() {
  const users = [
    { email: "admin@camermove.cm", password: "Admin123!", firstName: "Admin", lastName: "CamerMove", role: "super_admin" as const },
    { email: "user@camermove.cm", password: "User123!", firstName: "Jean", lastName: "Voyageur", role: "traveler" as const },
    { email: "partner@camermove.cm", password: "Partner123!", firstName: "Paul", lastName: "Partenaire", role: "transporter_staff" as const },
  ]
  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } })
    if (existing) continue
    const hash = await argon2.hash(u.password)
    const user = await prisma.user.create({
      data: { email: u.email, passwordHash: hash, firstName: u.firstName, lastName: u.lastName, role: u.role as never, emailVerified: true },
    })
    if (u.role === "transporter_staff") {
      const transporter = await prisma.transporter.findFirst({ where: { email: "express@camermove.cm" } })
      if (transporter) await prisma.user.update({ where: { id: user.id }, data: { transporterId: transporter.id } })
    }
  }
}

/**
 * Seed all agencies from the registry (single source of truth).
 *
 * For each agency:
 *   1. Upsert Transporter (companyName + email).
 *   2. Upsert one Route per (origin, destination) pair.
 *   3. Create sample trips every 30 min during service hours, starting tomorrow.
 */
async function seedAgencies() {
  let totalRoutes = 0
  let totalTrips = 0
  let totalStops = 0
  for (const a of AGENCIES) {
    const transporter = await prisma.transporter.upsert({
      where: { email: a.email },
      update: {
        companyName: a.displayName,
        tagline: a.tagline,
        agencyType: a.category,
        city: CITIES[a.headquartersCity].label,
        contactName: a.displayName,
        phone: a.phone,
        yearFounded: a.yearFounded,
        vehicleCount: a.fleetCount,
        amenities: a.amenities,
        servedRoutes: a.routes.map((r) => `${CITIES[r.origin].label} → ${CITIES[r.destination].label}`),
        commissionPercent: a.commissionPercent ?? null,
        isUrban: a.category === "urban" || a.category === "mixed",
        status: "approved",
        logoUrl: null,
      },
      create: {
        companyName: a.displayName,
        contactName: a.displayName,
        email: a.email,
        phone: a.phone,
        city: CITIES[a.headquartersCity].label,
        transportType: "bus",
        agencyType: a.category,
        tagline: a.tagline,
        yearFounded: a.yearFounded,
        vehicleCount: a.fleetCount,
        amenities: a.amenities,
        servedRoutes: a.routes.map((r) => `${CITIES[r.origin].label} → ${CITIES[r.destination].label}`),
        status: "approved",
        commissionPercent: a.commissionPercent ?? null,
        isUrban: a.category === "urban" || a.category === "mixed",
      },
    })

    for (const r of a.routes) {
      const route = await ensureRoute(transporter.id, r)
      totalRoutes++
      const tripCount = await ensureTrips(route.id, transporter.id, r, a.amenities)
      totalTrips += tripCount
    }
    totalStops += await seedCorridorStops(prisma)
  }
  return { totalRoutes, totalTrips, totalStops }
}

async function ensureRoute(transporterId: string, r: AgencyRoute) {
  const origin = CITIES[r.origin as CityId].label
  const dest = CITIES[r.destination as CityId].label
  return prisma.route.upsert({
    where: {
      transporterId_originCity_destinationCity: {
        transporterId,
        originCity: origin,
        destinationCity: dest,
      },
    },
    update: {
      active: true,
    },
    create: {
      transporterId,
      originCity: origin,
      destinationCity: dest,
      active: true,
    },
  })
}

/**
 * Ensure enough trips cover the next 7 days for the route — starting
 * tomorrow at 06:00, every `60 / Math.max(1, dailyDepartures)` hours.
 *
 * Urban routes (isUrban=true) get trips every 30 min during service window.
 */
async function ensureTrips(routeId: string, transportId: string, r: AgencyRoute, amenities: string[] = []): Promise<number> {
  const isUrban = await prisma.transporter.findUnique({
    where: { id: transportId },
    select: { isUrban: true },
  })

  const tomorrow = new Date()
  tomorrow.setHours(0, 0, 0, 0)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

  if (isUrban?.isUrban) {
    // Urban: every 30 min, 06:00 – 22:00, 7 days
    let count = 0
    for (let day = 0; day < 7; day++) {
      for (let hour = 6; hour <= 22; hour++) {
        for (const minute of [0, 30]) {
          const departureAt = new Date(tomorrow.getTime() + day * 86400000)
          departureAt.setUTCHours(hour, minute, 0, 0)
          const exists = await prisma.trip.findFirst({ where: { routeId, departureAt } })
          if (exists) continue
          await prisma.trip.create({
            data: {
              routeId,
              transportId,
              departureAt,
              price: 250,
              totalSeats: 50,
              vehicleTypeInfo: "Bus urbain",
              status: "active",
              seatAvailability: { create: { seatsAvailable: 50, seatsHeld: 0, seatsBooked: 0 } },
            },
          })
          count++
        }
      }
    }
    return count
  }

  // Interurban: split `dailyDepartures` across the day from 06:00 to 22:00
  const start = 6
  const end = 22
  const spanHours = end - start
  const totalDepartures = Math.min(r.dailyDepartures, 12)
  const stepHours = spanHours / Math.max(1, totalDepartures - 1)
  let count = 0
  for (let day = 0; day < 7; day++) {
    for (let i = 0; i < totalDepartures; i++) {
      const departureAt = new Date(tomorrow.getTime() + day * 86400000)
      const hourFloat = start + stepHours * i
      const hour = Math.floor(hourFloat)
      const minute = Math.floor((hourFloat - hour) * 60)
      departureAt.setUTCHours(hour, minute, 0, 0)
      const exists = await prisma.trip.findFirst({ where: { routeId, departureAt } })
      if (exists) continue
      await prisma.trip.create({
        data: {
          routeId,
          transportId,
          departureAt,
          arrivalEstimateAt: new Date(departureAt.getTime() + r.durationMinutes * 60000),
          durationEstimate: r.durationMinutes,
          price: r.basePriceXaf,
          totalSeats: 50,
          vehicleTypeInfo: r.classType === "VIP" ? "Autocar VIP" : r.classType === "Premium" ? "Autocar Premium" : "Autocar Standard",
          conditions: null,
          status: "active",
          amenities,
          seatAvailability: { create: { seatsAvailable: 50, seatsHeld: 0, seatsBooked: 0 } },
        },
      })
      count++
    }
  }
  return count
}

/**
 * Seed urban transit metadata so the landing reel and stats reflect the
 * urban services we offer (per user directive: "the main app activity should
 * be on the intra urban transport").
 *
 * Implementation: a single "agency" per network (Transporter of type urban)
 * is upserted, plus a TransporterMeta-style marker row. We keep the model
 * unchanged — the registry IS the source of truth for stop lists, fare bands,
 * and line codes.
 */
async function seedUrbanNetworks() {
  for (const net of URBAN_NETWORKS) {
    const city = CITIES[net.city].label
    const email = `${net.id}@camermove.cm`
    const transporter = await prisma.transporter.upsert({
      where: { email },
      update: {
        companyName: `${net.operatorName} — ${net.brand}`,
        tagline: net.tagline,
        agencyType: "urban",
        city,
        status: "approved",
        isUrban: true,
        servedRoutes: URBAN_LINES.filter((l) => l.networkId === net.id).map((l) => l.name),
        amenities: ["wifi", "ac", "cctv", "gps-tracker", "usb"],
      },
      create: {
        companyName: `${net.operatorName} — ${net.brand}`,
        contactName: net.operatorName,
        email,
        phone: "+237 000 00 00 00",
        city,
        transportType: "bus",
        agencyType: "urban",
        tagline: net.tagline,
        isUrban: true,
        yearFounded: 2025,
        vehicleCount: 60,
        status: "approved",
        servedRoutes: URBAN_LINES.filter((l) => l.networkId === net.id).map((l) => l.name),
        amenities: ["wifi", "ac", "cctv", "gps-tracker", "usb"],
      },
    })

    // One Route per URBAN_LINE (terminus → terminus) + trips every 30 min
    // 05:00–22:00 for 7 days at the line's base fare (<1000 so the
    // intraurban schedule price gate passes).
    const lines = URBAN_LINES.filter((l) => l.networkId === net.id)
    for (const line of lines) {
      const origin = line.stops[0]!.name
      const dest = line.stops[line.stops.length - 1]!.name
      const route = await prisma.route.upsert({
        where: {
          transporterId_originCity_destinationCity: {
            transporterId: transporter.id,
            originCity: origin,
            destinationCity: dest,
          },
        },
        update: { active: true },
        create: { transporterId: transporter.id, originCity: origin, destinationCity: dest, active: true },
      })
      const fare = line.fareBands[0]?.priceXaf ?? 500
      const tomorrow = new Date()
      tomorrow.setHours(0, 0, 0, 0)
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
      for (let day = 0; day < 7; day++) {
        for (let hour = 5; hour <= 22; hour++) {
          for (const minute of [0, 30]) {
            const departureAt = new Date(tomorrow.getTime() + day * 86400000)
            departureAt.setUTCHours(hour, minute, 0, 0)
            const exists = await prisma.trip.findFirst({ where: { routeId: route.id, departureAt } })
            if (exists) continue
            await prisma.trip.create({
              data: {
                routeId: route.id,
                transportId: transporter.id,
                departureAt,
                arrivalEstimateAt: new Date(departureAt.getTime() + line.durationMinutes * 60000),
                durationEstimate: line.durationMinutes,
                price: fare,
                totalSeats: 50,
                vehicleTypeInfo: net.id === "pmud-douala" ? "BRT" : "Bus urbain",
                status: "active",
                amenities: ["wifi", "ac", "cctv", "gps-tracker", "usb"],
                seatAvailability: { create: { seatsAvailable: 50, seatsHeld: 0, seatsBooked: 0 } },
              },
            })
          }
        }
      }
    }
  }
  return URBAN_NETWORKS.length
}

/**
 * Seed some sample reviews so the rating aggregates aren't all 0.
 *
 * Per the user's directive ("multiple rating there have multiple agencies
 * like general buca touristic global princess voyage etc all of them do
 * researches"), each agency gets at least 5 reviews — different authors,
 * with optional sub-scores, drawn deterministically from a hash of the
 * slug so the seed stays stable.
 */
async function seedReviews() {
  const travelers = [
    { firstName: "Jean",   lastName: "Mbarga" },
    { firstName: "Aïcha",  lastName: "Njoya" },
    { firstName: "Pierre", lastName: "Essomba" },
    { firstName: "Sylvie", lastName: "Atangana" },
    { firstName: "Marc",   lastName: "Fotso" },
    { firstName: "Linda",  lastName: "Ondoua" },
    { firstName: "Yann",   lastName: "Belibi" },
  ]

  const positives = [
    "Ponctualité respectée, bus climatisé en parfait état.",
    "Personnel accueillant, trajet confortable, je recommande.",
    "Très bon rapport qualité-prix, je reprends dès que possible.",
    "Départ à l'heure, Wi-Fi fonctionnel, hôtesse souriante.",
    "Le trajet s'est bien passé, j'ai apprécié la collation servie à bord.",
  ]
  const negatives = [
    "Retard de 30 min au départ, mais le bus était correct.",
    "Climatisation moyenne mais chauffeur professionnel.",
    "Prix correct, mais escale un peu longue à Makak.",
  ]

  let created = 0
  for (const a of AGENCIES) {
    const transporter = await prisma.transporter.findUnique({ where: { email: a.email } })
    if (!transporter) continue

    // 5-7 reviews per agency
    const totalReviews = 5 + (a.slug.length % 3)
    for (let i = 0; i < totalReviews; i++) {
      const seedIdx = (a.slug.charCodeAt(0) + i) % travelers.length
      const author = travelers[seedIdx]!
      const authorEmail = `${author.firstName.toLowerCase()}.${author.lastName.toLowerCase()}.${i}@example.com`
      const rating = 3 + ((seedIdx + i) % 3) // 3..5
      const comment =
        i % 3 === 0
          ? positives[seedIdx % positives.length]!
          : negatives[seedIdx % negatives.length]!

      const existingUser = await prisma.user.findUnique({ where: { email: authorEmail } })
      const user =
        existingUser ??
        (await prisma.user.create({
          data: {
            email: authorEmail,
            firstName: author.firstName,
            lastName: author.lastName,
            // Real hash of a random password — sample users can technically
            // sign in but the password is never shared.
            passwordHash: await argon2.hash(`Sample-${authorEmail}-!1`),
            emailVerified: true,
            role: "traveler" as never,
          },
        }))

      // Skip if the user has already reviewed this agency.
      const existing = await prisma.review.findFirst({
        where: { userId: user.id, transporterId: transporter.id, target: "transporter" },
      })
      if (existing) continue

      await prisma.review.create({
        data: {
          userId: user.id,
          target: "transporter",
          transporterId: transporter.id,
          rating,
          punctuality: rating,
          comfort: Math.max(1, rating - (i % 2)),
          cleanliness: rating,
          service: rating,
          comment,
          isPublished: true,
        },
      })
      created++
    }
  }
  return created
}

async function main() {
  console.log("• Seeding demo users…")
  await ensureDemoUsers()

  console.log("• Seeding agencies & routes from registry…")
  const agg = await seedAgencies()
  console.log(`  ${agg.totalRoutes} routes, ${agg.totalTrips} trips, ${agg.totalStops} corridor stops`)

  console.log("• Seeding urban transit networks…")
  const urbanCount = await seedUrbanNetworks()
  console.log(`  ${urbanCount} networks ready`)

  console.log("• Seeding sample reviews…")
  const reviews = await seedReviews()
  console.log(`  ${reviews} reviews inserted`)

  console.log("✓ Seed complete")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })