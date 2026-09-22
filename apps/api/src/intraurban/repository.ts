import { prisma, type Prisma } from "@camermove/db"

export async function findUrbanRoutes() {
  return prisma.route.findMany({
    where: { transporter: { isUrban: true } },
    include: { transporter: { select: { id: true, companyName: true } } },
  })
}

export async function findFirstTripPrice(routeId: string) {
  return prisma.trip.findFirst({ where: { routeId }, select: { price: true } })
}

export async function countActiveTripsForRoute(routeId: string, gte: Date, lt: Date) {
  return prisma.trip.count({ where: { routeId, departureAt: { gte, lt }, status: "active" } })
}

export async function findUrbanSchedule(where: Prisma.TripWhereInput) {
  return prisma.trip.findMany({
    where,
    orderBy: { departureAt: "asc" },
    take: 100,
    include: { route: true, transport: { select: { companyName: true } }, seatAvailability: true },
  })
}
