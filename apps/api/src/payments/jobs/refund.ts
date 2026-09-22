import { prisma } from "@camermove/db"
import { BadRequestError } from "@camermove/config"
import { calcRefund } from "@camermove/shared"
import { publishEvent, makeEvent, EVENT_TOPICS } from "@camermove/events"
import { getProvider } from "../providers/index.js"
import type { SupportedProvider } from "../providers/types.js"
/**
 * Refund a confirmed payment/booking.
 * Guarded to prevent double refund and negative seat counts.
 */
export async function refundPayment(paymentId: string, actorId: string, reason?: string, amount?: number) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { booking: true } })
  if (!payment) throw new Error(`payment not found ${paymentId}`)
  const booking = payment.booking as unknown as { id: string; tripId: string; seatCount: number; status: string; totalAmount: number }

  if (booking.status !== "confirmed") throw new Error(`booking not confirmed, status=${booking.status}`)
  if (payment.status !== "success") throw new Error(`payment not success, status=${payment.status}`)

  if (amount !== undefined && (!Number.isInteger(amount) || amount <= 0 || amount > payment.amount)) {
    throw new BadRequestError("Montant de remboursement invalide")
  }

  // Optional: evaluate cancellation tier for fee (reuse evaluateCancellation if available)
  let tierRefundAmount = booking.totalAmount
  try {
    const { evaluateCancellation } = await import("../../bookings/cancellation.js")
    const trip = await prisma.trip.findUnique({ where: { id: (booking as unknown as { tripId: string }).tripId } })
    if (trip) {
      const res = await evaluateCancellation({ booking: booking as never, trip: trip as never, actor: "admin" as never, actorId, transporterId: null })
      if (typeof res.refundAmount === "number") tierRefundAmount = res.refundAmount
    }
  } catch {
    // fallback full refund if cancellation module not available
    tierRefundAmount = calcRefund(booking.totalAmount, 100)
  }
  const refundAmount = amount ?? tierRefundAmount

  // Transaction: mark payment refunded, booking refunded, release seats, audit, commission adjustment
  let refundId: string | null = null
  await prisma.$transaction(async (tx: unknown) => {
    const t = tx as typeof prisma
    await (t as unknown as { $queryRaw: (q: TemplateStringsArray, ...v: unknown[]) => Promise<unknown> }).$queryRaw`SELECT "id" FROM "Booking" WHERE "id"=${booking.id} FOR UPDATE`
    await (t as unknown as { $queryRaw: (q: TemplateStringsArray, ...v: unknown[]) => Promise<unknown> }).$queryRaw`SELECT "tripId" FROM "SeatAvailability" WHERE "tripId"=${booking.tripId} FOR UPDATE`

    const freshPayment = await t.payment.findUnique({ where: { id: paymentId } })
    const freshBooking = await t.booking.findUnique({ where: { id: booking.id } })
    if (!freshPayment || !freshBooking) return
    if (freshPayment.status === "refunded") return
    if (freshBooking.status === "refunded") return

    // Provider refund BEFORE final writes. Time-bounded by the adapters'
    // own 10s AbortController. On provider failure the admin intent still
    // stands (seat release + booking/payment refunded below); the provider
    // leg is tracked on the Refund row as pending/manual.
    let providerRefundId: string | null = null
    let providerStatus: "pending" | "processing" | "complete" = "pending"
    let providerError: string | null = null
    try {
      const provider = getProvider(payment.provider as SupportedProvider)
      const pr = await provider.createRefund({
        paymentRef: payment.providerRef ?? payment.id,
        amount: refundAmount,
        reason,
        metadata: { paymentId, actorId },
      })
      providerRefundId = pr.providerRefundId
      providerStatus = pr.status === "complete" ? "complete" : pr.status === "processing" ? "processing" : "pending"
    } catch (e) {
      providerError = (e as Error).message
      providerStatus = "pending"
    }

    await t.payment.update({ where: { id: paymentId }, data: { status: "refunded", webhookPayload: { reason, refundAmount } as never } })
    await t.booking.update({ where: { id: booking.id }, data: { status: "refunded" } })

    // Persist first-class Refund row (idempotent per paymentId) with the
    // provider leg attached when available; status mirrors the provider.
    try {
      const existing = await t.refund.findUnique({ where: { paymentId } }).catch(() => null)
      if (!existing) {
        const created = await t.refund.create({
          data: {
            paymentId,
            amount: refundAmount,
            currency: payment.currency ?? "XAF",
            reason: reason ?? null,
            status: providerStatus,
            actorId,
            ...(providerRefundId ? { providerRefundId } : {}),
            ...(providerError ? { webhookPayload: { reason, refundAmount, providerError, manual: true } as never } : {}),
          },
        })
        refundId = created.id
      } else {
        refundId = existing.id
      }
    } catch {
      // Refund table missing (migration not applied) — payment/booking already refunded.
    }

    const sa = await t.seatAvailability.findUnique({ where: { tripId: booking.tripId } })
    if (sa) {
      await t.seatAvailability.update({
        where: { tripId: booking.tripId },
        data: { seatsAvailable: { increment: booking.seatCount }, seatsBooked: { decrement: booking.seatCount } },
      })
    }

    // Void tickets
    await t.ticket.updateMany({ where: { bookingId: booking.id, status: "valid" }, data: { status: "void" } })

    // Audit — resolve a REAL actor; never fabricate User rows.
    // Falls back to the migrated service principal ("system") only for automated refunds.
    const actor = await t.user.findUnique({ where: { id: actorId }, select: { id: true } })
    if (!actor && actorId !== "system") {
      throw new Error(`refund_actor_not_found:${actorId}`)
    }
    try {
      await t.auditLog.create({
        data: {
          actorId: actor ? actorId : "system",
          action: "payment.refunded",
          entityType: "Payment",
          entityId: paymentId,
          metadata: { reason, refundAmount, bookingId: booking.id } as never,
        },
      })
    } catch {}

    // Commission payoutStatus to pending_refund or keep pending — publish event after tx
  })

  // Publish refund event best-effort via the typed outbox (C4).
  // Single envelope, single seam — no more hand-rolled kafkajs ceremony.
  try {
    await publishEvent(
      EVENT_TOPICS.paymentRefunded,
      makeEvent("payment.refunded", booking.id, {
        type: "payment.refunded",
        paymentId,
        bookingId: booking.id,
        refundAmount,
      }),
    )
  } catch {}

  return { refundAmount, refundId, paymentId, bookingId: booking.id }
}
