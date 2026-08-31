import { prisma } from "@camermove/db"
import { getStorage } from "@camermove/media"
import { NotFoundError, ForbiddenError, ConflictError, loadEnv } from "@camermove/config"
import type { Prisma } from "@prisma/client"

function err(msg: string) { throw new NotFoundError(msg) }
function forbid(msg = "Accès refusé") { throw new ForbiddenError(msg) }
function conflict(msg: string) { throw new ConflictError(msg) }

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getTransporterProfile(transporterId: string) {
  const t = await prisma.transporter.findUnique({
    where: { id: transporterId },
    include: { vehicles: true, routes: true, _count: { select: { trips: true, staffUsers: true } } },
  })
  if (!t) err("Profil transporteur introuvable")
  return t
}

export async function updateTransporterProfile(
  transporterId: string,
  data: { companyName?: string; contactName?: string | null; phone?: string | null; city?: string | null; transportType?: string | null }
) {
  return prisma.transporter.update({ where: { id: transporterId }, data })
}

// ─── Vehicles ────────────────────────────────────────────────────────────────

export async function listVehicles(transporterId: string) {
  return prisma.vehicle.findMany({
    where: { transporterId },
    orderBy: { createdAt: "desc" },
  })
}

export async function createVehicle(transporterId: string, data: { type: string; capacity: number; plateNumber?: string; status?: string }) {
  return prisma.vehicle.create({
    data: { ...data, transporterId, status: data.status ?? "active" },
  })
}

export async function updateVehicle(vehicleId: string, transporterId: string, data: { type?: string; capacity?: number; plateNumber?: string | null; status?: string }) {
  const v = await prisma.vehicle.findUnique({ where: { id: vehicleId } })
  if (!v) err("Véhicule introuvable")
  if (v.transporterId !== transporterId) forbid()
  return prisma.vehicle.update({ where: { id: vehicleId }, data })
}

export async function deleteVehicle(vehicleId: string, transporterId: string) {
  const v = await prisma.vehicle.findUnique({ where: { id: vehicleId } })
  if (!v) err("Véhicule introuvable")
  if (v.transporterId !== transporterId) forbid()
  // Check no active trips
  const activeTrip = await prisma.trip.findFirst({ where: { vehicleId, status: "active" } })
  if (activeTrip) conflict("Impossible de supprimer un véhicule lié à un trajet actif")
  return prisma.vehicle.delete({ where: { id: vehicleId } })
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function listRoutes(transporterId: string) {
  return prisma.route.findMany({
    where: { transporterId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { trips: true } } },
  })
}

export async function createRoute(transporterId: string, data: { originCity: string; destinationCity: string; active?: boolean }) {
  const existing = await prisma.route.findUnique({
    where: { transporterId_originCity_destinationCity: { transporterId, originCity: data.originCity, destinationCity: data.destinationCity } },
  })
  if (existing) conflict("Cette route existe déjà pour ce transporteur")
  return prisma.route.create({ data: { ...data, transporterId } })
}

export async function updateRoute(routeId: string, transporterId: string, data: { originCity?: string; destinationCity?: string; active?: boolean }) {
  const r = await prisma.route.findUnique({ where: { id: routeId } })
  if (!r) err("Route introuvable")
  if (r.transporterId !== transporterId) forbid()
  return prisma.route.update({ where: { id: routeId }, data })
}

export async function deleteRoute(routeId: string, transporterId: string) {
  const r = await prisma.route.findUnique({ where: { id: routeId } })
  if (!r) err("Route introuvable")
  if (r.transporterId !== transporterId) forbid()
  const activeTrip = await prisma.trip.findFirst({ where: { routeId, status: "active" } })
  if (activeTrip) conflict("Impossible de supprimer une route liée à un trajet actif")
  return prisma.route.delete({ where: { id: routeId } })
}

// ─── Trips ───────────────────────────────────────────────────────────────────

export async function listTrips(transporterId: string, params: { page?: number; limit?: number; status?: string; routeId?: string }) {
  const env = loadEnv()
  const take = params.limit ?? env.PAGINATION_DEFAULT_PER_PAGE
  const skip = ((params.page ?? 1) - 1) * take
  const where: Prisma.TripWhereInput = { transportId: transporterId }
  if (params.status) where.status = params.status
  if (params.routeId) where.routeId = params.routeId

  const [items, total] = await Promise.all([
    prisma.trip.findMany({
      where,
      skip,
      take,
      orderBy: { departureAt: "asc" },
      include: { route: true, vehicle: true, _count: { select: { bookings: true } }, seatAvailability: true },
    }),
    prisma.trip.count({ where }),
  ])
  return { items, total, page: params.page ?? 1, totalPages: Math.ceil(total / take) }
}

