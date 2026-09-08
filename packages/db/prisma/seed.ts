import { prisma } from "../src/prisma"
import * as argon2 from "argon2"

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

async function main() {
  await ensureDemoUsers()
  const transporter = await prisma.transporter.upsert({
    where: { email: "express@camermove.cm" },
    update: {},
    create: {
      companyName: "CamerMove Express",
      contactName: "Rodrigue",
      email: "express@camermove.cm",
      city: "Douala",
      transportType: "bus",
      status: "approved",
    },
  })

  const existingRoute = await prisma.route.findFirst({
    where: { originCity: "Yaoundé", destinationCity: "Douala", transporterId: transporter.id },
  })
  const route =
    existingRoute ??
    (await prisma.route.create({
      data: { originCity: "Yaoundé", destinationCity: "Douala", active: true, transporterId: transporter.id },
    }))

  const tomorrow = new Date()
  tomorrow.setHours(0, 0, 0, 0)

  for (const day of [1, 2, 3]) {
    for (const hour of [7, 13, 18]) {
      const departureAt = new Date(tomorrow.getTime() + day * 86400000)
      departureAt.setUTCHours(hour, 0, 0, 0)
      const exists = await prisma.trip.findFirst({ where: { routeId: route.id, departureAt } })
      if (exists) continue
      await prisma.trip.create({
        data: {
          routeId: route.id,
          transportId: transporter.id,
          departureAt,
          arrivalEstimateAt: new Date(departureAt.getTime() + 4 * 3600000),
          durationEstimate: 240,
          price: 6000 + day * 1000,
          totalSeats: 55,
          vehicleTypeInfo: "Autocar",
          status: "active",
          seatAvailability: { create: { seatsAvailable: 55, seatsHeld: 0, seatsBooked: 0 } },
        },
      })
    }
  }
  console.log("Seed complete")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
