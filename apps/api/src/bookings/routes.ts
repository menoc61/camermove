import type { FastifyInstance } from "fastify"
import { CreateBookingBody, BookingParams } from "./schema"
import { createBooking, cancelBooking } from "./service"
import { BulkActionSchema } from "../lib/query"
import { loadEnv } from "@camermove/config"
import { parseExportQuery, sendExport } from "../lib/export"

export async function bookingRoutes(app: FastifyInstance) {
  const env = loadEnv()

  app.post("/bookings", { preHandler: app.requireAuth() }, async (req, reply) => {
    const body = CreateBookingBody.parse(req.body)
    const user = (req as unknown as { user: { id: string } }).user
    const booking = await createBooking({ tripId: body.tripId, userId: user.id, seatCount: body.seatCount, passengers: body.passengers })
    return reply.code(201).send({ booking, totalAmount: booking.totalAmount, holdExpiresAt: booking.holdExpiresAt })
  })

  app.get("/bookings/:id", { preHandler: app.requireAuth() }, async (req) => {
    const { id } = BookingParams.parse(req.params)
    const { prisma } = await import("@camermove/db")
    const booking = await prisma.booking.findUnique({ where: { id }, include: { passengers: true, trip: true } })
    if (!booking) {
      const { NotFoundError } = await import("@camermove/config")
      throw new NotFoundError("Réservation introuvable")
    }
    return booking
  })

  app.post("/bookings/:id/cancel", { preHandler: app.requireAuth() }, async (req) => {
    const { id } = BookingParams.parse(req.params)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    return cancelBooking(id, user.id, user.role)
  })

  app.post("/bookings/bulk/cancel", { preHandler: app.requireAuth() }, async (req) => {
    const body = BulkActionSchema.parse(req.body)
    const max = env.BULK_MAX_IDS
    if (body.ids.length > max) {
      const { BadRequestError } = await import("@camermove/config")
      throw new BadRequestError(`Trop d'IDs (max ${max})`)
    }
    const { prisma } = await import("@camermove/db")
    const user = (req as unknown as { user: { id: string } }).user
    const res = await prisma.booking.updateMany({ where: { id: { in: body.ids }, userId: user.id }, data: { status: "cancelled" } })
    return { affected: res.count }
  })

  app.get("/bookings/export", { preHandler: app.requireAuth() }, async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const user = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, userId: user.id, dateFrom, dateTo, format }, "bookings.export")
    const { prisma } = await import("@camermove/db")
    const where: Record<string, unknown> = { userId: user.id }
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {}
      if (dateFrom) createdAt.gte = new Date(dateFrom)
      if (dateTo) createdAt.lte = new Date(dateTo)
      where.createdAt = createdAt
    }
    const rows = await prisma.booking.findMany({ where: where as never, take: env.SEARCH_MAX_LIMIT, orderBy: { createdAt: "desc" } })
    const columns = ["id", "reference", "tripId", "seatCount", "totalAmount", "status", "createdAt"]
    return sendExport(reply, "bookings", dateFrom, dateTo, format, rows as unknown as Record<string, unknown>[], columns)
  })
}
