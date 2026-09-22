import { prisma, atomicHoldSeats } from "@camermove/db"
import { ConflictError, createLogger } from "@camermove/config"
import { EVENT_TOPICS } from "@camermove/events"
import { tripReference } from "../references.js"
import type { ConfirmLink, ConfirmNotification, CancelEntity } from "../types.js"
import type { AdapterInstance } from "./types.js"
import { generateAndIssueTicket } from "../../tickets/ticket.service.js"
import { computeCommission } from "../../payments/commission.js"

const log = createLogger()

export const tripAdapter: AdapterInstance = {
  kind: "trip",
  table: "Trip",
  expiryTable: "Booking",
  idField: "id",
  notFoundMessage: "Trajet introuvable",

  async find(id: string) {
    return prisma.trip.findUnique({ where: { id }, include: { seatAvailability: true } })
  },

  async checkAvailability(entity: Record<string, unknown>, input: { meta: Record<string, unknown> }, tx: unknown) {
    const seatCount = Number(input.meta?.seatCount ?? 1)
    const tripId = entity.id as string
    if (!entity.seatAvailability) throw new ConflictError("Aucune disponibilité pour ce trajet")
    await atomicHoldSeats(tripId, seatCount, tx as never)
  },

  async findLink(paymentId: string, tx?: unknown) {
    // NOTE: the tx-branch findUnique MUST be awaited. Prisma 6 returns a lazy
    // proxy that is truthy with truthy `.booking`, so an unawaited result
    // sails past null-guards and crashes on `.trip.transportId`.
    const t = tx as { payment: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> } } | undefined
    const p = await (t
      ? t.payment.findUnique({ where: { id: paymentId }, include: { booking: { include: { trip: true } } } })
      : prisma.payment.findUnique({ where: { id: paymentId }, include: { booking: { include: { trip: true } } } }))
    if (!p) return null
    // The confirm link describes the BOOKING (entity), not the payment row:
    // entity id/status/owner/amount drive locks, idempotency and notifications.
    const booking = (p as unknown as { booking: {
      id: string; userId: string; tripId: string; seatCount: number
      totalAmount: number; status: string; reference: string
      trip: { transportId: string } | null
    } | null }).booking
    if (!booking?.trip) return null
    return {
      id: booking.id,
      userId: booking.userId,
      status: booking.status,
      totalAmount: booking.totalAmount,
      reference: booking.reference,
      tripId: booking.tripId,
      seatCount: booking.seatCount,
      transportId: booking.trip.transportId,
    }
  },

  isConfirmable(entity: ConfirmLink) { return entity.status === "pending_payment" },

  async confirm(tx: unknown, link: ConfirmLink, event: unknown) {
    const t = tx as { booking: { update: (a: unknown) => Promise<unknown> }
      seatAvailability: { findUnique: (a: unknown) => Promise<{ seatsHeld: number; seatsBooked: number } | null>; update: (a: unknown) => Promise<unknown> }
      $queryRawUnsafe: (q: string, ...v: unknown[]) => Promise<unknown>
      commission: { create: (a: unknown) => Promise<unknown> }
      auditLog: { create: (a: unknown) => Promise<unknown> }
      ticket: { updateMany: (a: unknown) => Promise<unknown> } }
    const tripId = link.tripId as string
    const seatCount = link.seatCount as number
    const totalAmount = link.totalAmount as number
    const transportId = link.transportId as string
    const bookingId = link.id as string

    // Lock seat inventory + transition held → booked (with clamping)
    await t.$queryRawUnsafe(`SELECT "tripId" FROM "SeatAvailability" WHERE "tripId" = $1 FOR UPDATE`, tripId)
    const sa = await t.seatAvailability.findUnique({ where: { tripId } })
    if (sa) {
      const held = sa.seatsHeld ?? 0
      const dec = Math.min(seatCount, held)
      if (held < seatCount) {
        log.warn({ held, seatCount, tripId }, "seatsHeld below seatCount, clamping")
      }
      await t.seatAvailability.update({
        where: { tripId },
        data: { seatsHeld: { decrement: dec }, seatsBooked: { increment: seatCount } },
      })
    }

    // Flip booking status
    await t.booking.update({ where: { id: bookingId }, data: { status: "confirmed" } })

    // Commission — rely on @unique(bookingId) to prevent duplicate on retry
    const c = await computeCommission(totalAmount, transportId)
    try {
      await t.commission.create({
        data: {
          bookingId,
          grossAmount: totalAmount,
          commissionAmount: c.commissionAmount,
          netAmount: c.netAmount,
          percentApplied: c.percentApplied,
          payoutStatus: "pending",
        },
      })
    } catch (e: unknown) {
      const msg = (e as Error).message ?? ""
      if (msg.includes("Unique constraint") || msg.includes("unique") || msg.includes("bookingId")) {
        // idempotent success — commission already exists
      } else throw e
    }

    // Generate ticket inside the same transaction (ACID per AGENTS.md §1).
    const issuedTicket = await generateAndIssueTicket(tx as never, bookingId)

    // Ticket creation audit (only if newly created)
    if (issuedTicket.createdNew) {
      try {
        await t.auditLog.create({
          data: {
            actorId: "system",
            action: "ticket.create",
            entityType: "Ticket",
            entityId: issuedTicket.id,
            metadata: {
              bookingId,
              ticketId: issuedTicket.id,
              userId: link.userId,
            } as never,
          },
        })
      } catch {}
    }
  },

  notification(entity: Record<string, unknown>): ConfirmNotification {
    const link = entity as ConfirmLink
    return { topic: EVENT_TOPICS.bookingConfirmed, type: "booking.confirmed", userId: link.userId, payload: { bookingId: link.id, reference: link.reference, amount: link.totalAmount } }
  },

  async findEntityByPaymentId(paymentId: string) {
    return prisma.payment.findUnique({ where: { id: paymentId }, include: { booking: true } })
  },

  makeReference(id: string) { return tripReference(id) },

  calcTotalAmount(entity: Record<string, unknown>, input?: { meta?: Record<string, unknown> }) {
    const price = Number(entity.price ?? 0)
    const seatCount = Number(input?.meta?.seatCount ?? 1)
    return price * seatCount
  },

  async create(data: Record<string, unknown>, tx: unknown) {
    const t = tx as { booking: { create: (a: unknown) => Promise<Record<string, unknown>> } }
    // The kernel spreads meta into `data`. For trip, meta carries `id: tripId`
    // (used by the kernel to lock the Trip row), plus `seatCount` and `passengers`.
    // Map the alias `id` onto the Booking.tripId column.
    const { passengers, id: tripId, ...rest } = data as { passengers?: Array<{ fullName: string; phone?: string }>; id?: string } & Record<string, unknown>
    return t.booking.create({
      data: {
        ...rest,
        tripId: tripId as string,
        ...(Array.isArray(passengers) ? { passengers: { create: passengers } } : {}),
      },
    })
  },

  assertCancellable() {},
  async findFresh(tx, id) { return (tx as { booking: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> } }).booking.findUnique({ where: { id } }) as unknown as Promise<Partial<CancelEntity> & CancelEntity | null> },
  async releaseInventory(tx, entity) {
    // Fail path: release held seats back to seatsAvailable. Booking link carries tripId + seatCount
    // (populated by findLink above), so we don't need a second round-trip.
    const tripId = (entity as unknown as { tripId?: string }).tripId
    const seatCount = (entity as unknown as { seatCount?: number }).seatCount ?? 0
    if (!tripId || seatCount <= 0) return
    const t = tx as { seatAvailability: { update: (a: unknown) => Promise<unknown> } }
    await t.seatAvailability.update({
      where: { tripId },
      data: { seatsAvailable: { increment: seatCount }, seatsHeld: { decrement: seatCount } },
    })
  },
  async cancel(tx, entity) {
    const t = tx as { booking: { update: (a: unknown) => Promise<unknown> } }
    const bookingId = (entity as { id: string }).id
    return t.booking.update({ where: { id: bookingId }, data: { status: "cancelled" } }) as unknown as Record<string, unknown>
  },
  auditAction: "booking.cancel",
  auditEntityType: "Booking",
}
