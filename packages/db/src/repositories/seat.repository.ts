import { prisma } from "../prisma"
import type { Prisma } from "@prisma/client"
import { ConflictError } from "@camermove/config"

export async function getSeatAvailability(tripId: string) {
  return prisma.seatAvailability.findUnique({ where: { tripId } })
}

/**
 * Hold N seats on a trip.
 *
 * When called from the booking-kernel reserve path, the caller passes an
 * existing Prisma transaction client so the seat hold and booking create
 * commit atomically. Otherwise the helper opens its own $transaction.
 */
export async function atomicHoldSeats(tripId: string, count: number, tx?: Prisma.TransactionClient): Promise<boolean> {
  const exec = async (t: Prisma.TransactionClient) => {
    const rows = await t.$queryRaw<Array<{ seatsAvailable: number; seatsHeld: number }>>`
      SELECT "seatsAvailable", "seatsHeld" FROM "SeatAvailability"
      WHERE "tripId" = ${tripId}
      FOR UPDATE
    `
    const row = rows[0]
    if (!row) throw new ConflictError("Aucune disponibilité pour ce trajet")
    if (row.seatsAvailable < count) throw new ConflictError("Places insuffisantes")
    await t.seatAvailability.update({
      where: { tripId },
      data: { seatsAvailable: { decrement: count }, seatsHeld: { increment: count } },
    })
    return true
  }
  return tx ? exec(tx) : prisma.$transaction(exec)
}

export async function atomicReleaseHeldSeats(tripId: string, count: number, tx?: Prisma.TransactionClient): Promise<void> {
  const exec = async (t: Prisma.TransactionClient) => {
    await t.seatAvailability.update({
      where: { tripId },
      data: { seatsAvailable: { increment: count }, seatsHeld: { decrement: count } },
    })
  }
  if (tx) return exec(tx)
  await prisma.$transaction(exec)
}

export async function atomicConfirmBookedSeats(tripId: string, count: number, tx?: Prisma.TransactionClient): Promise<void> {
  const exec = async (t: Prisma.TransactionClient) => {
    await t.seatAvailability.update({
      where: { tripId },
      data: { seatsHeld: { decrement: count }, seatsBooked: { increment: count } },
    })
  }
  if (tx) return exec(tx)
  await prisma.$transaction(exec)
}

/**
 * Mirror of atomicHoldSeats for event ticket categories. Mirrors the SeatAvailability
 * pattern with quantity / sold / held columns and a Postgres trigger that rejects
 * updates leaving the row invalid.
 */
export async function atomicHoldTicketCategory(ticketCategoryId: string, count: number): Promise<boolean> {
  const result = await prisma.$transaction(async (tx: any) => {
    const rows = await tx.$queryRaw<Array<{ quantity: number; sold: number; held: number }>>`
      SELECT quantity, sold, held FROM "TicketCategory"
      WHERE id = ${ticketCategoryId}
      FOR UPDATE
    `
    const row = rows[0]
    if (!row) throw new ConflictError("Catégorie de billet introuvable")
    if (row.quantity - row.sold - row.held < count) {
      throw new ConflictError("Billets insuffisants")
    }
    await tx.ticketCategory.update({
      where: { id: ticketCategoryId },
      data: { held: { increment: count } },
    })
    return true
  })
  return result
}

export async function atomicReleaseHeldTicketCategory(ticketCategoryId: string, count: number): Promise<void> {
  await prisma.$transaction(async (tx: any) => {
    await tx.ticketCategory.update({
      where: { id: ticketCategoryId },
      data: { held: { decrement: count } },
    })
  })
}

export async function atomicConfirmBookedTicketCategory(ticketCategoryId: string, count: number): Promise<void> {
  await prisma.$transaction(async (tx: any) => {
    await tx.ticketCategory.update({
      where: { id: ticketCategoryId },
      data: { held: { decrement: count }, sold: { increment: count } },
    })
  })
}