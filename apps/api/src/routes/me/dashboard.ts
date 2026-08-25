/**
 * GET /api/v1/me/dashboard — aggregated dashboard view for the authenticated
 * traveler. Returns { upcoming, history, tickets } in a single roundtrip
 * (≤3 Prisma queries via Promise.all).
 *
 * Per AGENTS.md §2: audit log row with ip+ua; req.log.info with req.meta.
 * Per AGENTS.md §1: rate limit comes from the global rateLimitPlugin; no
 * additional hardcoded constants here.
 */
import type { FastifyInstance } from "fastify"
import { prisma } from "@camermove/db"
import type { Booking, Ticket } from "@camermove/db"

export interface DashboardItem {
  id: string
  reference: string
  origin: string
  destination: string
  departureAt: string
  totalAmount: number
  status: string
  ticketId: string | null
}

export interface DashboardTicketItem {
  id: string
  verificationCode: string
  origin: string
  destination: string
  departureAt: string
  status: string
}

export interface DashboardResponse {
  upcoming: DashboardItem[]
  history: DashboardItem[]
  tickets: DashboardTicketItem[]
}

type BookingWithTrip = Booking & {
  trip: { departureAt: Date; route: { originCity: string; destinationCity: string } }
  tickets: Array<{ id: string }>
}

type TicketWithBooking = Ticket & {
  booking: {
    trip: { departureAt: Date; route: { originCity: string; destinationCity: string } }
  }
}

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/me/dashboard", { preHandler: app.requireAuth() }, async (req, reply) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, userId: user.id }, "me.dashboard")

    const now = new Date()

    // Parallel queries — single roundtrip latency.
    const [upcomingRaw, historyRaw, ticketsRaw] = await Promise.all([
      prisma.booking.findMany({
        where: {
          userId: user.id,
          status: { in: ["confirmed", "pending_payment"] },
          trip: { departureAt: { gte: now } },
        },
        include: { trip: { include: { route: true } }, tickets: { select: { id: true }, take: 1 } },
        orderBy: { trip: { departureAt: "asc" } },
        take: 10,
      }),
      prisma.booking.findMany({
        where: {
          userId: user.id,
          OR: [{ trip: { departureAt: { lt: now } } }, { status: "cancelled" }],
        },
        include: { trip: { include: { route: true } }, tickets: { select: { id: true }, take: 1 } },
        orderBy: { trip: { departureAt: "desc" } },
        take: 20,
      }),
      prisma.ticket.findMany({
        where: { booking: { userId: user.id } },
        include: { booking: { include: { trip: { include: { route: true } } } } },
        orderBy: { issuedAt: "desc" },
        take: 20,
      }),
    ])

    const toItem = (b: BookingWithTrip): DashboardItem => ({
      id: b.id,
      reference: b.reference,
      origin: b.trip.route.originCity,
      destination: b.trip.route.destinationCity,
      departureAt: b.trip.departureAt.toISOString(),
      totalAmount: b.totalAmount,
      status: b.status,
      ticketId: b.tickets[0]?.id ?? null,
    })

    const upcoming: DashboardItem[] = upcomingRaw.map(toItem)
    const history: DashboardItem[] = historyRaw.map(toItem)
    const tickets: DashboardTicketItem[] = ticketsRaw.map((t: TicketWithBooking) => ({
      id: t.id,
      verificationCode: t.verificationCode,
      origin: t.booking.trip.route.originCity,
      destination: t.booking.trip.route.destinationCity,
      departureAt: t.booking.trip.departureAt.toISOString(),
      status: t.status,
    }))

    // Best-effort audit log (per AGENTS.md §2); failures must NOT block.
    try {
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "me.dashboard",
          entityType: "Dashboard",
          entityId: user.id,
          metadata: {
            ip: meta.ip,
            ua: meta.userAgent,
            counts: { upcoming: upcoming.length, history: history.length, tickets: tickets.length },
          } as never,
        },
      })
    } catch (e) {
      req.log.warn({ err: (e as Error).message }, "me.dashboard audit log failed (non-blocking)")
    }

    return reply.send({ upcoming, history, tickets } satisfies DashboardResponse)
  })
}
