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
} from "./schema"

function adminAuth() {
  return async (req: Parameters<FastifyInstance["requireAuth"]>[0], reply: Parameters<FastifyInstance["requireAuth"]>[1]) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    if (user.role !== "admin" && user.role !== "super_admin") {
      reply.code(403).send({ error: "FORBIDDEN", message: "Accès réservé aux administrateurs" })
    }
  }
}

export async function adminRoutes(app: FastifyInstance) {
  const env = loadEnv()

  // All admin routes require admin role
  app.addHook("preHandler", async (req, reply) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    if (user.role !== "admin" && user.role !== "super_admin") {
      return reply.code(403).send({ error: "FORBIDDEN", message: "Accès réservé aux administrateurs" })
    }
  })

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

  app.put("/admin/partner-applications/:id/review", async (req) => {
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

  // Mark commission as paid
  app.put("/admin/commissions/:id/mark-paid", async (req) => {
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

  // ── Settings ────────────────────────────────────────────────────────────────
  // (settings routes are already in admin/settings.ts — include them here too)
  const { prisma } = await import("@camermove/db")

  app.get("/admin/settings", async (req) => {
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta }, "admin.settings.get")
    let settings = await prisma.appSettings.findUnique({ where: { id: "global" } })
    if (!settings) settings = await prisma.appSettings.create({ data: { id: "global" } })
    return settings
  })

  const { z } = await import("zod")
  const UpdateSettingsBody = z.object({
    commissionPercent: z.number().min(0).max(100).optional(),
    holdExpiryMinutes: z.number().int().min(1).max(1440).optional(),
    cancellationPolicy: z.string().optional(),
    smtpHost: z.string().optional(),
    smtpPort: z.number().int().optional(),
    smtpUser: z.string().optional(),
    smtpFrom: z.string().optional(),
    featureFlags: z.record(z.string(), z.boolean()).optional(),
    maintenanceMode: z.boolean().optional(),
  })

  app.put("/admin/settings", async (req) => {
    const body = UpdateSettingsBody.parse(req.body)
    const actorId = (req as unknown as { user: { id: string } }).user.id
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId, ...body }, "admin.settings.update")
    const settings = await prisma.appSettings.upsert({
      where: { id: "global" },
      update: { ...body, updatedBy: actorId },
      create: { id: "global", ...body, updatedBy: actorId },
    })
    await prisma.auditLog.create({
      data: { actorId, action: "admin.settings.update", entityType: "AppSettings", entityId: "global", metadata: body as never },
    }).catch(() => {})
    return settings
  })
}
