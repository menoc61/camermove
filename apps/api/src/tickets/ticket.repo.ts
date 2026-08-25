import type { Prisma } from "@camermove/db"
import { prisma } from "@camermove/db"

/**
 * Repository helpers for Ticket reads. All writes happen inside the calling
 * service transaction (e.g. generateAndIssueTicket inside confirmPaymentSuccess
 * $transaction). Keep the data-access layer here per AGENTS.md §4.
 */

export async function findTicketById(id: string) {
  return prisma.ticket.findUnique({ where: { id } })
}

export async function findTicketByVerificationCode(verificationCode: string) {
  return prisma.ticket.findUnique({ where: { verificationCode } })
}

export async function findTicketByBookingIdInTx(tx: Prisma.TransactionClient, bookingId: string) {
  return tx.ticket.findFirst({ where: { bookingId } })
}

export async function findTicketByVerificationCodeWithTrip(code: string) {
  return prisma.ticket.findUnique({
    where: { verificationCode: code },
    include: {
      booking: {
        include: {
          trip: { include: { route: true, transport: { select: { companyName: true } } } },
          passengers: { select: { fullName: true } },
        },
      },
    },
  })
}
