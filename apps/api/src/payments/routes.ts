import type { FastifyInstance } from "fastify"
import { CreatePaymentBody, PaymentParams, PaymentListQuery } from "./schema.js"
import { createPayment, getPaymentById, listPayments } from "./service.js"
import { parseExportQuery, sendExport } from "../lib/export.js"
import { loadEnv } from "@camermove/config"

export async function paymentRoutes(app: FastifyInstance) {
  app.post("/payments", { preHandler: app.requireAuth() }, async (req, reply) => {
    const body = CreatePaymentBody.parse(req.body)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, bookingId: body.bookingId, provider: body.provider, ip: (meta as Record<string, unknown>).ip, ua: (meta as Record<string, unknown>).userAgent, userId: user.id }, "payment.create")
    const result = await createPayment({
      bookingId: body.bookingId,
      userId: user.id,
      provider: body.provider as never,
      phone: body.phone,
      email: body.email,
      method: body.method,
      meta: meta as Record<string, unknown>,
    })
    return reply.code(201).send({ payment: result.payment, authorizationUrl: result.authorizationUrl, paymentUrl: result.authorizationUrl })
  })

  app.get("/payments", { preHandler: app.requireAuth() }, async (req) => {
    const query = PaymentListQuery.parse(req.query)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    return listPayments(query as never, user)
  })

  app.get("/payments/:id", { preHandler: app.requireAuth() }, async (req) => {
    const { id } = PaymentParams.parse(req.params)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    return getPaymentById(id, user)
  })

  app.get("/payments/export", { preHandler: app.requireAuth() }, async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, userId: user.id, dateFrom, dateTo, format }, "payments.export")
    const where: Record<string, unknown> = {}
    const isAdmin = user.role === "admin" || user.role === "super_admin"
    if (!isAdmin) where.booking = { userId: user.id }
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {}
      if (dateFrom) createdAt.gte = new Date(dateFrom)
      if (dateTo) createdAt.lte = new Date(dateTo)
      where.createdAt = createdAt
    }
    const env = loadEnv()
    const { prisma } = await import("@camermove/db")
    const rows = await prisma.payment.findMany({
      where: where as never,
      take: env.SEARCH_MAX_LIMIT,
      orderBy: { createdAt: "desc" },
      include: { booking: true },
    })
    const columns = ["id", "bookingId", "provider", "providerRef", "amount", "currency", "method", "status", "createdAt"]
    return sendExport(reply, "payments", dateFrom, dateTo, format, rows as unknown as Record<string, unknown>[], columns)
  })

  // Admin aliases per AGENTS.md §2 GET /admin/* metadata
  app.get("/admin/payments", { preHandler: app.requireAuth("admin") }, async (req) => {
    const query = PaymentListQuery.parse(req.query)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    return listPayments(query as never, user)
  })

  app.get("/admin/payments/export", { preHandler: app.requireAuth("admin") }, async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: user.id, role: user.role, dateFrom, dateTo, format }, "admin.payments.export")
    const where: Record<string, unknown> = {}
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {}
      if (dateFrom) createdAt.gte = new Date(dateFrom)
      if (dateTo) createdAt.lte = new Date(dateTo)
      where.createdAt = createdAt
    }
    const env = loadEnv()
    const { prisma } = await import("@camermove/db")
    const rows = await prisma.payment.findMany({
      where: where as never,
      take: env.SEARCH_MAX_LIMIT,
      orderBy: { createdAt: "desc" },
      include: { booking: true },
    })
    const columns = ["id", "bookingId", "provider", "providerRef", "amount", "currency", "method", "status", "createdAt"]
    return sendExport(reply, "payments", dateFrom, dateTo, format, rows as unknown as Record<string, unknown>[], columns)
  })
}
