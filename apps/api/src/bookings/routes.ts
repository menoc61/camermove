import type { FastifyInstance } from "fastify"
import { CreateBookingBody, BookingParams, MyBookingsListQuery, MyTicketsListQuery } from "./schema"
import { createBooking, cancelBooking } from "./service"
import { BulkActionSchema, buildPagination } from "../lib/query"
import { ForbiddenError, NotFoundError } from "@camermove/config"
import { loadEnv } from "@camermove/config"
import { parseExportQuery, sendExport } from "../lib/export"
import { z } from "zod"
import { observeBooking } from "@camermove/observability"
import { prisma } from "@camermove/db"
import { countMyBookings, findMyBookings, countMyTickets, findMyTickets } from "./repository"
import type { Booking, Ticket } from "@camermove/db"

export async function bookingRoutes(app: FastifyInstance) {
  const env = loadEnv()

  app.post("/bookings", { preHandler: app.requireAuth() }, async (req, reply) => {
    const body = CreateBookingBody.parse(req.body)
    const user = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, tripId: body.tripId, seatCount: body.seatCount, passengerCount: body.passengers.length, userId: user.id }, "booking.create")
    const booking = await createBooking({ tripId: body.tripId, userId: user.id, seatCount: body.seatCount, passengers: body.passengers })
    // Creation metric lives in kernel reserve() (single source, all kinds).
    return reply.code(201).send({ booking, totalAmount: booking.totalAmount, holdExpiresAt: booking.holdExpiresAt })
  })

  app.get("/bookings/:id", { preHandler: app.requireAuth() }, async (req) => {
    const { id } = BookingParams.parse(req.params)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    const { prisma } = await import("@camermove/db")
    const booking = await prisma.booking.findUnique({ where: { id }, include: { passengers: true, trip: true } })
    if (!booking) {
      const { NotFoundError } = await import("@camermove/config")
      throw new NotFoundError("Réservation introuvable")
    }
    const isAdmin = user.role === "admin" || user.role === "super_admin"
    if (!isAdmin && (booking as unknown as { userId: string }).userId !== user.id) throw new ForbiddenError("Accès refusé")
    req.log.info({ ...meta, entityId: id, userId: user.id }, "booking.get")
    return booking
  })

  app.post("/bookings/:id/cancel", { preHandler: app.requireAuth() }, async (req) => {
    const { id } = BookingParams.parse(req.params)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, bookingId: id, userId: user.id }, "booking.cancel")
    const result = await cancelBooking(id, user.id, user.role)
    observeBooking("cancelled")
    return result
  })

  // Bulk cancel — accepts { ids: string[] } (ids max from env BULK_MAX_IDS). BulkActionSchema reused for limit but action-less payload also accepted.
  const BookingBulkCancelBody = z.object({ ids: z.array(z.string().cuid()).min(1).max(env.BULK_MAX_IDS) })
  app.post("/bookings/bulk/cancel", { preHandler: app.requireAuth() }, async (req) => {
    const raw = req.body as Record<string, unknown>
    // Support both {ids} and {ids, action} via BulkActionSchema fallback
    let ids: string[]
    try {
      ids = BookingBulkCancelBody.parse(raw).ids
    } catch {
      ids = BulkActionSchema.parse(raw).ids
    }
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, ids, actorId: user.id }, "bookings.bulk.cancel")
    // Enforce ownership: travelers only own bookings; admin/super_admin can bulk cancel any
    if (user.role === "admin" || user.role === "super_admin") {
      // admin must respect cancellation policy per-booking via service loop; fallback to direct update for tests
      const results = await Promise.allSettled(ids.map((bid) => cancelBooking(bid, user.id, user.role)))
      const affected = results.filter((r) => r.status === "fulfilled").length
      return { affected }
    }
    // For traveler, delegate to cancelBooking loop to honor policy + seat release instead of raw updateMany
    const results = await Promise.allSettled(ids.map((bid) => cancelBooking(bid, user.id, user.role)))
    const affected = results.filter((r) => r.status === "fulfilled").length
    // Audit bulk (best-effort)
    try {
      const { prisma: pa } = await import("@camermove/db")
      await pa.auditLog.create({ data: { actorId: user.id, action: "booking.bulk.cancel", entityType: "Booking", entityId: ids.join(","), metadata: { ids, affected } as never } })
    } catch {}
    return { affected }
  })

  app.get("/bookings/export", { preHandler: app.requireAuth() }, async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const user = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, userId: user.id, dateFrom, dateTo, format }, "bookings.export")
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

  // GET /me/bookings — owner-scoped paginated bookings, canonical envelope.
  // Powers the dashboard "Voyages" tab. `scope` separates upcoming/history
  // using the same semantics as /me/dashboard so the existing UI keeps working.
  app.get("/me/bookings", { preHandler: app.requireAuth() }, async (req) => {
    const q = MyBookingsListQuery.parse(req.query)
    const user = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, userId: user.id, scope: q.scope, page: q.page, perPage: q.perPage }, "me.bookings.list")
    const pagination = buildPagination({ page: q.page, perPage: q.perPage })
    const [items, total] = await Promise.all([
      findMyBookings(user.id, q.scope, pagination.skip, pagination.take),
      countMyBookings(user.id, q.scope),
    ])
    const perPage = pagination.take
    return {
      items: items.map(toDashboardItem),
      total,
      page: q.page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    }
  })

  // GET /tickets/me — owner-scoped paginated tickets, canonical envelope.
  // Powers the dashboard "Billets" section. Mirrors the shape returned by
  // /me/dashboard#tickets so TicketCard renders unchanged.
  app.get("/tickets/me", { preHandler: app.requireAuth() }, async (req) => {
    const q = MyTicketsListQuery.parse(req.query)
    const user = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, userId: user.id, page: q.page, perPage: q.perPage }, "tickets.me.list")
    const pagination = buildPagination({ page: q.page, perPage: q.perPage })
    const [rows, total] = await Promise.all([
      findMyTickets(user.id, pagination.skip, pagination.take),
      countMyTickets(user.id),
    ])
    const perPage = pagination.take
    return {
      items: rows.map(toTicketItem),
      total,
      page: q.page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    }
  })
}

type BookingWithTrip = Booking & {
  trip: { departureAt: Date; route: { originCity: string; destinationCity: string } }
  tickets: Array<{ id: string }>
}

type TicketWithBooking = Ticket & {
  booking: { trip: { departureAt: Date; route: { originCity: string; destinationCity: string } } }
}

function toDashboardItem(b: BookingWithTrip) {
  return {
    id: b.id,
    reference: b.reference,
    origin: b.trip.route.originCity,
    destination: b.trip.route.destinationCity,
    departureAt: b.trip.departureAt.toISOString(),
    totalAmount: b.totalAmount,
    status: b.status,
    ticketId: b.tickets[0]?.id ?? null,
  }
}

function toTicketItem(t: TicketWithBooking) {
  return {
    id: t.id,
    verificationCode: t.verificationCode,
    origin: t.booking.trip.route.originCity,
    destination: t.booking.trip.route.destinationCity,
    departureAt: t.booking.trip.departureAt.toISOString(),
    status: t.status,
  }
}
