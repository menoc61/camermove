// @ts-nocheck
import type { FastifyInstance } from "fastify"
import { prisma } from "@camermove/db"
import { loadEnv } from "@camermove/config"
import { ForbiddenError, BadRequestError } from "@camermove/config"
import { parseExportQuery, sendExport } from "../lib/export"
import * as svc from "./service"
import {
  VehicleInput, VehicleUpdateInput, VehicleParams,
  RouteInput, RouteUpdateInput, RouteParams,
  TripInput, TripUpdateInput, TripParams,
  TransporterProfileUpdate, TransporterPresignInput,
} from "./schema"

function getTransporterId(userId: string, role: string) {
  // transporter_staff and admin link to a transporter via User.transporterId
  return null // resolved async below
}

async function resolveTransporter(req: Parameters<typeof loadEnv>[0], role: string, userId: string) {
  if (role !== "transporter_staff" && role !== "admin" && role !== "super_admin") {
    throw new ForbiddenError("Accès réservé aux transporteurs")
  }
  if (role === "admin" || role === "super_admin") {
    // admin can view all — return special marker
    return "__admin__"
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { transporterId: true } })
  if (!user?.transporterId) throw new ForbiddenError("Aucun profil transporteur lié à ce compte")
  return user.transporterId
}

export async function transporterRoutes(app: FastifyInstance) {
  const env = loadEnv()

  // ── Profile ────────────────────────────────────────────────────────────────
  app.get("/transporter/profile", { preHandler: app.requireAuth() }, async (req) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const tid = await resolveTransporter(env, user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin pour les administrateurs")
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, userId: user.id }, "transporter.profile.get")
    return svc.getTransporterProfile(tid)
  })

  app.put("/transporter/profile", { preHandler: app.requireAuth() }, async (req) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const tid = await resolveTransporter(env, user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const body = TransporterProfileUpdate.parse(req.body)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, userId: user.id }, "transporter.profile.update")
    const updated = await svc.updateTransporterProfile(tid, body)
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "transporter.profile.update", entityType: "Transporter", entityId: tid, metadata: body as never },
    }).catch(() => {})
    return updated
  })

  app.post("/transporter/profile/presign", { preHandler: app.requireAuth() }, async (req) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const tid = await resolveTransporter(env, user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const body = TransporterPresignInput.parse(req.body)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, userId: user.id }, "transporter.profile.presign")
    const storage = await import("@camermove/media").then(m => m.getStorage())
    const objectKey = `transporters/${tid}/logos/${Date.now()}-${body.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`
    const result = await storage.presignPut(objectKey, body.mimetype, 15)
    return result
  })

  // ── Vehicles ───────────────────────────────────────────────────────────────
  app.get("/transporter/vehicles", { preHandler: app.requireAuth() }, async (req) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const tid = await resolveTransporter(env, user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    return svc.listVehicles(tid)
  })

  app.post("/transporter/vehicles", { preHandler: app.requireAuth() }, async (req, reply) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const tid = await resolveTransporter(env, user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const body = VehicleInput.parse(req.body)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, userId: user.id }, "transporter.vehicle.create")
    const vehicle = await svc.createVehicle(tid, body)
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "transporter.vehicle.create", entityType: "Vehicle", entityId: vehicle.id, metadata: body as never },
    }).catch(() => {})
    return reply.code(201).send(vehicle)
  })

  app.put("/transporter/vehicles/:id", { preHandler: app.requireAuth() }, async (req) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const tid = await resolveTransporter(env, user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const { id } = VehicleParams.parse(req.params)
    const body = VehicleUpdateInput.parse(req.body)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, vehicleId: id, userId: user.id }, "transporter.vehicle.update")
    const updated = await svc.updateVehicle(id, tid, body)
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "transporter.vehicle.update", entityType: "Vehicle", entityId: id, metadata: body as never },
    }).catch(() => {})
    return updated
  })

  app.delete("/transporter/vehicles/:id", { preHandler: app.requireAuth() }, async (req) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const tid = await resolveTransporter(env, user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const { id } = VehicleParams.parse(req.params)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, vehicleId: id, userId: user.id }, "transporter.vehicle.delete")
    const deleted = await svc.deleteVehicle(id, tid)
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "transporter.vehicle.delete", entityType: "Vehicle", entityId: id },
    }).catch(() => {})
    return deleted
  })

  // ── Routes ─────────────────────────────────────────────────────────────────
  app.get("/transporter/routes", { preHandler: app.requireAuth() }, async (req) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const tid = await resolveTransporter(env, user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    return svc.listRoutes(tid)
  })

  app.post("/transporter/routes", { preHandler: app.requireAuth() }, async (req, reply) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const tid = await resolveTransporter(env, user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const body = RouteInput.parse(req.body)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, userId: user.id }, "transporter.route.create")
    const route = await svc.createRoute(tid, body)
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "transporter.route.create", entityType: "Route", entityId: route.id, metadata: body as never },
    }).catch(() => {})
    return reply.code(201).send(route)
  })

  app.put("/transporter/routes/:id", { preHandler: app.requireAuth() }, async (req) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const tid = await resolveTransporter(env, user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const { id } = RouteParams.parse(req.params)
    const body = RouteUpdateInput.parse(req.body)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, routeId: id, userId: user.id }, "transporter.route.update")
    const updated = await svc.updateRoute(id, tid, body)
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "transporter.route.update", entityType: "Route", entityId: id, metadata: body as never },
    }).catch(() => {})
    return updated
  })

  app.delete("/transporter/routes/:id", { preHandler: app.requireAuth() }, async (req) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const tid = await resolveTransporter(env, user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const { id } = RouteParams.parse(req.params)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, routeId: id, userId: user.id }, "transporter.route.delete")
    const deleted = await svc.deleteRoute(id, tid)
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "transporter.route.delete", entityType: "Route", entityId: id },
    }).catch(() => {})
    return deleted
  })

  // ── Trips ───────────────────────────────────────────────────────────────────
  app.get("/transporter/trips", { preHandler: app.requireAuth() }, async (req) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const tid = await resolveTransporter(env, user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const q = req.query as Record<string, string>
    const result = await svc.listTrips(tid, {
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
      status: q.status,
      routeId: q.routeId,
    })
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, userId: user.id, tripCount: result.total }, "transporter.trips.list")
    return result
  })

  app.post("/transporter/trips", { preHandler: app.requireAuth() }, async (req, reply) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const tid = await resolveTransporter(env, user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const body = TripInput.parse(req.body)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, userId: user.id }, "transporter.trip.create")
    const trip = await svc.createTrip(tid, {
      ...body,
      departureAt: new Date(body.departureAt),
      arrivalEstimateAt: body.arrivalEstimateAt ? new Date(body.arrivalEstimateAt) : undefined,
    })
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "transporter.trip.create", entityType: "Trip", entityId: trip.id, metadata: body as never },
    }).catch(() => {})
    return reply.code(201).send(trip)
  })

  app.put("/transporter/trips/:id", { preHandler: app.requireAuth() }, async (req) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const tid = await resolveTransporter(env, user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const { id } = TripParams.parse(req.params)
    const body = TripUpdateInput.parse(req.body)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, tripId: id, userId: user.id }, "transporter.trip.update")
    const updated = await svc.updateTrip(id, tid, {
      ...body,
      departureAt: body.departureAt ? new Date(body.departureAt) : undefined,
      arrivalEstimateAt: body.arrivalEstimateAt ? new Date(body.arrivalEstimateAt) : undefined,
    })
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "transporter.trip.update", entityType: "Trip", entityId: id, metadata: body as never },
    }).catch(() => {})
    return updated
  })

  app.delete("/transporter/trips/:id", { preHandler: app.requireAuth() }, async (req) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const tid = await resolveTransporter(env, user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const { id } = TripParams.parse(req.params)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, tripId: id, userId: user.id }, "transporter.trip.delete")
    const deleted = await svc.deleteTrip(id, tid)
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "transporter.trip.delete", entityType: "Trip", entityId: id },
    }).catch(() => {})
    return deleted
  })

  // ── Bookings ────────────────────────────────────────────────────────────────
  app.get("/transporter/bookings", { preHandler: app.requireAuth() }, async (req) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const tid = await resolveTransporter(env, user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const q = req.query as Record<string, string>
    const result = await svc.listTransporterBookings(tid, {
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
      status: q.status,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
    })
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, userId: user.id, bookingCount: result.total }, "transporter.bookings.list")
    return result
  })

  app.get("/transporter/bookings/:id", { preHandler: app.requireAuth() }, async (req) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const tid = await resolveTransporter(env, user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const { id } = TripParams.parse(req.params)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, bookingId: id, userId: user.id }, "transporter.booking.get")
    return svc.getTransporterBooking(id, tid)
  })

  app.get("/transporter/bookings/export", { preHandler: app.requireAuth() }, async (req, reply) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const tid = await resolveTransporter(env, user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, userId: user.id, dateFrom, dateTo, format }, "transporter.bookings.export")
    const { listTransporterBookings } = await import("./service")
    const result = await listTransporterBookings(tid, { dateFrom, dateTo, limit: env.SEARCH_MAX_LIMIT })
    const columns = ["id", "reference", "tripId", "seatCount", "totalAmount", "status", "createdAt"]
    return sendExport(reply, "transporter-bookings", dateFrom, dateTo, format, result.items as unknown as Record<string, unknown>[], columns)
  })

  // ── Dashboard stats ─────────────────────────────────────────────────────────
  app.get("/transporter/stats", { preHandler: app.requireAuth() }, async (req) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const tid = await resolveTransporter(env, user.role, user.id)
    if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

    const [activeTrips, upcomingTrips, totalBookings, todayBookings, revenueResult] = await Promise.all([
      prisma.trip.count({ where: { transportId: tid, status: "active" } }),
      prisma.trip.count({ where: { transportId: tid, departureAt: { gte: today, lt: tomorrow }, status: "active" } }),
      prisma.booking.count({ where: { trip: { transportId: tid } } }),
      prisma.booking.count({ where: { trip: { transportId: tid }, createdAt: { gte: today, lt: tomorrow } } }),
      prisma.booking.aggregate({
        where: { trip: { transportId: tid }, status: "confirmed" },
        _sum: { totalAmount: true },
      }),
    ])

    return {
      activeTrips,
      upcomingTrips,
      totalBookings,
      todayBookings,
      totalRevenue: revenueResult._sum.totalAmount ?? 0,
    }
  })
}
