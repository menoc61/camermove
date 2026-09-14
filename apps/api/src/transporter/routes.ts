import type { FastifyInstance } from "fastify"
import { loadEnv } from "@camermove/config"
import { ForbiddenError } from "@camermove/config"
import type { Prisma } from "@prisma/client"
import { parseExportQuery, sendExport } from "../lib/export"
import * as svc from "./service"
import * as repo from "./repository"
import {
  VehicleInput, VehicleUpdateInput, VehicleParams,
  RouteInput, RouteUpdateInput, RouteParams,
  TripInput, TripUpdateInput, TripParams,
  BookingIdParams,
  TransporterProfileUpdate, TransporterPresignInput,
  TransporterTripsQuery, TransporterBookingsQuery,
} from "./schema"

function toAuditMetadata(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

async function resolveTransporter(role: string, userId: string) {
  if (role !== "transporter_staff" && role !== "admin" && role !== "super_admin") {
    throw new ForbiddenError("Accès réservé aux transporteurs")
  }
  if (role === "admin" || role === "super_admin") {
    // admin can view all — return special marker
    return "__admin__"
  }
  const transporterId = await repo.findUserTransporterId(userId)
  if (!transporterId) throw new ForbiddenError("Aucun profil transporteur lié à ce compte")
  return transporterId
}

export async function transporterRoutes(app: FastifyInstance) {
  const env = loadEnv()

  // ── Profile ────────────────────────────────────────────────────────────────
  app.get("/transporter/profile", { preHandler: app.requireAuth() }, async (req) => {
    const user = req.user!
    const tid = await resolveTransporter(user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin pour les administrateurs")
    req.log.info({ ...req.meta, userId: user.id }, "transporter.profile.get")
    return svc.getTransporterProfile(tid)
  })

  app.put("/transporter/profile", { preHandler: app.requireAuth() }, async (req) => {
    const user = req.user!
    const tid = await resolveTransporter(user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const body = TransporterProfileUpdate.parse(req.body)
    req.log.info({ ...req.meta, userId: user.id }, "transporter.profile.update")
    const updated = await svc.updateTransporterProfile(tid, body)
    await repo.createAuditLog(
      { actorId: user.id, action: "transporter.profile.update", entityType: "Transporter", entityId: tid, metadata: toAuditMetadata(body) },
    )
    return updated
  })

  app.post("/transporter/profile/presign", { preHandler: app.requireAuth() }, async (req) => {
    const user = req.user!
    const tid = await resolveTransporter(user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const body = TransporterPresignInput.parse(req.body)
    req.log.info({ ...req.meta, userId: user.id }, "transporter.profile.presign")
    const storage = await import("@camermove/media").then(m => m.getStorage())
    const objectKey = `transporters/${tid}/logos/${Date.now()}-${body.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`
    const presignedUrl = await storage.presignPut(objectKey)
    return { objectKey, presignedUrl }
  })

  // ── Vehicles ───────────────────────────────────────────────────────────────
  app.get("/transporter/vehicles", { preHandler: app.requireAuth() }, async (req) => {
    const user = req.user!
    const tid = await resolveTransporter(user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    return svc.listVehicles(tid)
  })

  app.post("/transporter/vehicles", { preHandler: app.requireAuth() }, async (req, reply) => {
    const user = req.user!
    const tid = await resolveTransporter(user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const body = VehicleInput.parse(req.body)
    req.log.info({ ...req.meta, userId: user.id }, "transporter.vehicle.create")
    const vehicle = await svc.createVehicle(tid, body)
    await repo.createAuditLog(
      { actorId: user.id, action: "transporter.vehicle.create", entityType: "Vehicle", entityId: vehicle.id, metadata: toAuditMetadata(body) },
    )
    return reply.code(201).send(vehicle)
  })

  app.put("/transporter/vehicles/:id", { preHandler: app.requireAuth() }, async (req) => {
    const user = req.user!
    const tid = await resolveTransporter(user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const { id } = VehicleParams.parse(req.params)
    const body = VehicleUpdateInput.parse(req.body)
    req.log.info({ ...req.meta, vehicleId: id, userId: user.id }, "transporter.vehicle.update")
    const updated = await svc.updateVehicle(id, tid, body)
    await repo.createAuditLog(
      { actorId: user.id, action: "transporter.vehicle.update", entityType: "Vehicle", entityId: id, metadata: toAuditMetadata(body) },
    )
    return updated
  })

  app.delete("/transporter/vehicles/:id", { preHandler: app.requireAuth() }, async (req) => {
    const user = req.user!
    const tid = await resolveTransporter(user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const { id } = VehicleParams.parse(req.params)
    req.log.info({ ...req.meta, vehicleId: id, userId: user.id }, "transporter.vehicle.delete")
    const deleted = await svc.deleteVehicle(id, tid)
    await repo.createAuditLog(
      { actorId: user.id, action: "transporter.vehicle.delete", entityType: "Vehicle", entityId: id },
    )
    return deleted
  })

  // ── Routes ─────────────────────────────────────────────────────────────────
  app.get("/transporter/routes", { preHandler: app.requireAuth() }, async (req) => {
    const user = req.user!
    const tid = await resolveTransporter(user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    return svc.listRoutes(tid)
  })

  app.post("/transporter/routes", { preHandler: app.requireAuth() }, async (req, reply) => {
    const user = req.user!
    const tid = await resolveTransporter(user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const body = RouteInput.parse(req.body)
    req.log.info({ ...req.meta, userId: user.id }, "transporter.route.create")
    const route = await svc.createRoute(tid, body)
    await repo.createAuditLog(
      { actorId: user.id, action: "transporter.route.create", entityType: "Route", entityId: route.id, metadata: toAuditMetadata(body) },
    )
    return reply.code(201).send(route)
  })

  app.put("/transporter/routes/:id", { preHandler: app.requireAuth() }, async (req) => {
    const user = req.user!
    const tid = await resolveTransporter(user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const { id } = RouteParams.parse(req.params)
    const body = RouteUpdateInput.parse(req.body)
    req.log.info({ ...req.meta, routeId: id, userId: user.id }, "transporter.route.update")
    const updated = await svc.updateRoute(id, tid, body)
    await repo.createAuditLog(
      { actorId: user.id, action: "transporter.route.update", entityType: "Route", entityId: id, metadata: toAuditMetadata(body) },
    )
    return updated
  })

  app.delete("/transporter/routes/:id", { preHandler: app.requireAuth() }, async (req) => {
    const user = req.user!
    const tid = await resolveTransporter(user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const { id } = RouteParams.parse(req.params)
    req.log.info({ ...req.meta, routeId: id, userId: user.id }, "transporter.route.delete")
    const deleted = await svc.deleteRoute(id, tid)
    await repo.createAuditLog(
      { actorId: user.id, action: "transporter.route.delete", entityType: "Route", entityId: id },
    )
    return deleted
  })

  // ── Trips ───────────────────────────────────────────────────────────────────
  app.get("/transporter/trips", { preHandler: app.requireAuth() }, async (req) => {
    const user = req.user!
    const tid = await resolveTransporter(user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const q = TransporterTripsQuery.parse(req.query)
    const result = await svc.listTrips(tid, {
      page: q.page,
      limit: q.limit,
      status: q.status,
      routeId: q.routeId,
    })
    req.log.info({ ...req.meta, userId: user.id, tripCount: result.total }, "transporter.trips.list")
    return result
  })

  // GET /transporter/trips/export — §6 style, registered before any /:id route
  app.get("/transporter/trips/export", { preHandler: app.requireAuth() }, async (req, reply) => {
    const user = req.user!
    const tid = await resolveTransporter(user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const exp = parseExportQuery(req.query)
    req.log.info({ ...req.meta, userId: user.id, dateFrom: exp.dateFrom, dateTo: exp.dateTo, format: exp.format }, "transporter.trips.export")
    const result = await svc.listTrips(tid, {
      dateFrom: exp.dateFrom,
      dateTo: exp.dateTo,
      limit: env.SEARCH_MAX_LIMIT,
      status: exp.status,
      routeId: exp.routeId,
    })
    const columns = ["id", "routeId", "vehicleId", "departureAt", "arrivalEstimateAt", "price", "totalSeats", "status", "createdAt"]
    return sendExport(reply, "transporter-trips", exp.dateFrom, exp.dateTo, exp.format, result.items, columns)
  })

  app.post("/transporter/trips", { preHandler: app.requireAuth() }, async (req, reply) => {
    const user = req.user!
    const tid = await resolveTransporter(user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const body = TripInput.parse(req.body)
    req.log.info({ ...req.meta, userId: user.id }, "transporter.trip.create")
    const trip = await svc.createTrip(tid, {
      ...body,
      departureAt: new Date(body.departureAt),
      arrivalEstimateAt: body.arrivalEstimateAt ? new Date(body.arrivalEstimateAt) : undefined,
    })
    await repo.createAuditLog(
      { actorId: user.id, action: "transporter.trip.create", entityType: "Trip", entityId: trip.id, metadata: toAuditMetadata(body) },
    )
    return reply.code(201).send(trip)
  })

  app.put("/transporter/trips/:id", { preHandler: app.requireAuth() }, async (req) => {
    const user = req.user!
    const tid = await resolveTransporter(user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const { id } = TripParams.parse(req.params)
    const body = TripUpdateInput.parse(req.body)
    req.log.info({ ...req.meta, tripId: id, userId: user.id }, "transporter.trip.update")
    const updated = await svc.updateTrip(id, tid, {
      ...body,
      departureAt: body.departureAt ? new Date(body.departureAt) : undefined,
      arrivalEstimateAt: body.arrivalEstimateAt ? new Date(body.arrivalEstimateAt) : undefined,
    })
    await repo.createAuditLog(
      { actorId: user.id, action: "transporter.trip.update", entityType: "Trip", entityId: id, metadata: toAuditMetadata(body) },
    )
    return updated
  })

  app.delete("/transporter/trips/:id", { preHandler: app.requireAuth() }, async (req) => {
    const user = req.user!
    const tid = await resolveTransporter(user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const { id } = TripParams.parse(req.params)
    req.log.info({ ...req.meta, tripId: id, userId: user.id }, "transporter.trip.delete")
    const deleted = await svc.deleteTrip(id, tid)
    await repo.createAuditLog(
      { actorId: user.id, action: "transporter.trip.delete", entityType: "Trip", entityId: id },
    )
    return deleted
  })

  // ── Bookings ────────────────────────────────────────────────────────────────
  app.get("/transporter/bookings", { preHandler: app.requireAuth() }, async (req) => {
    const user = req.user!
    const tid = await resolveTransporter(user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const q = TransporterBookingsQuery.parse(req.query)
    const result = await svc.listTransporterBookings(tid, {
      page: q.page,
      limit: q.limit,
      status: q.status,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
    })
    req.log.info({ ...req.meta, userId: user.id, bookingCount: result.total }, "transporter.bookings.list")
    return result
  })

  // Export registered BEFORE /:id so "export" is not captured as an id (§6)
  app.get("/transporter/bookings/export", { preHandler: app.requireAuth() }, async (req, reply) => {
    const user = req.user!
    const tid = await resolveTransporter(user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const exp = parseExportQuery(req.query)
    req.log.info({ ...req.meta, userId: user.id, dateFrom: exp.dateFrom, dateTo: exp.dateTo, format: exp.format }, "transporter.bookings.export")
    const { listTransporterBookings } = await import("./service")
    const result = await listTransporterBookings(tid, { dateFrom: exp.dateFrom, dateTo: exp.dateTo, limit: env.SEARCH_MAX_LIMIT })
    const columns = ["id", "reference", "tripId", "seatCount", "totalAmount", "status", "createdAt"]
    return sendExport(reply, "transporter-bookings", exp.dateFrom, exp.dateTo, exp.format, result.items, columns)
  })

  app.get("/transporter/bookings/:id", { preHandler: app.requireAuth() }, async (req) => {
    const user = req.user!
    const tid = await resolveTransporter(user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const { id } = BookingIdParams.parse(req.params)
    req.log.info({ ...req.meta, bookingId: id, userId: user.id }, "transporter.booking.get")
    return svc.getTransporterBooking(id, tid)
  })

  // ── Dashboard stats ─────────────────────────────────────────────────────────
  app.get("/transporter/stats", { preHandler: app.requireAuth() }, async (req) => {
    const user = req.user!
    const tid = await resolveTransporter(user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    return svc.getTransporterStats(tid)
  })
}
