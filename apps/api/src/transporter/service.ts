import { NotFoundError, ForbiddenError, ConflictError, loadEnv } from "@camermove/config"
import type { Prisma } from "@prisma/client"
import { BookingStatus } from "@prisma/client"
import * as repo from "./repository"

function err(msg: string): never { throw new NotFoundError(msg) }
function forbid(msg = "Accès refusé"): never { throw new ForbiddenError(msg) }
function conflict(msg: string): never { throw new ConflictError(msg) }

type VehicleStatusString = "active" | "inactive"

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getTransporterProfile(transporterId: string) {
  const t = await repo.findTransporterProfile(transporterId)
  if (!t) err("Profil transporteur introuvable")
  return t
}

export async function updateTransporterProfile(
  transporterId: string,
  data: { companyName?: string; contactName?: string | null; phone?: string | null; city?: string | null; transportType?: string | null }
) {
  return repo.updateTransporterRow(transporterId, data)
}

// ─── Vehicles ────────────────────────────────────────────────────────────────

export async function listVehicles(transporterId: string) {
  return repo.findVehicles(transporterId)
}

export async function createVehicle(transporterId: string, data: { type: string; capacity: number; plateNumber?: string; status?: VehicleStatusString }) {
  return repo.createVehicleRow({ ...data, transporterId, status: data.status ?? "active" })
}

export async function updateVehicle(vehicleId: string, transporterId: string, data: { type?: string; capacity?: number; plateNumber?: string | null; status?: VehicleStatusString }) {
  const v = await repo.findVehicleById(vehicleId)
  if (!v) err("Véhicule introuvable")
  if (v.transporterId !== transporterId) forbid()
  return repo.updateVehicleRow(vehicleId, data)
}

export async function deleteVehicle(vehicleId: string, transporterId: string) {
  const v = await repo.findVehicleById(vehicleId)
  if (!v) err("Véhicule introuvable")
  if (v.transporterId !== transporterId) forbid()
  // Check no active trips
  const activeTrip = await repo.findActiveTripByVehicle(vehicleId)
  if (activeTrip) conflict("Impossible de supprimer un véhicule lié à un trajet actif")
  return repo.deleteVehicleRow(vehicleId)
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function listRoutes(transporterId: string) {
  return repo.findTransporterRoutes(transporterId)
}

export async function createRoute(transporterId: string, data: { originCity: string; destinationCity: string; active?: boolean }) {
  const existing = await repo.findRouteByUnique(transporterId, data.originCity, data.destinationCity)
  if (existing) conflict("Cette route existe déjà pour ce transporteur")
  return repo.createRouteRow({ ...data, transporterId })
}

export async function updateRoute(routeId: string, transporterId: string, data: { originCity?: string; destinationCity?: string; active?: boolean }) {
  const r = await repo.findRouteById(routeId)
  if (!r) err("Route introuvable")
  if (r.transporterId !== transporterId) forbid()
  return repo.updateRouteRow(routeId, data)
}

export async function deleteRoute(routeId: string, transporterId: string) {
  const r = await repo.findRouteById(routeId)
  if (!r) err("Route introuvable")
  if (r.transporterId !== transporterId) forbid()
  const activeTrip = await repo.findActiveTripByRoute(routeId)
  if (activeTrip) conflict("Impossible de supprimer une route liée à un trajet actif")
  return repo.deleteRouteRow(routeId)
}

// ─── Trips ───────────────────────────────────────────────────────────────────

export async function listTrips(transporterId: string, params: { page?: number; limit?: number; status?: string; routeId?: string; dateFrom?: string; dateTo?: string }) {
  const env = loadEnv()
  const take = params.limit ?? env.PAGINATION_DEFAULT_PER_PAGE
  const skip = ((params.page ?? 1) - 1) * take
  const where: Prisma.TripWhereInput = { transportId: transporterId }
  if (params.status) where.status = params.status
  if (params.routeId) where.routeId = params.routeId
  if (params.dateFrom || params.dateTo) {
    where.departureAt = {}
    if (params.dateFrom) where.departureAt.gte = new Date(params.dateFrom)
    if (params.dateTo) where.departureAt.lte = new Date(params.dateTo + "T23:59:59Z")
  }

  const [items, total] = await Promise.all([
    repo.findTrips(where, skip, take),
    repo.countTrips(where),
  ])
  return { items, total, page: params.page ?? 1, perPage: take, totalPages: Math.ceil(total / take) }
}

export async function getTransporterTrip(tripId: string, transporterId: string) {
  const { prisma } = await import("@camermove/db")
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, transportId: transporterId },
    select: {
      id: true, departureAt: true, arrivalEstimateAt: true, price: true,
      totalSeats: true, transportId: true, vehicleTypeInfo: true,
      departurePointInfo: true, status: true,
      route: { select: { id: true, originCity: true, destinationCity: true } },
      seatAvailability: { select: { seatsAvailable: true, seatsHeld: true, seatsBooked: true } },
    },
  })
  if (!trip) {
    const { NotFoundError } = await import("@camermove/config")
    throw new NotFoundError("Trajet introuvable")
  }
  return trip
}

