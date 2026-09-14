import { prisma } from "../prisma"
import { ConflictError } from "@camermove/config"

export async function getSeatAvailability(tripId: string) {
  return prisma.seatAvailability.findUnique({ where: { tripId } })
}

export async function atomicHoldSeats(tripId: string, count: number): Promise<boolean> {
  const result = await prisma.$transaction(async (tx: any) => {
    const rows = await tx.$queryRaw<Array<{ seatsAvailable: number; seatsHeld: number }>>`
      SELECT "seatsAvailable", "seatsHeld" FROM "SeatAvailability"
      WHERE "tripId" = ${tripId}
      FOR UPDATE
    `
    const row = rows[0]
    if (!row) throw new ConflictError("Aucune disponibilité pour ce trajet")
    if (row.seatsAvailable < count) throw new ConflictError("Places insuffisantes")
    await tx.seatAvailability.update({
      where: { tripId },
      data: { seatsAvailable: { decrement: count }, seatsHeld: { increment: count } },
    })
    return true
  })
  return result
}

export async function atomicReleaseHeldSeats(tripId: string, count: number): Promise<void> {
  await prisma.$transaction(async (tx: any) => {
    await tx.seatAvailability.update({
      where: { tripId },
      data: { seatsAvailable: { increment: count }, seatsHeld: { decrement: count } },
    })
  })
}

export async function atomicConfirmBookedSeats(tripId: string, count: number): Promise<void> {
  await prisma.$transaction(async (tx: any) => {
    await tx.seatAvailability.update({
      where: { tripId },
      data: { seatsHeld: { decrement: count }, seatsBooked: { increment: count } },
    })
  })
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