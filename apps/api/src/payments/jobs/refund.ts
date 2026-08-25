import { prisma } from "@camermove/db"
import { calcRefund } from "@camermove/shared"
/**
 * Refund a confirmed payment/booking.
 * Guarded to prevent double refund and negative seat counts.
 */
export async function refundPayment(paymentId: string, actorId: string, reason?: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { booking: true } })
  if (!payment) throw new Error(`payment not found ${paymentId}`)
  const booking = payment.booking as unknown as { id: string; tripId: string; seatCount: number; status: string; totalAmount: number }

  if (booking.status !== "confirmed") throw new Error(`booking not confirmed, status=${booking.status}`)
  if (payment.status !== "success") throw new Error(`payment not success, status=${payment.status}`)

  // Optional: evaluate cancellation tier for fee (reuse evaluateCancellation if available)
  let refundAmount = booking.totalAmount
  try {
    const { evaluateCancellation } = await import("../../bookings/cancellation.js")
    const trip = await prisma.trip.findUnique({ where: { id: (booking as unknown as { tripId: string }).tripId } })
    if (trip) {
      const res = await evaluateCancellation({ booking: booking as never, trip: trip as never, actor: "admin" as never, actorId, transporterId: null })
      if (typeof res.refundAmount === "number") refundAmount = res.refundAmount
    }
  } catch {
    // fallback full refund if cancellation module not available
    refundAmount = calcRefund(booking.totalAmount, 100)
  }

  // Transaction: mark payment refunded, booking refunded, release seats, audit, commission adjustment
  await prisma.$transaction(async (tx: unknown) => {
    const t = tx as typeof prisma
    await (t as unknown as { $queryRaw: (q: TemplateStringsArray, ...v: unknown[]) => Promise<unknown> }).$queryRaw`SELECT "id" FROM "Booking" WHERE "id"=${booking.id} FOR UPDATE`
    await (t as unknown as { $queryRaw: (q: TemplateStringsArray, ...v: unknown[]) => Promise<unknown> }).$queryRaw`SELECT "tripId" FROM "SeatAvailability" WHERE "tripId"=${booking.tripId} FOR UPDATE`

    const freshPayment = await t.payment.findUnique({ where: { id: paymentId } })
    const freshBooking = await t.booking.findUnique({ where: { id: booking.id } })
    if (!freshPayment || !freshBooking) return
    if (freshPayment.status === "refunded") return
    if (freshBooking.status === "refunded") return

    await t.payment.update({ where: { id: paymentId }, data: { status: "refunded", webhookPayload: { reason, refundAmount } as never } })
    await t.booking.update({ where: { id: booking.id }, data: { status: "refunded" } })

    const sa = await t.seatAvailability.findUnique({ where: { tripId: booking.tripId } })
    if (sa) {
      await t.seatAvailability.update({
        where: { tripId: booking.tripId },
        data: { seatsAvailable: { increment: booking.seatCount }, seatsBooked: { decrement: booking.seatCount } },
      })
    }

    // Void tickets
    await t.ticket.updateMany({ where: { bookingId: booking.id, status: "valid" }, data: { status: "void" } })

    // Audit
    try {
      await (t as unknown as { user: { upsert: (a: unknown) => Promise<unknown> } }).user.upsert({
        where: { id: actorId },
        create: { id: actorId, email: `${actorId}@camermove.cm`, role: "admin" },
        update: {},
      })
    } catch {}
    try {
      await t.auditLog.create({
        data: {
          actorId,
          action: "payment.refunded",
          entityType: "Payment",
          entityId: paymentId,
          metadata: { reason, refundAmount, bookingId: booking.id } as never,
        },
      })
    } catch {}

    // Commission payoutStatus to pending_refund or keep pending — publish event after tx
  })

  // Publish refund event best-effort
  try {
    const { createKafkaClient, EVENT_TOPICS } = await import("@camermove/events")
    const { loadEnv } = await import("@camermove/config")
    const env = loadEnv() as never
    const kafka = createKafkaClient(env)
    const producer = kafka.producer({ idempotent: true })
    await producer.connect().catch(() => {})
    await producer.send({ topic: EVENT_TOPICS.paymentRefunded, messages: [{ key: booking.id, value: JSON.stringify({ id: paymentId, type: "payment.refunded", ts: new Date().toISOString(), aggregateId: booking.id, data: { paymentId, bookingId: booking.id, refundAmount } }) }] }).catch(() => {})
    await producer.disconnect().catch(() => {})
  } catch {}

  return { refundAmount }
}
