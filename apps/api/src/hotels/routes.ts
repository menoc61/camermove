import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { prisma } from "@camermove/db"
import { AppError, ForbiddenError, NotFoundError } from "@camermove/config"
import { loadEnv } from "@camermove/config"
import { CreateHotelBookingBody, HotelSearchQuery, HotelBookingParams } from "./schema.js"
import { buildHotelWhere, findHotels, countHotels, findHotelById } from "./repository.js"
import { createHotelBooking, createHotelBookingPayment } from "./service.js"
import { getCached, setCached, cacheKey } from "../lib/cache.js"
import { parseExportQuery, sendExport } from "../lib/export.js"
import { buildPagination } from "../lib/query.js"

const HotelPayBody = z.object({
  provider: z.enum(["notchpay", "cinetpay"]).default("notchpay"),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  method: z.enum(["mobile_money", "card", "bank_transfer"]).optional(),
})

export async function hotelRoutes(app: FastifyInstance) {
  const env = loadEnv()

  // GET /hotels — search with cache 60s
  app.get("/hotels", async (req) => {
    const q = HotelSearchQuery.parse(req.query)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    const filters = { city: q.city, minPrice: q.minPrice, maxPrice: q.maxPrice, q: q.q, guests: q.guests, checkIn: q.checkIn, checkOut: q.checkOut }
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, city: q.city, filters, sort: q.orderBy, page: q.page, limit: q.perPage, groupBy: q.groupBy }, "hotels.search")

    const pagination = buildPagination({ page: q.page, perPage: q.perPage, limit: q.limit, offset: q.offset })
    const key = cacheKey("hotels", { city: q.city ?? "", minPrice: String(q.minPrice ?? ""), maxPrice: String(q.maxPrice ?? ""), q: q.q ?? "", guests: String(q.guests ?? ""), page: String(pagination.page ?? q.page), perPage: String(pagination.take), orderBy: q.orderBy ?? "", groupBy: q.groupBy ?? "" })
    const cached = await getCached<{ items: unknown[]; total: number; page: number; perPage: number; totalPages: number }>(key)
    if (cached) return { ...cached, meta: { cached: true } }

    const where = buildHotelWhere({ city: q.city, minPrice: q.minPrice, maxPrice: q.maxPrice, q: q.q })
    // orderBy: support "pricePerNight.asc" etc mapped to rooms? For hotels, default createdAt desc; if orderBy contains price treat as no-op or map to createdAt
    let orderBy: Record<string, unknown> | undefined
    if (q.orderBy) {
      const parts = q.orderBy.split(",").map((p) => p.trim())
      const mapped = parts.map((p) => {
        const [field, dir] = p.split(".")
        const d = dir === "desc" ? "desc" : "asc"
        // whitelist: createdAt, name, city
        if (["createdAt", "name", "city"].includes(field!)) return { [field!]: d }
        return { createdAt: d }
      })
      orderBy = mapped[0] as Record<string, unknown>
    }
    const skip = pagination.skip
    const take = pagination.take
    const [items, total] = await Promise.all([findHotels(where, skip, take, orderBy as never), countHotels(where)])
    const page = pagination.page ?? q.page
    const perPage = pagination.take
    const result = { items, total, page, perPage, totalPages: Math.ceil(total / perPage), meta: { cached: false } }
    await setCached(key, { items, total, page, perPage, totalPages: result.totalPages } as unknown as Record<string, unknown>, 60).catch(() => {})
    return result
  })

  // GET /hotels/:id — include rooms (not partner)
  app.get("/hotels/:id", async (req) => {
    const { id } = req.params as { id: string }
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    const user = (req as unknown as { user?: { id: string } }).user
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, entityId: id, userId: user?.id }, "hotels.get")
    const hotel = await findHotelById(id)
    if (!hotel) throw new NotFoundError("Hôtel introuvable")
    return hotel
  })

  // POST /hotels/bookings — atomic, idempotent via global plugin, RBAC
  app.post("/hotels/bookings", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req, reply) => {
    const body = CreateHotelBookingBody.parse(req.body)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.(
      { ...meta, hotelId: body.hotelId, roomTypeId: body.roomTypeId, guestCount: body.guests, userId: user.id },
      "hotels.booking.create",
    )
    const checkInDate = new Date(body.checkIn + "T00:00:00.000Z")
    const checkOutDate = new Date(body.checkOut + "T00:00:00.000Z")
    if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime())) throw new AppError(400, "VALIDATION", "Dates invalides")
    const booking = await createHotelBooking({
      hotelId: body.hotelId,
      roomTypeId: body.roomTypeId,
      userId: user.id,
      checkInDate,
      checkOutDate,
      guestCount: body.guests,
      guestNames: body.guestNames ?? [],
      specialRequests: body.specialRequests,
      meta: { ip: (meta as Record<string, unknown>).ip, os: (meta as Record<string, unknown>).os, browser: (meta as Record<string, unknown>).browser, device: (meta as Record<string, unknown>).device, userId: user.id } as Record<string, unknown>,
    })
    return reply.code(201).send(booking)
  })

  // GET /hotels/bookings/me — owner list with dateFrom/dateTo/q/page/limit
  app.get("/hotels/bookings/me", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req) => {
    const user = (req as unknown as { user: { id: string } }).user
    const query = req.query as Record<string, unknown>
    const page = Math.max(1, Number(query.page ?? 1))
    const perPage = Math.min(50, Math.max(1, Number(query.perPage ?? query.limit ?? 20)))
    const q = query.q as string | undefined
    const dateFrom = query.dateFrom as string | undefined
    const dateTo = query.dateTo as string | undefined
    const where: Record<string, unknown> = { userId: user.id }
    if (q) where.OR = [{ hotel: { name: { contains: q, mode: "insensitive" } } }, { hotel: { city: { contains: q, mode: "insensitive" } } }]
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {}
      if (dateFrom) createdAt.gte = new Date(dateFrom)
      if (dateTo) createdAt.lte = new Date(dateTo + "T23:59:59Z")
      where.createdAt = createdAt
    }
    const skip = (page - 1) * perPage
    const [items, total] = await Promise.all([
      prisma.hotelBooking.findMany({ where: where as never, include: { hotel: true, roomType: true, payment: true }, orderBy: { createdAt: "desc" }, skip, take: perPage }),
      prisma.hotelBooking.count({ where: where as never }),
    ])
    return { items, total, page, perPage, totalPages: Math.ceil(total / perPage) }
  })

  // GET /hotels/bookings/export — streamed csv/json with RBAC and SEARCH_MAX_LIMIT
  app.get("/hotels/bookings/export", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const q = (req.query as Record<string, unknown>).q as string | undefined
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, userId: user.id, dateFrom, dateTo, format }, "hotels.bookings.export")
    const isAdmin = user.role === "admin" || user.role === "super_admin"
    const where: Record<string, unknown> = {}
    if (!isAdmin) where.userId = user.id
    if (q) where.OR = [{ hotel: { name: { contains: q, mode: "insensitive" } } }]
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {}
      if (dateFrom) createdAt.gte = new Date(dateFrom)
      if (dateTo) createdAt.lte = new Date(dateTo + "T23:59:59Z")
      where.createdAt = createdAt
    }
    const rows = await prisma.hotelBooking.findMany({ where: where as never, take: env.SEARCH_MAX_LIMIT, orderBy: { createdAt: "desc" }, include: { hotel: true, roomType: true } })
    const columns = ["id", "hotelId", "roomTypeId", "userId", "checkInDate", "checkOutDate", "guestCount", "totalAmount", "status", "createdAt"]
    return sendExport(reply, "hotel-bookings", dateFrom, dateTo, format, rows as unknown as Record<string, unknown>[], columns)
  })

  // GET /hotels/bookings/:id — owner or admin
  app.get("/hotels/bookings/:id", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req) => {
    const { id } = HotelBookingParams.parse(req.params)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, entityId: id, userId: user.id }, "hotels.booking.get")
    const booking = await prisma.hotelBooking.findUnique({ where: { id }, include: { hotel: true, roomType: true, payment: true } })
    if (!booking) throw new NotFoundError("Réservation introuvable")
    const isAdmin = user.role === "admin" || user.role === "super_admin"
    if (!isAdmin && (booking as unknown as { userId: string }).userId !== user.id) throw new ForbiddenError("Accès refusé")
    return booking
  })

  // POST /hotels/bookings/:id/pay — polymorphic via payments provider (bookingId nullable)
  app.post("/hotels/bookings/:id/pay", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req) => {
    const { id } = HotelBookingParams.parse(req.params)
    const body = HotelPayBody.parse(req.body ?? {})
    const user = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, hotelBookingId: id, provider: body.provider, userId: user.id }, "hotels.booking.pay")
    return createHotelBookingPayment({ hotelBookingId: id, userId: user.id, provider: body.provider, phone: body.phone, email: body.email, method: body.method, meta: meta as Record<string, unknown> })
  })
}