export async function createTrip(transporterId: string, data: {
  routeId: string; vehicleId?: string | null; departureAt: Date; arrivalEstimateAt?: Date | null;
  durationEstimate?: number | null; price: number; totalSeats: number;
  departurePointInfo?: string | null; vehicleTypeInfo?: string | null;
  conditions?: string | null; cancellationPolicy?: string | null; status?: string;
}) {
  // Verify route belongs to transporter
  const route = await repo.findRouteById(data.routeId)
  if (!route) err("Route introuvable")
  if (route.transporterId !== transporterId) forbid()
  // Verify vehicle belongs to transporter if provided
  if (data.vehicleId) {
    const vehicle = await repo.findVehicleById(data.vehicleId)
    if (!vehicle) err("Véhicule introuvable")
    if (vehicle.transporterId !== transporterId) forbid()
  }

  const trip = await repo.createTripRow({
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
  })
  return trip
}

export async function updateTrip(tripId: string, transporterId: string, data: Partial<{
  vehicleId: string | null; departureAt: Date; arrivalEstimateAt: Date | null;
  durationEstimate: number | null; price: number; totalSeats: number;
  departurePointInfo: string | null; vehicleTypeInfo: string | null;
  conditions: string | null; cancellationPolicy: string | null; status: string;
}>) {
  const trip = await repo.findTripById(tripId)
  if (!trip) err("Trajet introuvable")
  if (trip.transportId !== transporterId) forbid()

  const updateData: Prisma.TripUncheckedUpdateInput = { ...data }
  // If totalSeats changed, update seatAvailability
  if (data.totalSeats !== undefined && trip.seatAvailability) {
    const diff = data.totalSeats - trip.totalSeats
    updateData.seatAvailability = {
      update: { seatsAvailable: { increment: diff } },
    }
  }

  return repo.updateTripRow(tripId, updateData)
}

export async function deleteTrip(tripId: string, transporterId: string) {
  const trip = await repo.findTripByIdPlain(tripId)
  if (!trip) err("Trajet introuvable")
  if (trip.transportId !== transporterId) forbid()
  if (trip.status === "active") conflict("Annulez d'abord le trajet avant de le supprimer")
  return repo.deleteTripRow(tripId)
}

// ─── Bookings (transporter views only) ───────────────────────────────────────

export async function listTransporterBookings(
  transporterId: string,
  params: { page?: number; limit?: number; status?: BookingStatus; dateFrom?: string; dateTo?: string }
) {
  const env = loadEnv()
  const take = params.limit ?? env.PAGINATION_DEFAULT_PER_PAGE
  const skip = ((params.page ?? 1) - 1) * take
  const where: Prisma.BookingWhereInput = { trip: { transportId: transporterId } }
  if (params.status) where.status = params.status
  if (params.dateFrom || params.dateTo) {
    where.createdAt = {}
    if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom)
    if (params.dateTo) where.createdAt.lte = new Date(params.dateTo + "T23:59:59Z")
  }

  const [items, total] = await Promise.all([
    repo.findTransporterBookings(where, skip, take),
    repo.countTransporterBookings(where),
  ])
  return { items, total, page: params.page ?? 1, perPage: take, totalPages: Math.ceil(total / take) }
}

export async function getTransporterBooking(bookingId: string, transporterId: string) {
  const b = await repo.findTransporterBookingById(bookingId)
  if (!b) err("Réservation introuvable")
  if (b.trip.transportId !== transporterId) forbid()
  return b
}

export async function getTransporterStats(transporterId: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  return repo.getTransporterStats(transporterId, today, tomorrow)
}