export async function createTrip(transporterId: string, data: {
  routeId: string; vehicleId?: string | null; departureAt: Date; arrivalEstimateAt?: Date | null;
  durationEstimate?: number | null; price: number; totalSeats: number;
  departurePointInfo?: string | null; vehicleTypeInfo?: string | null;
  conditions?: string | null; cancellationPolicy?: string | null; status?: string;
}) {
  // Verify route belongs to transporter
  const route = await prisma.route.findUnique({ where: { id: data.routeId } })
  if (!route) err("Route introuvable")
  if (route.transporterId !== transporterId) forbid()
  // Verify vehicle belongs to transporter if provided
  if (data.vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } })
    if (!vehicle) err("Véhicule introuvable")
    if (vehicle.transporterId !== transporterId) forbid()
  }

  const trip = await prisma.trip.create({
    data: {
      routeId: data.routeId,
      vehicleId: data.vehicleId,
      transportId: transporterId,
      departureAt: data.departureAt,
      arrivalEstimateAt: data.arrivalEstimateAt,
      durationEstimate: data.durationEstimate,
      price: data.price,
      totalSeats: data.totalSeats,
      departurePointInfo: data.departurePointInfo,
      vehicleTypeInfo: data.vehicleTypeInfo,
      conditions: data.conditions,
      cancellationPolicy: data.cancellationPolicy,
      status: data.status ?? "active",
      seatAvailability: { create: { seatsAvailable: data.totalSeats, seatsHeld: 0, seatsBooked: 0 } },
    },
    include: { route: true, vehicle: true, seatAvailability: true },
  })
  return trip
}

export async function updateTrip(tripId: string, transporterId: string, data: Partial<{
  vehicleId: string | null; departureAt: Date; arrivalEstimateAt: Date | null;
  durationEstimate: number | null; price: number; totalSeats: number;
  departurePointInfo: string | null; vehicleTypeInfo: string | null;
  conditions: string | null; cancellationPolicy: string | null; status: string;
}>) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { seatAvailability: true } })
  if (!trip) err("Trajet introuvable")
  if (trip.transportId !== transporterId) forbid()

  const updateData: Prisma.TripUpdateInput = { ...data }
  // If totalSeats changed, update seatAvailability
  if (data.totalSeats !== undefined && trip.seatAvailability) {
    const diff = data.totalSeats - trip.totalSeats
    updateData.seatAvailability = {
      update: { seatsAvailable: { increment: diff } },
    }
  }

  return prisma.trip.update({ where: { id: tripId }, data: updateData, include: { route: true, vehicle: true, seatAvailability: true } })
}

export async function deleteTrip(tripId: string, transporterId: string) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } })
  if (!trip) err("Trajet introuvable")
  if (trip.transportId !== transporterId) forbid()
  if (trip.status === "active") conflict("Annulez d'abord le trajet avant de le supprimer")
  return prisma.trip.delete({ where: { id: tripId } })
}

// ─── Bookings (transporter views only) ───────────────────────────────────────

export async function listTransporterBookings(
  transporterId: string,
  params: { page?: number; limit?: number; status?: string; dateFrom?: string; dateTo?: string }
) {
  const env = loadEnv()
  const take = params.limit ?? env.PAGINATION_DEFAULT_PER_PAGE
  const skip = ((params.page ?? 1) - 1) * take
  const where: Prisma.BookingWhereInput = { trip: { transportId: transporterId } }
  if (params.status) where.status = params.status as Prisma.EnumBookingStatusFilter["equals"]
  if (params.dateFrom || params.dateTo) {
    where.createdAt = {}
    if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom)
    if (params.dateTo) where.createdAt.lte = new Date(params.dateTo + "T23:59:59Z")
  }

  const [items, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        trip: { include: { route: true, vehicle: true } },
        passengers: true,
        payments: true,
        tickets: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
      },
    }),
    prisma.booking.count({ where }),
  ])
  return { items, total, page: params.page ?? 1, totalPages: Math.ceil(total / take) }
}

export async function getTransporterBooking(bookingId: string, transporterId: string) {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      trip: { include: { route: true, vehicle: true } },
      passengers: true,
      payments: true,
      tickets: true,
      user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
      commission: true,
    },
  })
  if (!b) err("Réservation introuvable")
  if (b.trip.transportId !== transporterId) forbid()
  return b
}

// ─── Presigned URL ───────────────────────────────────────────────────────────

export async function presignProfileLogo(transporterId: string, input: { filename: string; mimetype: string; size: number }) {
  const { objectKey } = await getStorage().presignPut(`transporters/${transporterId}/logos/${Date.now()}-${input.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`, input.mimetype, 15)
  return { objectKey, uploadUrl: objectKey } // presignPut returns {objectKey, presignedUrl} on MinioClient; adjust per actual return
}
