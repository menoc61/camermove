import { prisma } from "@camermove/db"
import type { Prisma } from "@camermove/db"

export async function findBookingById(id: string) {
  return prisma.booking.findUnique({ where: { id }, include: { passengers: true, trip: true } })
}

export async function findExpiredHolds() {
  // Exclude bookings with an active pending/processing Payment: a late payment success
  // must still be able to confirm them (never auto-expire a paid-but-unconfirmed hold)
  return prisma.booking.findMany({
    where: {
      status: "pending_payment",
      holdExpiresAt: { lt: new Date() },
      payments: { none: { status: { in: ["pending", "processing"] } } },
    },
  })
}

export async function createBookingRecord(data: {
  reference: string
  tripId: string
  userId: string
  seatCount: number
  totalAmount: number
  holdExpiresAt: Date
  passengers: Array<{ fullName: string; phone?: string }>
}) {
  return prisma.booking.create({
    data: {
      reference: data.reference,
      tripId: data.tripId,
      userId: data.userId,
      seatCount: data.seatCount,
      totalAmount: data.totalAmount,
      status: "pending_payment",
      holdExpiresAt: data.holdExpiresAt,
      passengers: { create: data.passengers },
    },
    include: { passengers: true, trip: true },
  })
}

// Owner-scoped bookings for the dashboard "trips" tab. The `scope` filter maps
// to the same semantics used by /me/dashboard: upcoming = status in
// (confirmed, pending_payment) AND trip departure in the future, history =
// departure past OR cancelled. The trip+route include mirrors the dashboard
// response so the frontend can reuse the existing UpcomingTripCard component.
export function buildMyBookingsWhere(userId: string, scope: "upcoming" | "history" | "all"): Prisma.BookingWhereInput {
  const base: Prisma.BookingWhereInput = { userId }
  if (scope === "upcoming") {
    return {
      ...base,
      status: { in: ["confirmed", "pending_payment"] },
      trip: { departureAt: { gte: new Date() } },
    }
  }
  if (scope === "history") {
    return {
      ...base,
      OR: [{ trip: { departureAt: { lt: new Date() } } }, { status: "cancelled" }],
    }
  }
  return base
}

export async function findMyBookings(userId: string, scope: "upcoming" | "history" | "all", skip: number, take: number) {
  return prisma.booking.findMany({
    where: buildMyBookingsWhere(userId, scope),
    include: { trip: { include: { route: true } }, tickets: { select: { id: true }, take: 1 } },
    orderBy: scope === "upcoming" ? { trip: { departureAt: "asc" } } : { trip: { departureAt: "desc" } },
    skip,
    take,
  })
}

export async function countMyBookings(userId: string, scope: "upcoming" | "history" | "all") {
  return prisma.booking.count({ where: buildMyBookingsWhere(userId, scope) })
}

// Tickets for the dashboard "Billets" section. Mirrors the projection used
// in /me/dashboard so the existing TicketCard component can render directly.
export async function findMyTickets(userId: string, skip: number, take: number) {
  return prisma.ticket.findMany({
    where: { booking: { userId } },
    include: { booking: { include: { trip: { include: { route: true } } } } },
    orderBy: { issuedAt: "desc" },
    skip,
    take,
  })
}

export async function countMyTickets(userId: string) {
  return prisma.ticket.count({ where: { booking: { userId } } })
}
