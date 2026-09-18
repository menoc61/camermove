import { prisma, PaymentStatus } from "@camermove/db"
import { getAdapter } from "./adapters.js"

export async function expireHold(kind: string, entityId: string): Promise<boolean> {
  const adapter = getAdapter(kind as any)

  // Check status with SELECT FOR UPDATE
  const rows = await prisma.$queryRawUnsafe<{ id: string; status: string }[]>(
    `SELECT "id","status","holdExpiresAt" FROM "` + adapter.table + `" WHERE "id" = $1 FOR UPDATE`,
    entityId,
  )
  const fresh = rows[0]
  if (!fresh || fresh.status !== "pending_payment") return false

  const activePayment = await prisma.payment.findFirst({
    where: { bookingId: entityId, status: { in: ["pending", "processing"] as PaymentStatus[] } },
  })
  if (activePayment) return false

  // Update status
  await prisma.$executeRawUnsafe(
    `UPDATE "` + adapter.table + `" SET "status" = 'expired' WHERE "id" = $1`,
    entityId,
  )

  // Release seats for Trip bookings
  if (adapter.table === "Booking") {
    const bookingRows = await prisma.$queryRawUnsafe<{ tripId: string; seatCount: number }[]>(
      `SELECT "tripId","seatCount" FROM "Booking" WHERE "id" = $1`,
      entityId,
    )
    const b = bookingRows[0]
    if (b?.tripId && b.seatCount > 0) {
      const sa = await prisma.seatAvailability.findUnique({ where: { tripId: b.tripId } })
      if (sa) {
        await prisma.seatAvailability.update({
          where: { tripId: b.tripId },
          data: { seatsAvailable: { increment: b.seatCount }, seatsHeld: { decrement: b.seatCount } },
        })
      }
    }
  }

  return true
}

export async function expireHolds(kind: string): Promise<number> {
  const adapter = getAdapter(kind as any)
  const expired = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT "id" FROM "` + adapter.table + `" WHERE "status" = 'pending_payment' AND "holdExpiresAt" < NOW()`,
  )
  let count = 0
  for (const entity of expired) {
    if (await expireHold(kind, entity.id)) count++
  }
  return count
}
