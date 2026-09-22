/**
 * GET /api/v1/me/tickets/:id — full ticket detail for the authenticated owner.
 *
 * Per AGENTS.md §1 (statelessness): the route is a thin wrapper around
 * ticketService.getById from 04-01. Ownership is enforced here (404, NOT 403,
 * to avoid leaking ticket existence via response shape).
 *
 * Response shape includes the QR PNG as a data URL (already a string in
 * Ticket.qrDataUrl — no Buffer conversion needed). The frontend just embeds
 * it via <img src={qrDataUrl} />.
 */
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { prisma } from "@camermove/db"
import { NotFoundError } from "@camermove/config"
import { AGENCIES, BRAND_HUES } from "@camermove/shared"

const TicketParams = z.object({ id: z.string().cuid() })

export interface TicketDetailResponse {
  id: string
  reference: string
  verificationCode: string
  qrDataUrl: string
  status: string
  trip: {
    origin: string
    destination: string
    departureAt: string
    arrivalAt: string | null
    vehiclePlate: string | null
    seatCount: number
    vehicleTypeInfo: string | null
  }
  passengers: Array<{ firstName: string; lastName: string; seatNumber: string }>
  /** Boarding pass surface — agencies + boarding/drop-off corridor. */
  agency: {
    companyName: string
    brandColor: string
    accentIcon: string
    phone: string | null
    tagline: string | null
  }
  boardingStop: { name: string; offsetMinutes: number } | null
  dropOffStop: { name: string; offsetMinutes: number } | null
  seatLabels: string[]
  /** Used by the new sub-score rating panel. */
  ratingContext: {
    tripId: string
    transporterId: string
    bookingId: string
  }
}

export async function meTicketRoutes(app: FastifyInstance) {
  app.get("/me/tickets/:id", { preHandler: app.requireAuth() }, async (req, reply) => {
    const { id } = TicketParams.parse(req.params)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta

    // Fetch the ticket + booking + trip + passengers. 404 if any leg fails.
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            trip: {
              include: {
                route: true,
                vehicle: { select: { plateNumber: true } },
                transport: { select: { id: true, companyName: true, phone: true, tagline: true, email: true } },
              },
            },
            passengers: { select: { fullName: true } },
            boardingStop: { select: { name: true, offsetMinutes: true } },
            dropOffStop: { select: { name: true, offsetMinutes: true } },
          },
        },
      },
    })

    // Ownership check FIRST — if the user doesn't own the booking, return 404.
    // The DB query above returns null when no row matches. So:
    //   - ticket missing → 404
    //   - ticket exists but userId mismatch → 404 (no information leak)
    if (!ticket || ticket.booking.userId !== user.id) {
      // Constant-shape response to avoid leaking existence via timing/size.
      throw new NotFoundError("Billet introuvable")
    }

    const passengers = ticket.booking.passengers.map((p, i) => {
      const parts = p.fullName.trim().split(/\s+/)
      const firstName = parts[0] ?? ""
      const lastName = parts.slice(1).join(" ") ?? ""
      const seat = (ticket.booking.seatLabels[i] ?? `${i + 1}`).toString()
      return { firstName, lastName, seatNumber: seat }
    })

    const registry = AGENCIES.find((a) => a.email === (ticket.booking.trip.transport as unknown as { email: string }).email)
    const hue = registry ? BRAND_HUES[registry.brandKey] : undefined

    const body: TicketDetailResponse = {
      id: ticket.id,
      reference: ticket.booking.reference,
      verificationCode: ticket.verificationCode,
      qrDataUrl: ticket.qrDataUrl ?? "",
      status: ticket.status,
      trip: {
        origin: ticket.booking.trip.route.originCity,
        destination: ticket.booking.trip.route.destinationCity,
        departureAt: ticket.booking.trip.departureAt.toISOString(),
        arrivalAt: ticket.booking.trip.arrivalEstimateAt
          ? ticket.booking.trip.arrivalEstimateAt.toISOString()
          : null,
        vehiclePlate: ticket.booking.trip.vehicle?.plateNumber ?? null,
        seatCount: ticket.booking.seatCount,
        vehicleTypeInfo: ticket.booking.trip.vehicleTypeInfo ?? null,
      },
      passengers,
      agency: {
        companyName: ticket.booking.trip.transport.companyName,
        brandColor: hue?.primary ?? registry?.logoColor ?? "#0E0E0E",
        accentIcon: registry?.accentIcon ?? "Bus",
        phone: ticket.booking.trip.transport.phone ?? null,
        tagline: ticket.booking.trip.transport.tagline ?? null,
      },
      boardingStop: ticket.booking.boardingStop
        ? { name: ticket.booking.boardingStop.name, offsetMinutes: ticket.booking.boardingStop.offsetMinutes }
        : null,
      dropOffStop: ticket.booking.dropOffStop
        ? { name: ticket.booking.dropOffStop.name, offsetMinutes: ticket.booking.dropOffStop.offsetMinutes }
        : null,
      seatLabels: ticket.booking.seatLabels,
      ratingContext: {
        tripId: ticket.booking.tripId,
        transporterId: ticket.booking.trip.transport.id,
        bookingId: ticket.booking.id,
      },
    }

    // Best-effort audit log per AGENTS.md §2.
    try {
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "me.ticket.view",
          entityType: "Ticket",
          entityId: ticket.id,
          metadata: {
            ticketId: ticket.id,
            ip: meta.ip,
            ua: meta.userAgent,
          } as never,
        },
      })
    } catch (e) {
      req.log.warn({ err: (e as Error).message }, "me.ticket.view audit log failed (non-blocking)")
    }

    req.log.info({ ...meta, ticketId: ticket.id, userId: user.id }, "me.ticket.view")
    return reply.send(body)
  })
}
