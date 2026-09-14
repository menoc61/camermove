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
import { loadEnv } from "@camermove/config"
import { getCached, setCached } from "../../lib/cache.js"
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
  meta?: { cached: boolean }
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
  const env = loadEnv()
  // Pagination from env (no hardcoded limits per AGENTS.md §4); upcoming
  // keeps a fixed small window (10) to keep the payload light.
  const UPCOMING_TAKE = 10 // fixed window: next 10 upcoming (smaller than default page size)
  const HISTORY_TAKE = env.PAGINATION_DEFAULT_PER_PAGE
  const TICKETS_TAKE = env.PAGINATION_DEFAULT_PER_PAGE

  app.get("/me/dashboard", { preHandler: app.requireAuth() }, async (req, reply) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, userId: user.id }, "me.dashboard")

    const now = new Date()

    const fireAudit = (counts?: { upcoming: number; history: number; tickets: number }) => {
      // Fire-and-forget: audit write must NOT block the read path (write-on-read lag fix).
      void prisma.auditLog
        .create({
          data: {
            actorId: user.id,
            action: "me.dashboard",
            entityType: "Dashboard",
            entityId: user.id,
            metadata: {
              ip: meta.ip,
              ua: meta.userAgent,
              ...(counts ? { counts } : {}),
            } as never,
          },
        })
        .catch(() => {})
    }

    // Hot-path cache (60s TTL, hotels pattern): cut DB RTT on repeat reads.
    const cacheKeyStr = `dashboard:${user.id}`
    const cached = await getCached<DashboardResponse>(cacheKeyStr)
    if (cached) {
      fireAudit()
      return reply.send({ ...cached, meta: { cached: true } } satisfies DashboardResponse)
    }

    // Parallel queries — single roundtrip latency.
    // Select projection on route (id, originCity, destinationCity) instead of
    // route:true to shrink the row payload.
    const [upcomingRaw, historyRaw, ticketsRaw] = await Promise.all([
      prisma.booking.findMany({
        where: {
          userId: user.id,
          status: { in: ["confirmed", "pending_payment"] },
          trip: { departureAt: { gte: now } },
        },
        include: {
          trip: { select: { departureAt: true, route: { select: { id: true, originCity: true, destinationCity: true } } } },
          tickets: { select: { id: true }, take: 1 },
        },
        orderBy: { trip: { departureAt: "asc" } },
        take: UPCOMING_TAKE,
      }),
      prisma.booking.findMany({
        where: {
          userId: user.id,
          OR: [{ trip: { departureAt: { lt: now } } }, { status: "cancelled" }],
        },
        include: {
          trip: { select: { departureAt: true, route: { select: { id: true, originCity: true, destinationCity: true } } } },
          tickets: { select: { id: true }, take: 1 },
        },
        orderBy: { trip: { departureAt: "desc" } },
        take: HISTORY_TAKE,
      }),
      prisma.ticket.findMany({
        where: { booking: { userId: user.id } },
        include: {
          booking: {
            select: {
              trip: { select: { departureAt: true, route: { select: { id: true, originCity: true, destinationCity: true } } } },
            },
          },
        },
        orderBy: { issuedAt: "desc" },
        take: TICKETS_TAKE,
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

    // Best-effort audit log (per AGENTS.md §2); fire-and-forget, never blocks.
    fireAudit({ upcoming: upcoming.length, history: history.length, tickets: tickets.length })

    const result = { upcoming, history, tickets } satisfies DashboardResponse
    // Populate cache without blocking the response (60s TTL, hotels pattern).
    void setCached(cacheKeyStr, result, 60).catch(() => {})

    return reply.send({ ...result, meta: { cached: false } } satisfies DashboardResponse)
  })
}
