import type { FastifyInstance } from "fastify"
import { loadEnv } from "@camermove/config"
import { parseExportQuery, sendExport } from "../lib/export"
import * as svc from "./service"
import {
  PaginationQuery, AdminRoleFilter, AdminStatusFilter, TransporterStatusFilter,
  BookingStatusFilter, PaymentStatusFilter, PartnerAppStatusFilter,
  UserUpdateBody, UserParams, TransporterUpdateBody, TransporterParams,
  TripAdminUpdateBody, TripParams, BookingParams, PaymentParams,
  PartnerAppParams, PartnerAppReviewBody, BulkActionBody, CommissionParams,
  HotelParams, HotelAdminUpdateBody, RentalParams, RentalAdminUpdateBody,
} from "./schema"

export async function adminRoutes(app: FastifyInstance) {
  const env = loadEnv()

  // All admin routes require admin role (super_admin satisfies via role hierarchy).
  // Canonical requireAuth — 401 when unauthenticated, 403 when under-privileged.
  app.addHook("preHandler", app.requireAuth("admin"))

  // ── Dashboard ───────────────────────────────────────────────────────────────
  app.get("/admin/stats", async (req) => {
    const user = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: user.id }, "admin.stats")
    return svc.getAdminStats()
  })

  // ── Users ──────────────────────────────────────────────────────────────────
  app.get("/admin/users", async (req) => {
    const q = PaginationQuery.parse(req.query)
    const user = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: user.id, ...q }, "admin.users.list")
    return svc.listUsers({ ...q, role: (req.query as Record<string, string>).role, status: (req.query as Record<string, string>).status })
  })

  app.get("/admin/users/export", async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const actor = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: actor.id, dateFrom, dateTo, format }, "admin.users.export")
    const result = await svc.listUsers({ page: 1, limit: env.SEARCH_MAX_LIMIT, dateFrom, dateTo })
    const columns = ["id", "email", "firstName", "lastName", "phone", "role", "status", "createdAt"]
    return sendExport(reply, "admin-users", dateFrom, dateTo, format, result.items as unknown as Record<string, unknown>[], columns)
  })

  app.get("/admin/users/:id", async (req) => {
    const { id } = UserParams.parse(req.params)
    const user = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: user.id, entityId: id }, "admin.user.get")
    return svc.getUser(id)
  })

  app.put("/admin/users/:id", async (req) => {
    const { id } = UserParams.parse(req.params)
    const body = UserUpdateBody.parse(req.body)
    const actor = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: actor.id, entityId: id }, "admin.user.update")
    return svc.updateUser(id, actor.id, body)
  })

  app.delete("/admin/users/:id", async (req) => {
    const { id } = UserParams.parse(req.params)
    const actor = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: actor.id, entityId: id }, "admin.user.delete")
    return svc.deleteUser(id, actor.id)
  })

  // ── Transporters ────────────────────────────────────────────────────────────
  app.get("/admin/transporters", async (req) => {
    const q = PaginationQuery.parse(req.query)
    const user = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: user.id, ...q }, "admin.transporters.list")
    return svc.listTransporters({ ...q, status: (req.query as Record<string, string>).status })
  })

  app.get("/admin/transporters/export", async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const actor = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: actor.id, dateFrom, dateTo, format }, "admin.transporters.export")
    const result = await svc.listTransporters({ page: 1, limit: env.SEARCH_MAX_LIMIT, dateFrom, dateTo })
    const columns = ["id", "companyName", "contactName", "email", "phone", "city", "transportType", "vehicleCount", "status", "createdAt"]
    return sendExport(reply, "admin-transporters", dateFrom, dateTo, format, result.items as unknown as Record<string, unknown>[], columns)
  })

  app.get("/admin/transporters/:id", async (req) => {
    const { id } = TransporterParams.parse(req.params)
    const user = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: user.id, entityId: id }, "admin.transporter.get")
    return svc.getTransporter(id)
  })

  app.put("/admin/transporters/:id", async (req) => {
    const { id } = TransporterParams.parse(req.params)
    const body = TransporterUpdateBody.parse(req.body)
    const actor = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: actor.id, entityId: id }, "admin.transporter.update")
    return svc.updateTransporter(id, actor.id, body)
  })

  // ── Partner Applications ─────────────────────────────────────────────────────
  app.get("/admin/partner-applications", async (req) => {
    const q = PaginationQuery.parse(req.query)
    const user = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: user.id, ...q }, "admin.partner-applications.list")
    return svc.listPartnerApplications({ ...q, status: (req.query as Record<string, string>).status })
  })

  app.get("/admin/partner-applications/export", async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const actor = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: actor.id, dateFrom, dateTo, format }, "admin.partner-applications.export")
    const result = await svc.listPartnerApplications({ page: 1, limit: env.SEARCH_MAX_LIMIT, dateFrom, dateTo })
    const columns = ["id", "companyName", "contactName", "email", "phone", "city", "transportType", "vehicleCount", "status", "transporterId", "createdAt"]
    return sendExport(reply, "admin-partner-applications", dateFrom, dateTo, format, result.items as unknown as Record<string, unknown>[], columns)
  })

  app.post("/admin/partner-applications/:id/review", async (req) => {
    const { id } = PartnerAppParams.parse(req.params)
    const body = PartnerAppReviewBody.parse(req.body)
    const actor = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: actor.id, entityId: id, newStatus: body.status }, "admin.partner-application.review")
    return svc.reviewPartnerApplication(id, actor.id, body)
  })

  // ── Trips ───────────────────────────────────────────────────────────────────
  app.get("/admin/trips", async (req) => {
    const q = PaginationQuery.parse(req.query)
    const user = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: user.id, ...q }, "admin.trips.list")
    return svc.listTrips({ ...q, status: (req.query as Record<string, string>).status, transporterId: (req.query as Record<string, string>).transporterId })
  })

  app.get("/admin/trips/export", async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const actor = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: actor.id, dateFrom, dateTo, format }, "admin.trips.export")
    const result = await svc.listTrips({ page: 1, limit: env.SEARCH_MAX_LIMIT, dateFrom, dateTo })
    const columns = ["id", "routeId", "transportId", "vehicleId", "departureAt", "price", "totalSeats", "status", "createdAt"]
    return sendExport(reply, "admin-trips", dateFrom, dateTo, format, result.items as unknown as Record<string, unknown>[], columns)
  })

  app.put("/admin/trips/:id", async (req) => {
    const { id } = TripParams.parse(req.params)
    const body = TripAdminUpdateBody.parse(req.body)
    const actor = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: actor.id, entityId: id }, "admin.trip.update")
    return svc.updateTrip(id, actor.id, body)
  })

  app.delete("/admin/trips/:id", async (req) => {
    const { id } = TripParams.parse(req.params)
    const actor = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: actor.id, entityId: id }, "admin.trip.delete")
    return svc.deleteTrip(id, actor.id)
  })

  // Bulk trip action
  app.post("/admin/trips/bulk", async (req) => {
    const body = BulkActionBody.parse(req.body)
    const actor = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: actor.id, ids: body.ids.length, action: body.action }, "admin.trips.bulk")
    if (!body.action) return { affected: 0 }
    const { prisma } = await import("@camermove/db")
    const updateData: Record<string, unknown> = {}
    if (body.action === "activate") updateData.status = "active"
    if (body.action === "deactivate") updateData.status = "inactive"
    const result = await prisma.trip.updateMany({ where: { id: { in: body.ids } }, data: updateData as never })
    return { affected: result.count }
  })

  // ── Bookings ────────────────────────────────────────────────────────────────
  app.get("/admin/bookings", async (req) => {
    const q = PaginationQuery.parse(req.query)
    const user = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: user.id, ...q }, "admin.bookings.list")
    return svc.listBookings({ ...q, status: (req.query as Record<string, string>).status, transporterId: (req.query as Record<string, string>).transporterId })
  })

  app.get("/admin/bookings/export", async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const actor = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: actor.id, dateFrom, dateTo, format }, "admin.bookings.export")
    const result = await svc.listBookings({ page: 1, limit: env.SEARCH_MAX_LIMIT, dateFrom, dateTo })
    const columns = ["id", "reference", "tripId", "userId", "seatCount", "totalAmount", "status", "createdAt"]
    return sendExport(reply, "admin-bookings", dateFrom, dateTo, format, result.items as unknown as Record<string, unknown>[], columns)
  })

  // ── Payments ───────────────────────────────────────────────────────────────
  app.get("/admin/payments", async (req) => {
    const q = PaginationQuery.parse(req.query)
    const user = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: user.id, ...q }, "admin.payments.list")
    return svc.listPayments({ ...q, status: (req.query as Record<string, string>).status, provider: (req.query as Record<string, string>).provider })
  })

  app.get("/admin/payments/export", async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const actor = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: actor.id, dateFrom, dateTo, format }, "admin.payments.export")
    const result = await svc.listPayments({ page: 1, limit: env.SEARCH_MAX_LIMIT, dateFrom, dateTo })
    const columns = ["id", "bookingId", "provider", "providerRef", "amount", "method", "currency", "status", "createdAt"]
    return sendExport(reply, "admin-payments", dateFrom, dateTo, format, result.items as unknown as Record<string, unknown>[], columns)
  })

  // ── Commissions ─────────────────────────────────────────────────────────────
  app.get("/admin/commissions", async (req) => {
    const q = PaginationQuery.parse(req.query)
    const user = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: user.id, ...q }, "admin.commissions.list")
    return svc.listCommissions({
      ...q,
      transporterId: (req.query as Record<string, string>).transporterId,
      payoutStatus: (req.query as Record<string, string>).payoutStatus,
    })
  })

  app.get("/admin/commissions/export", async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const actor = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: actor.id, dateFrom, dateTo, format }, "admin.commissions.export")
    const result = await svc.listCommissions({ page: 1, limit: env.SEARCH_MAX_LIMIT, dateFrom, dateTo })
    const columns = ["id", "bookingId", "grossAmount", "commissionAmount", "netAmount", "percentApplied", "payoutStatus"]
    return sendExport(reply, "admin-commissions", dateFrom, dateTo, format, result.items as unknown as Record<string, unknown>[], columns)
  })

  // Mark commission as paid (state-changing action → POST)
  app.post("/admin/commissions/:id/mark-paid", async (req) => {
    const { id } = CommissionParams.parse(req.params)
    const actor = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: actor.id, entityId: id }, "admin.commission.mark-paid")
    const { prisma } = await import("@camermove/db")
    const updated = await prisma.commission.update({ where: { id }, data: { payoutStatus: "paid" } })
    await prisma.auditLog.create({
      data: { actorId: actor.id, action: "admin.commission.mark-paid", entityType: "Commission", entityId: id },
    }).catch(() => {})
    return updated
  })

  // ── Audit Logs ──────────────────────────────────────────────────────────────
  app.get("/admin/audit-logs", async (req) => {
    const q = PaginationQuery.parse(req.query)
    const user = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: user.id, ...q }, "admin.audit-logs.list")
    return svc.listAuditLogs({ ...q, action: (req.query as Record<string, string>).action, actorId: (req.query as Record<string, string>).actorId })
  })

  app.get("/admin/audit-logs/export", async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const actor = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: actor.id, dateFrom, dateTo, format }, "admin.audit-logs.export")
    const result = await svc.listAuditLogs({ page: 1, limit: env.SEARCH_MAX_LIMIT, dateFrom, dateTo })
    const columns = ["id", "actorId", "action", "entityType", "entityId", "createdAt"]
    return sendExport(reply, "audit-logs", dateFrom, dateTo, format, result.items as unknown as Record<string, unknown>[], columns)
  })

  // ── Hotels (admin) ────────────────────────────────────────────────────────
  app.get("/admin/hotels", async (req) => {
    const q = PaginationQuery.parse(req.query)
    const actor = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    const { prisma: p } = await import("@camermove/db")
    const filter = req.query as Record<string, string>
    const where: Record<string, unknown> = {}
    if (filter.q) where.OR = [{ name: { contains: filter.q, mode: "insensitive" } }, { city: { contains: filter.q, mode: "insensitive" } }]
    if (filter.city) where.city = { contains: filter.city, mode: "insensitive" }
    if (filter.status) where.status = filter.status
    if (filter.partnerStatus) where.partnerStatus = filter.partnerStatus
    if (filter.dateFrom || filter.dateTo) {
      const createdAt: Record<string, Date> = {}
      if (filter.dateFrom) createdAt.gte = new Date(filter.dateFrom)
      if (filter.dateTo) createdAt.lte = new Date(filter.dateTo + "T23:59:59Z")
      where.createdAt = createdAt
    }
    req.log.info({ ...meta, actorId: actor.id, ...q }, "admin.hotels.list")
    const skip = (q.page - 1) * q.limit
    const [items, total] = await Promise.all([
      p.hotel.findMany({ where: where as never, skip, take: q.limit, orderBy: { createdAt: "desc" }, include: { rooms: true, owner: { select: { id: true, email: true } } } }),
      p.hotel.count({ where: where as never }),
    ])
    return { items, total, page: q.page, totalPages: Math.ceil(total / q.limit) }
  })

  app.get("/admin/hotels/export", async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const actor = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: actor.id, dateFrom, dateTo, format }, "admin.hotels.export")
    const { prisma: p } = await import("@camermove/db")
    const q = req.query as Record<string, string>
    const where: Record<string, unknown> = {}
    if (q.q) where.OR = [{ name: { contains: q.q, mode: "insensitive" } }]
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {}
      if (dateFrom) createdAt.gte = new Date(dateFrom)
      if (dateTo) createdAt.lte = new Date(dateTo + "T23:59:59Z")
      where.createdAt = createdAt
    }
    const rows = await p.hotel.findMany({ where: where as never, take: env.SEARCH_MAX_LIMIT, orderBy: { createdAt: "desc" } })
    const columns = ["id", "name", "city", "starRating", "status", "partnerStatus", "ownerId", "createdAt"]
    return sendExport(reply, "admin-hotels", dateFrom, dateTo, format, rows as unknown as Record<string, unknown>[], columns)
  })

  app.put("/admin/hotels/:id", async (req) => {
    const { id } = HotelParams.parse(req.params)
    const actor = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    const body = HotelAdminUpdateBody.parse(req.body)
    const { prisma: p } = await import("@camermove/db")
    req.log.info({ ...meta, actorId: actor.id, entityId: id }, "admin.hotel.update")
    const updated = await p.hotel.update({ where: { id }, data: body as never })
    await p.auditLog.create({ data: { actorId: actor.id, action: "admin.hotel.update", entityType: "Hotel", entityId: id, metadata: body as never } }).catch(() => {})
    return updated
  })

  // ── Rentals (admin) ───────────────────────────────────────────────────────
  app.get("/admin/rentals", async (req) => {
    const q = PaginationQuery.parse(req.query)
    const actor = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    const { prisma: p } = await import("@camermove/db")
    const filter = req.query as Record<string, string>
    const where: Record<string, unknown> = {}
    if (filter.q) where.OR = [{ make: { contains: filter.q, mode: "insensitive" } }, { model: { contains: filter.q, mode: "insensitive" } }, { pickupCity: { contains: filter.q, mode: "insensitive" } }]
    if (filter.category) where.category = filter.category
    if (filter.status) where.status = filter.status
    if (filter.partnerStatus) where.partnerStatus = filter.partnerStatus
    if (filter.dateFrom || filter.dateTo) {
      const createdAt: Record<string, Date> = {}
      if (filter.dateFrom) createdAt.gte = new Date(filter.dateFrom)
      if (filter.dateTo) createdAt.lte = new Date(filter.dateTo + "T23:59:59Z")
      where.createdAt = createdAt
    }
    req.log.info({ ...meta, actorId: actor.id, ...q }, "admin.rentals.list")
    const skip = (q.page - 1) * q.limit
    const [items, total] = await Promise.all([
      p.rentalVehicle.findMany({ where: where as never, skip, take: q.limit, orderBy: { createdAt: "desc" }, include: { owner: { select: { id: true, email: true } } } }),
      p.rentalVehicle.count({ where: where as never }),
    ])
    return { items, total, page: q.page, totalPages: Math.ceil(total / q.limit) }
  })

  app.get("/admin/rentals/export", async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const actor = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: actor.id, dateFrom, dateTo, format }, "admin.rentals.export")
    const { prisma: p } = await import("@camermove/db")
    const q = req.query as Record<string, string>
    const where: Record<string, unknown> = {}
    if (q.q) where.OR = [{ make: { contains: q.q, mode: "insensitive" } }]
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {}
      if (dateFrom) createdAt.gte = new Date(dateFrom)
      if (dateTo) createdAt.lte = new Date(dateTo + "T23:59:59Z")
      where.createdAt = createdAt
    }
    const rows = await p.rentalVehicle.findMany({ where: where as never, take: env.SEARCH_MAX_LIMIT, orderBy: { createdAt: "desc" } })
    const columns = ["id", "make", "model", "category", "pickupCity", "pricePerUnit", "durationUnit", "status", "partnerStatus", "ownerId", "createdAt"]
    return sendExport(reply, "admin-rentals", dateFrom, dateTo, format, rows as unknown as Record<string, unknown>[], columns)
  })

  app.put("/admin/rentals/:id", async (req) => {
    const { id } = RentalParams.parse(req.params)
    const actor = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    const body = RentalAdminUpdateBody.parse(req.body)
    const { prisma: p } = await import("@camermove/db")
    req.log.info({ ...meta, actorId: actor.id, entityId: id }, "admin.rental.update")
    const updated = await p.rentalVehicle.update({ where: { id }, data: body as never })
    await p.auditLog.create({ data: { actorId: actor.id, action: "admin.rental.update", entityType: "RentalVehicle", entityId: id, metadata: body as never } }).catch(() => {})
    return updated
  })
}

