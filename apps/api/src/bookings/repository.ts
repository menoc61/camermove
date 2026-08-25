import { prisma } from "@camermove/db"

export async function findBookingById(id: string) {
  return prisma.booking.findUnique({ where: { id }, include: { passengers: true, trip: true } })
}

export async function findExpiredHolds() {
  return prisma.booking.findMany({ where: { status: "pending_payment", holdExpiresAt: { lt: new Date() } } })
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
