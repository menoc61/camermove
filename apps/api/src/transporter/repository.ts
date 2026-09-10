// @ts-nocheck
// Single data-access layer for the transporter module (AGENTS.md §4).
// All prisma.* calls for transporter live here; service.ts keeps business rules,
// routes.ts keeps HTTP/auth/logging concerns.
import { prisma } from "@camermove/db"

// ─── Auth / profile ─────────────────────────────────────────────────────────

export async function findUserTransporterId(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { transporterId: true } })
  return user?.transporterId ?? null
}

export async function findTransporterProfile(transporterId: string) {
  return prisma.transporter.findUnique({
    where: { id: transporterId },
    include: { vehicles: true, routes: true, _count: { select: { trips: true, staffUsers: true } } },
  })
}

export async function updateTransporterRow(transporterId: string, data: Record<string, unknown>) {
  return prisma.transporter.update({ where: { id: transporterId }, data: data as never })
}

// ─── Vehicles ───────────────────────────────────────────────────────────────

export async function findVehicles(transporterId: string) {
  return prisma.vehicle.findMany({ where: { transporterId }, orderBy: { createdAt: "desc" } })
}

export async function createVehicleRow(data: Record<string, unknown>) {
  return prisma.vehicle.create({ data: data as never })
}

export async function findVehicleById(vehicleId: string) {
  return prisma.vehicle.findUnique({ where: { id: vehicleId } })
}

export async function updateVehicleRow(vehicleId: string, data: Record<string, unknown>) {
  return prisma.vehicle.update({ where: { id: vehicleId }, data: data as never })
}

export async function deleteVehicleRow(vehicleId: string) {
  return prisma.vehicle.delete({ where: { id: vehicleId } })
}

export async function findActiveTripByVehicle(vehicleId: string) {
  return prisma.trip.findFirst({ where: { vehicleId, status: "active" } })
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function findTransporterRoutes(transporterId: string) {
  return prisma.route.findMany({
    where: { transporterId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { trips: true } } },
  })
}

export async function findRouteById(routeId: string) {
  return prisma.route.findUnique({ where: { id: routeId } })
}

export async function findRouteByUnique(transporterId: string, originCity: string, destinationCity: string) {
  return prisma.route.findUnique({
    where: { transporterId_originCity_destinationCity: { transporterId, originCity, destinationCity } },
  })
}

export async function createRouteRow(data: Record<string, unknown>) {
  return prisma.route.create({ data: data as never })
}

export async function updateRouteRow(routeId: string, data: Record<string, unknown>) {
  return prisma.route.update({ where: { id: routeId }, data: data as never })
}

export async function deleteRouteRow(routeId: string) {
  return prisma.route.delete({ where: { id: routeId } })
}

export async function findActiveTripByRoute(routeId: string) {
  return prisma.trip.findFirst({ where: { routeId, status: "active" } })
}

// ─── Trips ──────────────────────────────────────────────────────────────────

export async function findTrips(where: Record<string, unknown>, skip: number, take: number) {
  return prisma.trip.findMany({
    where: where as never,
    skip,
    take,
    orderBy: { departureAt: "asc" },
    include: { route: true, vehicle: true, _count: { select: { bookings: true } }, seatAvailability: true },
  })
}

export async function countTrips(where: Record<string, unknown>) {
  return prisma.trip.count({ where: where as never })
}

export async function findTripById(tripId: string) {
  return prisma.trip.findUnique({ where: { id: tripId }, include: { seatAvailability: true } })
}

export async function findTripByIdPlain(tripId: string) {
  return prisma.trip.findUnique({ where: { id: tripId } })
}

export async function createTripRow(data: Record<string, unknown>) {
  return prisma.trip.create({
    data: data as never,
    include: { route: true, vehicle: true, seatAvailability: true },
  })
}

export async function updateTripRow(tripId: string, data: Record<string, unknown>) {
  return prisma.trip.update({
    where: { id: tripId },
    data: data as never,
    include: { route: true, vehicle: true, seatAvailability: true },
  })
}

export async function deleteTripRow(tripId: string) {
  return prisma.trip.delete({ where: { id: tripId } })
}

// ─── Bookings (transporter views only) ──────────────────────────────────────

const bookingDetailInclude = {
  trip: { include: { route: true, vehicle: true } },
  passengers: true,
  payments: true,
  tickets: true,
  user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
}

export async function findTransporterBookings(where: Record<string, unknown>, skip: number, take: number) {
  return prisma.booking.findMany({
    where: where as never,
    skip,
    take,
    orderBy: { createdAt: "desc" },
    include: bookingDetailInclude as never,
  })
}

export async function countTransporterBookings(where: Record<string, unknown>) {
  return prisma.booking.count({ where: where as never })
}

export async function findTransporterBookingById(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: { ...bookingDetailInclude, commission: true } as never,
  })
}

// ─── Dashboard stats ────────────────────────────────────────────────────────

export async function getTransporterStats(transporterId: string, today: Date, tomorrow: Date) {
  const [activeTrips, upcomingTrips, totalBookings, todayBookings, revenueResult] = await Promise.all([
    prisma.trip.count({ where: { transportId: transporterId, status: "active" } }),
    prisma.trip.count({
      where: { transportId: transporterId, departureAt: { gte: today, lt: tomorrow }, status: "active" },
    }),
    prisma.booking.count({ where: { trip: { transportId: transporterId } } }),
    prisma.booking.count({
      where: { trip: { transportId: transporterId }, createdAt: { gte: today, lt: tomorrow } },
    }),
    prisma.booking.aggregate({
      where: { trip: { transportId: transporterId }, status: "confirmed" },
      _sum: { totalAmount: true },
    }),
  ])
  return { activeTrips, upcomingTrips, totalBookings, todayBookings, totalRevenue: revenueResult._sum.totalAmount ?? 0 }
}

// ─── Audit ──────────────────────────────────────────────────────────────────

export async function createAuditLog(data: {
  actorId: string
  action: string
  entityType: string
  entityId: string
  metadata?: Record<string, unknown>
}) {
  return prisma.auditLog
    .create({ data: data as never })
    .catch(() => {})
}
