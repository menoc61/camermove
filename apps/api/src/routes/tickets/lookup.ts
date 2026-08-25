/**
 * Public ticket lookup endpoint — no auth, rate-limited (per AGENTS.md §1).
 *
 * Sanitized view per AGENTS.md §2: returns only { reference, tripOrigin,
 * tripDestination, departureAt, status, passengerFirstName } — no email,
 * phone, idNumber, verificationCode. Prevents PII leakage if a QR screenshot
 * is shared.
 */
import type { FastifyInstance } from "fastify"
import { LookupQuery } from "../../tickets/validation"
import { prisma } from "@camermove/db"
import { loadEnv } from "@camermove/config"

export async function ticketLookupRoutes(app: FastifyInstance) {
  const env = loadEnv()
  const ipMax = env.RATE_LIMIT_IP_TICKETS_LOOKUP_MAX
  const appMax = env.RATE_LIMIT_APP_TICKETS_LOOKUP_MAX
  const windowMs = env.RATE_LIMIT_WINDOW_MS

  app.get("/tickets/lookup", async (req, reply) => {
    // Dual-layer rate limit (per AGENTS.md §1): IP + app-wide.
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? "unknown"
    const path = req.url.split("?")[0] ?? ""
    const ipKey = `rl:ip:${ip}:${path}`
    const appKey = `rl:app:${path}`
    const { getRedis } = await import("../../lib/redis")
    try {
      const r = getRedis()
      const ipCount = await r.incr(ipKey)
      if (ipCount === 1) await r.expire(ipKey, Math.ceil(windowMs / 1000))
      if (ipCount > ipMax) {
        reply.header("Retry-After", "60")
        return reply.code(429).send({ error: "RATE_LIMITED_IP", message: "Trop de requêtes, réessayez dans 60s" })
      }
      const appCount = await r.incr(appKey)
      if (appCount === 1) await r.expire(appKey, Math.ceil(windowMs / 1000))
      if (appCount > appMax) {
        reply.header("Retry-After", "60")
        return reply.code(429).send({ error: "RATE_LIMITED_APP", message: "Service temporairement saturé" })
      }
    } catch {}

    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    const query = LookupQuery.safeParse(req.query)
    if (!query.success) {
      req.log.info({ ...meta, error: "BAD_FORMAT" }, "ticket.lookup.bad_format")
      return reply.code(400).send({ error: "BAD_REQUEST", message: "Référence invalide (format attendu: CM-XXXXXXXX)" })
    }
    const ref = query.data.ref
    req.log.info({ ...meta, ref }, "ticket.public_lookup")

    // Look up the booking by reference, then the ticket
    const booking = await prisma.booking.findUnique({
      where: { reference: ref },
      include: {
        trip: { include: { route: true, transport: { select: { companyName: true } } } },
        passengers: { select: { fullName: true }, take: 1 },
        tickets: { select: { id: true, status: true }, take: 1 },
        user: { select: { firstName: true } },
      },
    })
    if (!booking) {
      return reply.code(404).send({ error: "NOT_FOUND", message: "Billet introuvable" })
    }
    const now = new Date()
    if (booking.trip.departureAt < now) {
      return reply.code(410).send({ error: "GONE", message: "Ce voyage est déjà parti" })
    }

    const firstName = booking.user.firstName ?? ""
    const ticketStatus = booking.tickets[0]?.status ?? "valid"
    const status = booking.status === "cancelled" || ticketStatus === "void" ? "void" : ticketStatus

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          actorId: "system:public",
          action: "ticket.public_lookup",
          entityType: "Ticket",
          entityId: booking.tickets[0]?.id ?? booking.id,
          metadata: { ref, ip: (meta as Record<string, unknown>).ip, ua: (meta as Record<string, unknown>).userAgent } as never,
        },
      })
    } catch {}

    return {
      reference: booking.reference,
      tripOrigin: booking.trip.route.originCity,
      tripDestination: booking.trip.route.destinationCity,
      departureAt: booking.trip.departureAt.toISOString(),
      status,
      passengerFirstName: firstName,
    }
  })
}
