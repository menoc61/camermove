import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { prisma } from "@camermove/db"
import { AppError, ForbiddenError, NotFoundError } from "@camermove/config"
import { loadEnv } from "@camermove/config"
import { CreateEventBookingSchema, EventSearchQuery, EventBookingParams, EventIdParams } from "./schema.js"
import { buildEventWhere, findEvents, countEvents, findEventById } from "./repository.js"
import { createEventBooking, createEventBookingPayment, verifyEventTicket } from "./service.js"
import { getCached, setCached, cacheKey } from "../lib/cache.js"
import { parseExportQuery, sendExport } from "../lib/export.js"
import { buildPagination } from "../lib/query.js"

const EventPayBody = z.object({
  provider: z.enum(["notchpay", "cinetpay"]).default("notchpay"),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  method: z.enum(["mobile_money", "card", "bank_transfer"]).optional(),
})

const TicketVerifyBody = z.object({
  code: z.string().min(1).optional(),
  ticketNumber: z.string().min(1).optional(),
  verificationCode: z.string().min(1).optional(),
})

export async function eventRoutes(app: FastifyInstance) {
  const env = loadEnv()

  // GET /events — public catalog cache 60s, filtre status on_sale/limited + partnerStatus approved via repository
  app.get("/events", async (req) => {
    const q = EventSearchQuery.parse(req.query)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.(
      { ...meta, search: q.search, city: q.city, eventType: q.eventType, dateFrom: q.dateFrom, dateTo: q.dateTo, q: q.q, page: q.page, limit: q.perPage },
      "events.search",
    )

    const pagination = buildPagination({ page: q.page, perPage: q.perPage, limit: q.limit, offset: q.offset })
    const key = cacheKey("events", {
      search: q.search ?? "",
      city: q.city ?? "",
      eventType: q.eventType ?? "",
      dateFrom: q.dateFrom ?? "",
      dateTo: q.dateTo ?? "",
      q: q.q ?? "",
      page: String(pagination.page ?? q.page),
      perPage: String(pagination.take),
      orderBy: q.orderBy ?? "",
      groupBy: q.groupBy ?? "",
    })
    const cached = await getCached<{ items: unknown[]; total: number; page: number; perPage: number; totalPages: number }>(key)
    if (cached) return { ...cached, meta: { cached: true } }

    const where = buildEventWhere({ search: q.search, city: q.city, eventType: q.eventType, dateFrom: q.dateFrom, dateTo: q.dateTo, q: q.q })
    let orderBy: Record<string, unknown> | undefined
    if (q.orderBy) {
      const parts = q.orderBy.split(",").map((p) => p.trim())
      const mapped = parts.map((p) => {
        const [field, dir] = p.split(".")
        const d = dir === "desc" ? "desc" : "asc"
        if (["startDate", "createdAt", "name", "city"].includes(field!)) return { [field!]: d }
        return { startDate: d }
      })
      orderBy = mapped[0] as Record<string, unknown>
    }
    const skip = pagination.skip
    const take = pagination.take
    const [items, total] = await Promise.all([findEvents(where, skip, take, orderBy as never), countEvents(where)])
    const page = pagination.page ?? q.page
    const perPage = pagination.take
    const result = { items, total, page, perPage, totalPages: Math.ceil(total / perPage), meta: { cached: false } }
    await setCached(key, { items, total, page, perPage, totalPages: result.totalPages } as unknown as Record<string, unknown>, 60).catch(() => {})
    return result
  })

  // GET /events/:id — public detail incl ticketCategories
  app.get("/events/:id", async (req) => {
    const { id } = EventIdParams.parse(req.params)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    const user = (req as unknown as { user?: { id: string } }).user
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, entityId: id, userId: user?.id }, "events.get")
    const event = await findEventById(id)
    if (!event) throw new NotFoundError("Événement introuvable")
    return event
  })

  // POST /events/bookings — atomique, idempotent via global idempotencyPlugin, Zod cuid strict
  app.post("/events/bookings", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req, reply) => {
    const body = CreateEventBookingSchema.parse(req.body)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.(
      { ...meta, eventId: body.eventId, ticketCategoryId: body.ticketCategoryId, quantity: body.quantity, userId: user.id },
      "event.booking.create",
    )
    const booking = await createEventBooking({
      eventId: body.eventId,
      ticketCategoryId: body.ticketCategoryId,
      userId: user.id,
      quantity: body.quantity,
      meta: { ip: (meta as Record<string, unknown>).ip, os: (meta as Record<string, unknown>).os, browser: (meta as Record<string, unknown>).browser, device: (meta as Record<string, unknown>).device, userId: user.id } as Record<string, unknown>,
    })
    return reply.code(201).send(booking)
  })

  // GET /events/bookings/me — owner list with dateFrom/dateTo/q/page/limit
  app.get("/events/bookings/me", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req) => {
    const user = (req as unknown as { user: { id: string } }).user
    const query = req.query as Record<string, unknown>
    const page = Math.max(1, Number(query.page ?? 1))
    const perPage = Math.min(50, Math.max(1, Number(query.perPage ?? query.limit ?? 20)))
    const q = query.q as string | undefined
    const dateFrom = query.dateFrom as string | undefined
    const dateTo = query.dateTo as string | undefined
    const where: Record<string, unknown> = { userId: user.id }
    if (q) where.OR = [{ event: { name: { contains: q, mode: "insensitive" } } }, { ticketNumber: { contains: q, mode: "insensitive" } }]
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {}
      if (dateFrom) createdAt.gte = new Date(dateFrom)
      if (dateTo) createdAt.lte = new Date(dateTo + "T23:59:59Z")
      where.createdAt = createdAt
    }
    const skip = (page - 1) * perPage
    const [items, total] = await Promise.all([
      prisma.eventBooking.findMany({ where: where as never, include: { event: true, ticketCategory: true, payment: true }, orderBy: { createdAt: "desc" }, skip, take: perPage }),
      prisma.eventBooking.count({ where: where as never }),
    ])
    return { items, total, page, perPage, totalPages: Math.ceil(total / perPage) }
  })

  // GET /events/bookings/export — streamed csv/json with SEARCH_MAX_LIMIT
  app.get("/events/bookings/export", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const query = req.query as Record<string, unknown>
    const q = query.q as string | undefined
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, userId: user.id, dateFrom, dateTo, format }, "events.bookings.export")
    const isAdmin = user.role === "admin" || user.role === "super_admin"
    const where: Record<string, unknown> = {}
    if (!isAdmin) where.userId = user.id
    if (q) where.OR = [{ event: { name: { contains: q, mode: "insensitive" } } }]
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {}
      if (dateFrom) createdAt.gte = new Date(dateFrom)
      if (dateTo) createdAt.lte = new Date(dateTo + "T23:59:59Z")
      where.createdAt = createdAt
    }
    const rows = await prisma.eventBooking.findMany({ where: where as never, take: env.SEARCH_MAX_LIMIT, orderBy: { createdAt: "desc" }, include: { event: true, ticketCategory: true } })
    const columns = ["id", "eventId", "ticketCategoryId", "userId", "quantity", "totalAmount", "ticketNumber", "qrCode", "status", "createdAt"]
    return sendExport(reply, "event-bookings", dateFrom, dateTo, format, rows as unknown as Record<string, unknown>[], columns)
  })

  // GET /events/bookings/:id — owner or admin
  app.get("/events/bookings/:id", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req) => {
    const { id } = EventBookingParams.parse(req.params)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, entityId: id, userId: user.id }, "events.booking.get")
    const booking = await prisma.eventBooking.findUnique({ where: { id }, include: { event: true, ticketCategory: true, payment: true } })
    if (!booking) throw new NotFoundError("Réservation événement introuvable")
    const isAdmin = user.role === "admin" || user.role === "super_admin"
    if (!isAdmin && (booking as unknown as { userId: string }).userId !== user.id) throw new ForbiddenError("Accès refusé")
    return booking
  })

  // POST /events/bookings/:id/pay — polymorphic (Payment bookingId null + EventBooking.paymentId)
  app.post("/events/bookings/:id/pay", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req) => {
    const { id } = EventBookingParams.parse(req.params)
    const body = EventPayBody.parse((req.body ?? {}) as unknown)
    const user = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, eventBookingId: id, provider: body.provider, userId: user.id }, "events.booking.pay")
    return createEventBookingPayment({ eventBookingId: id, userId: user.id, provider: body.provider, phone: body.phone, email: body.email, method: body.method, meta: meta as Record<string, unknown> })
  })

  // GET /admin/events — admin list with same filters as public but includes all statuses? filtered via where same but admin sees via direct prisma with same where logic? Use buildEventWhere for consistency + admin bypass partnerStatus? Keep same.
  app.get("/admin/events", { preHandler: (app as unknown as { requireAuth: (role?: string) => unknown }).requireAuth("admin") as never }, async (req) => {
    const query = req.query as Record<string, unknown>
    const q = EventSearchQuery.parse(query)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, actorId: user.id, role: user.role, q: q.q, city: q.city }, "admin.events.list")
    const pagination = buildPagination({ page: q.page, perPage: q.perPage, limit: q.limit, offset: q.offset })
    // Admin sees all partnerStatus, not only approved — so build where without partnerStatus constraint for admin
    const where: Record<string, unknown> = {}
    if (q.search) where.name = { contains: q.search, mode: "insensitive" }
    if (q.q) where.OR = [{ name: { contains: q.q, mode: "insensitive" } }, { description: { contains: q.q, mode: "insensitive" } }, { city: { contains: q.q, mode: "insensitive" } }]
    if (q.city) where.city = { contains: q.city, mode: "insensitive" }
    if (q.eventType) where.eventType = q.eventType
    if (q.dateFrom || q.dateTo) {
      const startDate: Record<string, Date> = {}
      if (q.dateFrom) startDate.gte = new Date(q.dateFrom)
      if (q.dateTo) {
        const d = new Date(q.dateTo)
        d.setHours(23, 59, 59, 999)
        startDate.lte = d
      }
      if (Object.keys(startDate).length > 0) where.startDate = startDate
    }
    const skip = pagination.skip
    const take = pagination.take
    const [items, total] = await Promise.all([
      prisma.event.findMany({ where: where as never, include: { ticketCategories: true }, skip, take, orderBy: { startDate: "asc" } }),
      prisma.event.count({ where: where as never }),
    ])
    const page = pagination.page ?? q.page
    const perPage = pagination.take
    return { items, total, page, perPage, totalPages: Math.ceil(total / perPage) }
  })

  // GET /admin/events/export — admin export SEARCH_MAX_LIMIT
  app.get("/admin/events/export", { preHandler: (app as unknown as { requireAuth: (role?: string) => unknown }).requireAuth("admin") as never }, async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, actorId: user.id, role: user.role, dateFrom, dateTo, format }, "admin.events.export")
    const where: Record<string, unknown> = {}
    const q = (req.query as Record<string, unknown>).q as string | undefined
    if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }]
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {}
      if (dateFrom) createdAt.gte = new Date(dateFrom)
      if (dateTo) createdAt.lte = new Date(dateTo + "T23:59:59Z")
      where.createdAt = createdAt
    }
    const rows = await prisma.event.findMany({ where: where as never, take: env.SEARCH_MAX_LIMIT, orderBy: { createdAt: "desc" }, include: { ticketCategories: true } })
    const columns = ["id", "name", "eventType", "city", "venue", "startDate", "status", "partnerStatus", "createdAt"]
    return sendExport(reply, "events", dateFrom, dateTo, format, rows as unknown as Record<string, unknown>[], columns)
  })

  // GET /admin/event-bookings — admin list
  app.get("/admin/event-bookings", { preHandler: (app as unknown as { requireAuth: (role?: string) => unknown }).requireAuth("admin") as never }, async (req) => {
    const query = req.query as Record<string, unknown>
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    const page = Math.max(1, Number(query.page ?? 1))
    const perPage = Math.min(50, Math.max(1, Number(query.perPage ?? query.limit ?? 20)))
    const q = query.q as string | undefined
    const dateFrom = query.dateFrom as string | undefined
    const dateTo = query.dateTo as string | undefined
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, actorId: user.id, role: user.role, q, dateFrom, dateTo, page }, "admin.event-bookings.list")
    const where: Record<string, unknown> = {}
    if (q) where.OR = [{ event: { name: { contains: q, mode: "insensitive" } } }, { ticketNumber: { contains: q, mode: "insensitive" } }]
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {}
      if (dateFrom) createdAt.gte = new Date(dateFrom)
      if (dateTo) createdAt.lte = new Date(dateTo + "T23:59:59Z")
      where.createdAt = createdAt
    }
    const skip = (page - 1) * perPage
    const [items, total] = await Promise.all([
      prisma.eventBooking.findMany({ where: where as never, include: { event: true, ticketCategory: true, user: { select: { id: true, email: true } }, payment: true }, orderBy: { createdAt: "desc" }, skip, take: perPage }),
      prisma.eventBooking.count({ where: where as never }),
    ])
    return { items, total, page, perPage, totalPages: Math.ceil(total / perPage) }
  })

  // GET /admin/event-bookings/export — admin export
  app.get("/admin/event-bookings/export", { preHandler: (app as unknown as { requireAuth: (role?: string) => unknown }).requireAuth("admin") as never }, async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, actorId: user.id, role: user.role, dateFrom, dateTo, format }, "admin.event-bookings.export")
    const q = (req.query as Record<string, unknown>).q as string | undefined
    const where: Record<string, unknown> = {}
    if (q) where.OR = [{ event: { name: { contains: q, mode: "insensitive" } } }]
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {}
      if (dateFrom) createdAt.gte = new Date(dateFrom)
      if (dateTo) createdAt.lte = new Date(dateTo + "T23:59:59Z")
      where.createdAt = createdAt
    }
    const rows = await prisma.eventBooking.findMany({ where: where as never, take: env.SEARCH_MAX_LIMIT, orderBy: { createdAt: "desc" }, include: { event: true, ticketCategory: true } })
    const columns = ["id", "eventId", "ticketCategoryId", "userId", "quantity", "totalAmount", "ticketNumber", "qrCode", "status", "createdAt"]
    return sendExport(reply, "event-bookings", dateFrom, dateTo, format, rows as unknown as Record<string, unknown>[], columns)
  })

  // POST /tickets/verify — reuse for event QR (ticketNumber, qrCode, CM-T:code, ?code query)
  app.post("/tickets/verify", async (req) => {
    const query = req.query as Record<string, unknown>
    const body = (req.body ?? {}) as Record<string, unknown>
    const parsed = TicketVerifyBody.safeParse({ ...query, ...body })
    const code = (parsed.success ? (parsed.data.code ?? parsed.data.ticketNumber ?? parsed.data.verificationCode) : (query.code as string | undefined) ?? (body.code as string | undefined) ?? (body.ticketNumber as string | undefined) ?? (body.verificationCode as string | undefined)) as string | undefined
    if (!code) throw new AppError(400, "VALIDATION", "code or ticketNumber requis")
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, code }, "tickets.verify")
    // Try event ticket first, fall back to regular ticket verificationCode
    try {
      const eventBooking = await verifyEventTicket({ code })
      return { kind: "event", booking: eventBooking, verificationCode: code }
    } catch (e) {
      // Fallback to regular Ticket verificationCode check
      if ((e as Error).message?.includes("Événement") || (e as { status?: number }).status === 404) {
        const { findTicketByVerificationCodeWithTrip } = await import("../tickets/ticket.repo.js")
        // code may be CM-T:xxx, strip prefix
        const raw = code.startsWith("CM-T:") ? code.slice(5) : code
        const ticket = await findTicketByVerificationCodeWithTrip(raw)
        if (!ticket) throw new NotFoundError("Billet introuvable")
        return { kind: "trip", ticket }
      }
      throw e
    }
  })

  // GET /tickets/verify alias for query param style (tickets/lookup compatibility)
  app.get("/tickets/verify", async (req) => {
    const query = req.query as Record<string, unknown>
    const code = (query.code as string | undefined) ?? (query.ticketNumber as string | undefined) ?? (query.verificationCode as string | undefined)
    if (!code) throw new AppError(400, "VALIDATION", "code or ticketNumber requis")
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, code }, "tickets.verify.get")
    try {
      const eventBooking = await verifyEventTicket({ code })
      return { kind: "event", booking: eventBooking }
    } catch (e) {
      if ((e as { status?: number }).status === 404) {
        const { findTicketByVerificationCodeWithTrip } = await import("../tickets/ticket.repo.js")
        const raw = code.startsWith("CM-T:") ? code.slice(5) : code
        const ticket = await findTicketByVerificationCodeWithTrip(raw)
        if (!ticket) throw new NotFoundError("Billet introuvable")
        return { kind: "trip", ticket }
      }
      throw e
    }
  })
}
