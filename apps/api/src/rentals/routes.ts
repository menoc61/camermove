import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { prisma } from "@camermove/db"
import { AppError, ForbiddenError, NotFoundError } from "@camermove/config"
import { loadEnv } from "@camermove/config"
import { RentalSearchQuery, CreateRentalBookingBody, RentalBookingParams } from "./schema.js"
import { buildRentalWhere, findRentals, countRentals, findRentalById } from "./repository.js"
import { createRentalBooking, createRentalBookingPayment } from "./service.js"
import { getCached, setCached, cacheKey } from "../lib/cache.js"
import { parseExportQuery, sendExport } from "../lib/export.js"
import { buildPagination } from "../lib/query.js"

const RentalPayBody = z.object({
  provider: z.enum(["notchpay", "cinetpay"]).default("notchpay"),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  method: z.enum(["mobile_money", "card", "bank_transfer"]).optional(),
})

export async function rentalRoutes(app: FastifyInstance) {
  const env = loadEnv()

  // GET /rentals — cached 60s
  app.get("/rentals", async (req) => {
    const q = RentalSearchQuery.parse(req.query)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    const pickupCity = q.pickupCity ?? q.city
    const filters = { pickupCity, category: q.category, hasDriver: q.hasDriver, q: q.q, minPrice: q.minPrice, maxPrice: q.maxPrice }
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.(
      { ...meta, pickupCity, category: q.category, hasDriver: q.hasDriver, q: q.q, page: q.page, limit: q.perPage },
      "rentals.search",
    )

    const pagination = buildPagination({ page: q.page, perPage: q.perPage })
    const key = cacheKey("rentals", {
      pickupCity: pickupCity ?? "",
      category: q.category ?? "",
      hasDriver: String(q.hasDriver ?? ""),
      q: q.q ?? "",
      minPrice: String(q.minPrice ?? ""),
      maxPrice: String(q.maxPrice ?? ""),
      page: String(pagination.page ?? q.page),
      perPage: String(pagination.take),
    })
    const cached = await getCached<{ items: unknown[]; total: number; page: number; perPage: number; totalPages: number }>(key)
    if (cached) return { ...cached, meta: { cached: true } }

    const where = buildRentalWhere({ pickupCity, category: q.category, hasDriver: q.hasDriver, minPrice: q.minPrice, maxPrice: q.maxPrice, q: q.q })
    const skip = pagination.skip
    const take = pagination.take
    const [items, total] = await Promise.all([findRentals(where, skip, take), countRentals(where)])
    const page = pagination.page ?? q.page
    const perPage = pagination.take
    const result = { items, total, page, perPage, totalPages: Math.ceil(total / perPage), meta: { cached: false } }
    await setCached(key, { items, total, page, perPage, totalPages: result.totalPages } as unknown as Record<string, unknown>, 60).catch(() => {})
    return result
  })

  // GET /rentals/:id
  app.get("/rentals/:id", async (req) => {
    const { id } = req.params as { id: string }
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    const user = (req as unknown as { user?: { id: string } }).user
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, entityId: id, userId: user?.id }, "rentals.get")
    const vehicle = await findRentalById(id)
    if (!vehicle) throw new NotFoundError("Véhicule introuvable")
    return vehicle
  })

  // POST /rentals/bookings — atomic, idempotent via global plugin
  app.post("/rentals/bookings", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req, reply) => {
    const body = CreateRentalBookingBody.parse(req.body)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    const start = new Date(body.startDate + "T00:00:00.000Z")
    const end = new Date(body.endDate + "T00:00:00.000Z")
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
      throw new AppError(400, "VALIDATION", "Dates invalides: endDate doit être après startDate")
    }
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.(
      { ...meta, rentalVehicleId: body.rentalVehicleId, pickupCity: body.pickupCity, dropoffCity: body.dropoffCity, userId: user.id },
      "rentals.booking.create",
    )
    const booking = await createRentalBooking({
      rentalVehicleId: body.rentalVehicleId,
      userId: user.id,
      startDate: start,
      endDate: end,
      pickupCity: body.pickupCity,
      pickupAddress: body.pickupAddress,
      dropoffCity: body.dropoffCity,
      dropoffAddress: body.dropoffAddress,
      driverName: body.driverName,
      driverPhone: body.driverPhone,
      meta: { ip: (meta as Record<string, unknown>).ip, os: (meta as Record<string, unknown>).os, browser: (meta as Record<string, unknown>).browser, device: (meta as Record<string, unknown>).device, userId: user.id } as Record<string, unknown>,
    })
    return reply.code(201).send(booking)
  })

  // GET /rentals/bookings/me — owner list with dateFrom/dateTo/q/page/limit
  app.get("/rentals/bookings/me", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req) => {
    const user = (req as unknown as { user: { id: string } }).user
    const query = req.query as Record<string, unknown>
    const page = Math.max(1, Number(query.page ?? 1))
    const perPage = Math.min(50, Math.max(1, Number(query.perPage ?? query.limit ?? 20)))
    const q = query.q as string | undefined
    const dateFrom = query.dateFrom as string | undefined
    const dateTo = query.dateTo as string | undefined
    const where: Record<string, unknown> = { userId: user.id }
    if (q) where.OR = [{ pickupCity: { contains: q, mode: "insensitive" } }, { dropoffCity: { contains: q, mode: "insensitive" } }]
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {}
      if (dateFrom) createdAt.gte = new Date(dateFrom)
      if (dateTo) createdAt.lte = new Date(dateTo + "T23:59:59Z")
      where.createdAt = createdAt
    }
    const skip = (page - 1) * perPage
    const [items, total] = await Promise.all([
      prisma.rentalBooking.findMany({ where: where as never, include: { vehicle: true, payment: true }, orderBy: { createdAt: "desc" }, skip, take: perPage }),
      prisma.rentalBooking.count({ where: where as never }),
    ])
    return { items, total, page, perPage, totalPages: Math.ceil(total / perPage) }
  })

  // GET /rentals/bookings/export — csv/json RBAC + SEARCH_MAX_LIMIT
  app.get("/rentals/bookings/export", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const query = req.query as Record<string, unknown>
    const q = query.q as string | undefined
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, userId: user.id, dateFrom, dateTo, format }, "rentals.bookings.export")
    const isAdmin = user.role === "admin" || user.role === "super_admin"
    const where: Record<string, unknown> = {}
    if (!isAdmin) where.userId = user.id
    if (q) where.OR = [{ pickupCity: { contains: q, mode: "insensitive" } }]
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {}
      if (dateFrom) createdAt.gte = new Date(dateFrom)
      if (dateTo) createdAt.lte = new Date(dateTo + "T23:59:59Z")
      where.createdAt = createdAt
    }
    const rows = await prisma.rentalBooking.findMany({ where: where as never, take: env.SEARCH_MAX_LIMIT, orderBy: { createdAt: "desc" }, include: { vehicle: true } })
    const columns = ["id", "rentalVehicleId", "userId", "startDate", "endDate", "duration", "durationUnit", "totalAmount", "pickupCity", "dropoffCity", "status", "createdAt"]
    return sendExport(reply, "rental-bookings", dateFrom, dateTo, format, rows as unknown as Record<string, unknown>[], columns)
  })

  // GET /rentals/bookings/:id — owner or admin
  app.get("/rentals/bookings/:id", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req) => {
    const { id } = RentalBookingParams.parse(req.params)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, entityId: id, userId: user.id }, "rentals.booking.get")
    const booking = await prisma.rentalBooking.findUnique({ where: { id }, include: { vehicle: true, payment: true } })
    if (!booking) throw new NotFoundError("Réservation introuvable")
    const isAdmin = user.role === "admin" || user.role === "super_admin"
    if (!isAdmin && (booking as unknown as { userId: string }).userId !== user.id) throw new ForbiddenError("Accès refusé")
    return booking
  })

  // POST /rentals/bookings/:id/pay — polymorphic
  app.post("/rentals/bookings/:id/pay", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req) => {
    const { id } = RentalBookingParams.parse(req.params)
    const body = RentalPayBody.parse(req.body ?? {})
    const user = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, rentalBookingId: id, provider: body.provider, userId: user.id }, "rentals.booking.pay")
    return createRentalBookingPayment({ rentalBookingId: id, userId: user.id, provider: body.provider, phone: body.phone, email: body.email, method: body.method, meta: meta as Record<string, unknown> })
  })

  const PresignBody = z.object({ filename: z.string().min(1).max(200), mimetype: z.string().min(1), size: z.number().int().positive().max(10 * 1024 * 1024).optional() })
  async function handleRentalPresign(req: unknown) {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    if (user.role !== "transporter_staff" && user.role !== "admin" && user.role !== "super_admin") throw new ForbiddenError("Accès réservé aux partenaires")
    const body = PresignBody.parse((req as { body: unknown }).body)
    const { getStorage, objectKey } = await import("@camermove/media")
    const storage = getStorage()
    const key = objectKey(`rentals/${user.id}/photos`, body.filename.split(".").pop() ?? "jpg")
    const uploadUrl = await storage.presignPut(key)
    return { objectKey: key, uploadUrl }
  }
  app.post("/rentals/presign", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req) => handleRentalPresign(req))
  app.post("/partner/rentals/presign", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req) => handleRentalPresign(req))

  const PartnerRentalCreate = z.object({ make: z.string().min(1), model: z.string().min(1), category: z.string().min(1), year: z.number().int().optional(), licensePlate: z.string().optional(), capacity: z.number().int().min(1).max(30), transmission: z.string().optional(), fuelType: z.string().optional(), hasDriver: z.boolean().optional(), pricePerUnit: z.number().int().positive(), durationUnit: z.enum(["hour", "day", "week", "month"]).optional(), pickupCity: z.string().min(1), pickupAddress: z.string().optional(), photos: z.array(z.string()).optional(), amenities: z.array(z.string()).optional(), status: z.string().optional() })

  app.get("/partner/rentals", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    if (user.role !== "transporter_staff" && user.role !== "admin" && user.role !== "super_admin") throw new ForbiddenError("Accès réservé aux partenaires")
    const where = user.role === "admin" || user.role === "super_admin" ? {} : { ownerId: user.id }
    const items = await prisma.rentalVehicle.findMany({ where: where as never, orderBy: { createdAt: "desc" } })
    return { items }
  })

  app.post("/partner/rentals", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req, reply) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    if (user.role !== "transporter_staff" && user.role !== "admin" && user.role !== "super_admin") throw new ForbiddenError("Accès réservé aux partenaires")
    const body = PartnerRentalCreate.parse(req.body)
    const created = await prisma.rentalVehicle.create({ data: { make: body.make, model: body.model, category: body.category, year: body.year, licensePlate: body.licensePlate, capacity: body.capacity, transmission: body.transmission, fuelType: body.fuelType, hasDriver: body.hasDriver ?? false, pricePerUnit: body.pricePerUnit, durationUnit: (body.durationUnit as never) ?? "day", pickupCity: body.pickupCity, pickupAddress: body.pickupAddress, photos: body.photos ?? [], amenities: body.amenities ?? [], status: (body.status as never) ?? "available", ownerId: user.id } as never })
    await prisma.auditLog.create({ data: { actorId: user.id, action: "partner.rental.create", entityType: "RentalVehicle", entityId: created.id } }).catch(() => {})
    return reply.code(201).send(created)
  })

  app.put("/partner/rentals/:id", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const { id } = req.params as { id: string }
    const existing = await prisma.rentalVehicle.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError("Véhicule introuvable")
    if ((existing as unknown as { ownerId: string | null }).ownerId !== user.id && user.role !== "admin" && user.role !== "super_admin") throw new ForbiddenError("Accès refusé")
    const body = PartnerRentalCreate.partial().parse(req.body)
    const updated = await prisma.rentalVehicle.update({ where: { id }, data: body as never })
    await prisma.auditLog.create({ data: { actorId: user.id, action: "partner.rental.update", entityType: "RentalVehicle", entityId: id } }).catch(() => {})
    return updated
  })
}
