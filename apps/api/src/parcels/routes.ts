import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { prisma } from "@camermove/db"
import { AppError, ForbiddenError, NotFoundError } from "@camermove/config"
import { loadEnv } from "@camermove/config"
import { CreateParcelSchema, ParcelStatusUpdateSchema, ParcelSearchQuery, ParcelIdParams, ParcelTrackParams } from "./schema.js"
import { buildParcelWhere, findParcels, countParcels, findParcelById, findParcelByTrackingNumber } from "./repository.js"
import { createParcel, advanceParcelStatus, sanitizeParcelForTrack, createParcelPayment } from "./service.js"
import { getCached, setCached, cacheKey } from "../lib/cache.js"
import { parseExportQuery, sendExport } from "../lib/export.js"
import { buildPagination } from "../lib/query.js"

const ParcelPayBody = z.object({
  provider: z.enum(["notchpay", "cinetpay"]).default("notchpay"),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  method: z.enum(["mobile_money", "card", "bank_transfer"]).optional(),
})

export async function parcelRoutes(app: FastifyInstance) {
  const env = loadEnv()

  // GET /parcels — owner list with cache 60s
  app.get("/parcels", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req) => {
    const q = ParcelSearchQuery.parse(req.query)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const pagination = buildPagination({ page: q.page, perPage: q.perPage, limit: q.limit, offset: q.offset })
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.(
      { ...meta, q: q.q, status: q.status, recipientCity: q.recipientCity, dateFrom: q.dateFrom, dateTo: q.dateTo, page: q.page, limit: q.perPage, userId: user.id },
      "parcels.list",
    )
    const isAdmin = user.role === "admin" || user.role === "super_admin"
    const where = buildParcelWhere({
      userId: isAdmin ? undefined : user.id,
      recipientCity: q.recipientCity,
      status: q.status,
      q: q.q,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
    })

    const key = cacheKey("parcels", {
      userId: isAdmin ? "admin" : user.id,
      q: q.q ?? "",
      status: q.status ?? "",
      recipientCity: q.recipientCity ?? "",
      dateFrom: q.dateFrom ?? "",
      dateTo: q.dateTo ?? "",
      page: String(pagination.page ?? q.page),
      perPage: String(pagination.take),
      orderBy: q.orderBy ?? "",
      groupBy: q.groupBy ?? "",
    })
    const cached = await getCached<{ items: unknown[]; total: number; page: number; perPage: number; totalPages: number }>(key)
    if (cached) return { ...cached, meta: { cached: true } }

    const skip = pagination.skip
    const take = pagination.take
    let orderBy: Record<string, unknown> | undefined
    if (q.orderBy) {
      const parts = q.orderBy.split(",").map((p) => p.trim())
      const mapped = parts.map((p) => {
        const [field, dir] = p.split(".")
        const d = dir === "desc" ? "desc" : "asc"
        if (["createdAt", "trackingNumber", "recipientCity", "status"].includes(field!)) return { [field!]: d }
        return { createdAt: d }
      })
      orderBy = mapped[0] as Record<string, unknown>
    }
    const [items, total] = await Promise.all([findParcels(where, skip, take, orderBy as never), countParcels(where)])
    const page = pagination.page ?? q.page
    const perPage = pagination.take
    const result = { items, total, page, perPage, totalPages: Math.ceil(total / perPage), meta: { cached: false } }
    await setCached(key, { items, total, page, perPage, totalPages: result.totalPages } as unknown as Record<string, unknown>, 60).catch(() => {})
    return result
  })

  // GET /parcels/export — owner/admin export
  app.get("/parcels/export", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const query = req.query as Record<string, unknown>
    const q = query.q as string | undefined
    const status = query.status as string | undefined
    const recipientCity = query.recipientCity as string | undefined
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, userId: user.id, dateFrom, dateTo, format }, "parcels.export")
    const isAdmin = user.role === "admin" || user.role === "super_admin"
    const where = buildParcelWhere({
      userId: isAdmin ? undefined : user.id,
      recipientCity,
      status,
      q,
      dateFrom,
      dateTo,
    })
    const rows = await prisma.parcel.findMany({ where: where as never, take: env.SEARCH_MAX_LIMIT, orderBy: { createdAt: "desc" }, include: { statusHistory: { orderBy: { createdAt: "asc" } } } })
    const columns = ["id", "trackingNumber", "senderName", "senderCity", "recipientName", "recipientCity", "parcelType", "weightKg", "shippingCost", "status", "currentLocation", "createdAt"]
    return sendExport(reply, "parcels", dateFrom, dateTo, format, rows as unknown as Record<string, unknown>[], columns)
  })

  // GET /admin/parcels/export — admin only export with same filters
  app.get("/admin/parcels/export", { preHandler: (app as unknown as { requireAuth: (role?: string) => unknown }).requireAuth("admin") as never }, async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const query = req.query as Record<string, unknown>
    const q = query.q as string | undefined
    const status = query.status as string | undefined
    const recipientCity = query.recipientCity as string | undefined
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, userId: user.id, dateFrom, dateTo, format }, "parcels.admin.export")
    const where = buildParcelWhere({ recipientCity, status, q, dateFrom, dateTo })
    const rows = await prisma.parcel.findMany({ where: where as never, take: env.SEARCH_MAX_LIMIT, orderBy: { createdAt: "desc" }, include: { statusHistory: true } })
    const columns = ["id", "trackingNumber", "userId", "senderName", "senderCity", "recipientName", "recipientCity", "parcelType", "weightKg", "shippingCost", "status", "currentLocation", "createdAt"]
    return sendExport(reply, "parcels", dateFrom, dateTo, format, rows as unknown as Record<string, unknown>[], columns)
  })

  // POST /parcels — idempotent via global plugin, tarif inside transaction
  app.post("/parcels", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req, reply) => {
    const body = CreateParcelSchema.parse(req.body)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.(
      { ...meta, senderCity: body.senderCity, recipientCity: body.recipientCity, parcelType: body.parcelType, userId: user.id },
      "parcels.create",
    )
    const parcel = await createParcel({
      senderName: body.senderName,
      senderPhone: body.senderPhone,
      recipientName: body.recipientName,
      recipientPhone: body.recipientPhone,
      senderCity: body.senderCity,
      recipientCity: body.recipientCity,
      recipientAddress: body.recipientAddress,
      parcelType: body.parcelType,
      weightKg: body.weightKg ?? null,
      dimensionsCm: body.dimensionsCm ?? null,
      description: body.description ?? null,
      declaredValue: body.declaredValue ?? null,
      operatorId: body.operatorId ?? null,
      userId: user.id,
      meta: { ip: (meta as Record<string, unknown>).ip, os: (meta as Record<string, unknown>).os, browser: (meta as Record<string, unknown>).browser, device: (meta as Record<string, unknown>).device, userId: user.id } as Record<string, unknown>,
    })
    return reply.code(201).send(parcel)
  })

  // GET /parcels/track/:trackingNumber — public sanitized (mask phones, no userId)
  app.get("/parcels/track/:trackingNumber", async (req) => {
    const { trackingNumber } = ParcelTrackParams.parse(req.params)
    const parcel = await findParcelByTrackingNumber(trackingNumber)
    if (!parcel) throw new NotFoundError("Colis introuvable")
    const sanitized = sanitizeParcelForTrack(parcel as unknown as Record<string, unknown>)
    return sanitized
  })

  // GET /parcels/:id — owner or admin
  app.get("/parcels/:id", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req) => {
    const { id } = ParcelIdParams.parse(req.params)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, entityId: id, userId: user.id }, "parcels.get")
    const parcel = await findParcelById(id)
    if (!parcel) throw new NotFoundError("Colis introuvable")
    const isAdmin = user.role === "admin" || user.role === "super_admin"
    if (!isAdmin && (parcel as unknown as { userId: string }).userId !== user.id) throw new ForbiddenError("Accès refusé")
    return parcel
  })

  // POST /parcels/:id/pay — polymorphic via Payment bookingId null
  app.post("/parcels/:id/pay", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req) => {
    const { id } = ParcelIdParams.parse(req.params)
    const body = ParcelPayBody.parse((req.body ?? {}) as unknown)
    const user = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, parcelId: id, provider: body.provider, userId: user.id }, "parcels.pay")
    return createParcelPayment({ parcelId: id, userId: user.id, provider: body.provider, phone: body.phone, email: body.email, method: body.method, meta: meta as Record<string, unknown> })
  })

  // PATCH /admin/parcels/:id/status — FSM admin only
  app.patch("/admin/parcels/:id/status", { preHandler: (app as unknown as { requireAuth: (role?: string) => unknown }).requireAuth("admin") as never }, async (req) => {
    const { id } = ParcelIdParams.parse(req.params)
    const body = ParcelStatusUpdateSchema.parse(req.body)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, parcelId: id, nextStatus: body.status, actorId: user.id }, "parcels.status.update")
    return advanceParcelStatus({ parcelId: id, actorId: user.id, role: user.role, nextStatus: body.status, location: body.location, note: body.note, meta: meta as Record<string, unknown> })
  })
}
