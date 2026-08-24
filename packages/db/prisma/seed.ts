import { prisma } from "../src/prisma"

async function main() {
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
