// @ts-nocheck
/**
 * Transactional payment state machine + reconciliation.
 * All mutations are inside Prisma $transaction with SELECT ... FOR UPDATE
 * to serialize against expireHolds (T-03-16, T-03-20).
 */
import { prisma } from "@camermove/db"
import { getProvider } from "../providers/index.js"
import type { SupportedProvider } from "../providers/types.js"
import { computeCommission } from "../commission.js"
import { EVENT_TOPICS } from "@camermove/events"
import { generateAndIssueTicket } from "../../tickets/ticket.service.js"
import type { IssuedTicket } from "../../tickets/ticket.service.js"

class UnrecoverableError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = "UnrecoverableError"
  }
}

/** Extract booking reference from DomainEvent that wraps NotchPay or CinetPay webhook. */
function extractReference(event: { aggregateId?: string; data: unknown }): string {
  const agg = (event as { aggregateId?: string }).aggregateId
  if (agg) return agg
  const data = event.data as Record<string, unknown>
  // NotchPay: data.data.reference or data.reference
  if (data && typeof data === "object") {
    const inner = (data as Record<string, unknown>).data as Record<string, unknown> | undefined
    if (inner?.reference) return String(inner.reference)
    if (data.reference) return String(data.reference)
    if (data.transaction_id) return String(data.transaction_id)
    if ((data as Record<string, unknown>).cpm_trans_id) return String((data as Record<string, unknown>).cpm_trans_id)
  }
  return ""
}

/** Double-check amount for CinetPay before confirming. */
async function mustVerifyProvider(payment: { provider: string; providerRef: string | null; amount: number }, booking: { totalAmount: number }) {
  if (!payment.providerRef) throw new UnrecoverableError("payment providerRef missing")
  const provider = getProvider(payment.provider as SupportedProvider)
  let verified: Awaited<ReturnType<typeof provider.verifyPayment>>
  try {
    verified = await provider.verifyPayment(payment.providerRef)
  } catch (e) {
    // Transient network — throw to trigger retry/backoff
    throw e
  }

  // CinetPay amount spoof guard (T-03-15)
  if (payment.provider === "cinetpay") {
    if (verified.status === "success") {
      // success iff code 00 + ACCEPTED is already enforced in adapter; additionally check amount/currency
      if (verified.amount !== booking.totalAmount) {
        // amount mismatch — treat as failed, do not confirm
        return { status: "failed" as const, verified, reason: "amount mismatch" }
      }
      if (verified.currency && verified.currency !== "XAF") {
        return { status: "failed" as const, verified, reason: "currency mismatch" }
      }
    }
  }
  return { status: verified.status, verified }
}

export async function confirmPaymentSuccess(payment: { id: string; bookingId: string }, event: unknown): Promise<void> {
  // Fetch booking to get tripId for row locks
  const p = await prisma.payment.findUnique({ where: { id: payment.id }, include: { booking: { include: { trip: true } } } })
  if (!p) throw new UnrecoverableError(`payment not found ${payment.id}`)
  const booking = p.booking as unknown as { id: string; tripId: string; seatCount: number; totalAmount: number; status: string; trip: { transportId: string }; userId: string; reference: string }

  // Issued ticket is captured during the transaction so we can publish the
  // typed NotificationEvent after commit. Only set when a NEW ticket is
  // generated (not on idempotent replay).
  let issuedTicket: IssuedTicket | null = null
  let ticketCreateSucceeded = false

  await prisma.$transaction(async (tx: unknown) => {
    const t = tx as typeof prisma
    // Serialize against expireHolds — lock Booking and SeatAvailability
    await (t as unknown as { $queryRaw: (q: TemplateStringsArray, ...v: unknown[]) => Promise<unknown> }).$queryRaw`SELECT "id" FROM "Booking" WHERE "id"=${p.bookingId} FOR UPDATE`
    await (t as unknown as { $queryRaw: (q: TemplateStringsArray, ...v: unknown[]) => Promise<unknown> }).$queryRaw`SELECT "tripId" FROM "SeatAvailability" WHERE "tripId"=${booking.tripId} FOR UPDATE`

    // Re-fetch inside tx under lock
    const freshPayment = await t.payment.findUnique({ where: { id: p.id } })
    const freshBooking = await t.booking.findUnique({ where: { id: p.bookingId } })
    if (!freshPayment || !freshBooking) return
    // Idempotency guard — already success
    if (freshPayment.status === "success") return
    if (["failed", "expired", "refunded"].includes(freshPayment.status as string)) return
    // Expiry race: only confirm if still pending_payment
    if (freshBooking.status !== "pending_payment") return

    await t.payment.update({ where: { id: p.id }, data: { status: "success", webhookPayload: event as never } })
    await t.booking.update({ where: { id: p.bookingId }, data: { status: "confirmed" } })

    // Seat transition: seatsHeld -> seatsBooked, guard not negative
    const sa = await t.seatAvailability.findUnique({ where: { tripId: booking.tripId } })
    if (sa) {
      const held = sa.seatsHeld ?? 0
      const dec = Math.min(booking.seatCount, held)
      // If held < seatCount, log warn but clamp to avoid negative
      if (held < booking.seatCount) {
        console.warn(`seatsHeld ${held} < seatCount ${booking.seatCount} for trip ${booking.tripId}, clamping`)
      }
      // seatsHeld decrement only by dec, seatsBooked increment full count
      await t.seatAvailability.update({
        where: { tripId: booking.tripId },
        data: {
          seatsHeld: { decrement: dec },
          seatsBooked: { increment: booking.seatCount },
        },
      })
      // If we clamped, ensure seatsHeld never negative via extra guard (already clamped)
    }

    // Commission — rely on @unique(bookingId) to prevent duplicate on retry
    const c = await computeCommission(booking.totalAmount, booking.trip.transportId)
    try {
      await t.commission.create({
        data: {
          bookingId: booking.id,
          grossAmount: booking.totalAmount,
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

    // Audit log — actorId "system" references the migrated service principal
    // (User id='system', created by migration 20260826114221_system_principal).
    try {
      await t.auditLog.create({
        data: {
          actorId: "system",
          action: "payment.success",
          entityType: "Payment",
          entityId: p.id,
          metadata: { provider: p.provider, reference: booking.id, deliveryId: (event as Record<string, unknown>)?.id ?? null } as never,
        },
      })
    } catch {}

    // Generate ticket inside the same transaction (ACID per AGENTS.md §1).
    // If ticket generation throws, the entire transaction rolls back — no orphan Commission.
    try {
      issuedTicket = await generateAndIssueTicket(t as never, p.bookingId)
      ticketCreateSucceeded = true
    } catch (e) {
      console.error(`[reconciliation] ticket generation failed for booking ${p.bookingId}:`, (e as Error).message)
      throw e
    }

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
              bookingId: p.bookingId,
              ticketId: issuedTicket.id,
              userId: (booking as unknown as { userId: string }).userId,
            } as never,
          },
        })
      } catch {}
    }
  })

  // Publish Kafka events after tx commit (best-effort)
  try {
    const { createKafkaClient } = await import("@camermove/events")
    const { loadEnv } = await import("@camermove/config")
    const env = loadEnv() as unknown as { KAFKA_BROKERS: string }
    const kafka = createKafkaClient(env as never)
    const producer = kafka.producer({ idempotent: true })
    await producer.connect().catch(() => {})
    const payload = { paymentId: p.id, bookingId: booking.id, amount: booking.totalAmount }
    await producer.send({ topic: EVENT_TOPICS.paymentCompleted, messages: [{ key: booking.id, value: JSON.stringify({ id: p.id, type: "payment.completed", ts: new Date().toISOString(), aggregateId: booking.id, data: payload }) }] }).catch(() => {})

    // Phase 4: publish typed NotificationEvent (not the bare {userId, bookingId} of Phase 3).
    // When a new ticket was just issued, fire ticket.issued; otherwise fire payment.confirmed.
    const candidate: IssuedTicket | null = ticketCreateSucceeded ? (issuedTicket as IssuedTicket | null) : null
    const justIssuedTicket: IssuedTicket | null = candidate && candidate.createdNew ? candidate : null
    if (justIssuedTicket) {
      const typedEvent = {
        type: "ticket.issued",
        userId: booking.userId,
        payload: {
          bookingId: booking.id,
          reference: booking.reference,
          ticketId: justIssuedTicket.id,
          verificationCode: justIssuedTicket.verificationCode,
          amount: booking.totalAmount,
          tripId: p.booking.tripId,
        },
      }
      await producer
        .send({
          topic: EVENT_TOPICS.ticketIssued,
          messages: [
            {
              key: booking.id,
              value: JSON.stringify({
                id: `ticket-${justIssuedTicket.id}`,
                type: "ticket.issued",
                ts: new Date().toISOString(),
                aggregateId: booking.id,
                data: typedEvent,
              }),
            },
          ],
        })
        .catch(() => {})

      // Also fire payment.confirmed (channels still need to send an "amount received" notification)
      const paymentEvent = {
        type: "payment.confirmed",
        userId: booking.userId,
        payload: { bookingId: booking.id, reference: booking.reference, amount: booking.totalAmount },
      }
      await producer
        .send({
          topic: EVENT_TOPICS.paymentConfirmed,
          messages: [
            {
              key: booking.id,
              value: JSON.stringify({
                id: `payment-confirmed-${p.id}`,
                type: "payment.confirmed",
                ts: new Date().toISOString(),
                aggregateId: booking.id,
                data: paymentEvent,
              }),
            },
          ],
        })
        .catch(() => {})

      // Also fire booking.confirmed (channels can use a different template for the full booking confirmation)
      const bookingEvent = {
        type: "booking.confirmed",
        userId: booking.userId,
        payload: {
          bookingId: booking.id,
          reference: booking.reference,
          amount: booking.totalAmount,
          tripId: p.booking.tripId,
        },
      }
      await producer
        .send({
          topic: EVENT_TOPICS.bookingConfirmed,
          messages: [
            {
              key: booking.id,
              value: JSON.stringify({
                id: `booking-confirmed-${p.id}`,
                type: "booking.confirmed",
                ts: new Date().toISOString(),
                aggregateId: booking.id,
                data: bookingEvent,
              }),
            },
          ],
        })
        .catch(() => {})
    } else {
      // Replay (idempotent): no new ticket, but still fire payment.confirmed for the
      // notification fan-out in case the previous run crashed before publishing.
      const paymentEvent = {
        type: "payment.confirmed",
        userId: booking.userId,
        payload: { bookingId: booking.id, reference: booking.reference, amount: booking.totalAmount },
      }
      await producer
        .send({
          topic: EVENT_TOPICS.paymentConfirmed,
          messages: [
            {
              key: booking.id,
              value: JSON.stringify({
                id: `payment-confirmed-${p.id}`,
                type: "payment.confirmed",
                ts: new Date().toISOString(),
                aggregateId: booking.id,
                data: paymentEvent,
              }),
            },
          ],
        })
        .catch(() => {})
    }
    await producer.disconnect().catch(() => {})
  } catch {}
}

export async function failPayment(payment: { id: string; bookingId: string }, event: unknown, targetStatus: "failed" | "expired" = "failed"): Promise<void> {
  const p = await prisma.payment.findUnique({ where: { id: payment.id }, include: { booking: true } })
  if (!p) return
  const booking = p.booking as unknown as { id: string; tripId: string; seatCount: number; status: string }

  await prisma.$transaction(async (tx: unknown) => {
    const t = tx as typeof prisma
    await (t as unknown as { $queryRaw: (q: TemplateStringsArray, ...v: unknown[]) => Promise<unknown> }).$queryRaw`SELECT "id" FROM "Booking" WHERE "id"=${p.bookingId} FOR UPDATE`
    await (t as unknown as { $queryRaw: (q: TemplateStringsArray, ...v: unknown[]) => Promise<unknown> }).$queryRaw`SELECT "tripId" FROM "SeatAvailability" WHERE "tripId"=${booking.tripId} FOR UPDATE`

    const freshPayment = await t.payment.findUnique({ where: { id: p.id } })
    const freshBooking = await t.booking.findUnique({ where: { id: p.bookingId } })
    if (!freshPayment || !freshBooking) return
    if (["success", "refunded"].includes(freshPayment.status as string)) return // terminal
    if (freshPayment.status === targetStatus) return

    await t.payment.update({ where: { id: p.id }, data: { status: targetStatus, webhookPayload: event as never } })

    // Only release held seats if booking still pending_payment (expiry race)
    if (freshBooking.status === "pending_payment") {
      await t.booking.update({ where: { id: p.bookingId }, data: { status: "expired" } })
      const sa = await t.seatAvailability.findUnique({ where: { tripId: booking.tripId } })
      if (sa) {
        const held = sa.seatsHeld ?? 0
        const dec = Math.min(booking.seatCount, held)
        await t.seatAvailability.update({
          where: { tripId: booking.tripId },
          data: { seatsAvailable: { increment: dec }, seatsHeld: { decrement: dec } },
        })
      }
    }

    try {
      await t.auditLog.create({
        data: {
          actorId: "system",
          action: `payment.${targetStatus}`,
          entityType: "Payment",
          entityId: p.id,
          metadata: { provider: p.provider, deliveryId: (event as Record<string, unknown>)?.id ?? null } as never,
        },
      })
    } catch {}

    // Publish failed event best-effort after tx
  })

  try {
    const { createKafkaClient } = await import("@camermove/events")
    const { loadEnv } = await import("@camermove/config")
    const env = loadEnv() as never
    const kafka = createKafkaClient(env)
    const producer = kafka.producer({ idempotent: true })
    await producer.connect().catch(() => {})
    await producer.send({ topic: EVENT_TOPICS.paymentFailed, messages: [{ key: p.bookingId, value: JSON.stringify({ id: p.id, type: "payment.failed", ts: new Date().toISOString(), aggregateId: p.bookingId, data: { paymentId: p.id, bookingId: p.bookingId, status: targetStatus } }) }] }).catch(() => {})
    await producer.disconnect().catch(() => {})
  } catch {}
}

/**
 * Main worker entry for Kafka payment.webhook.received.
 * Idempotent, verifies via provider, then drives to terminal state.
 */
export async function processPaymentWebhook(event: { id: string; type: string; aggregateId?: string; data: unknown; ts?: string }): Promise<void> {
  const reference = extractReference(event as never)
  if (!reference) throw new UnrecoverableError(`missing reference for event ${event.id}`)

  // Lookup payment via booking reference (primary) then providerRef fallback
  type PaymentRow = { id: string; bookingId: string; provider: string; providerRef: string | null; status: string; amount: number }
  let payment: PaymentRow | null = null
  let booking: { id: string; tripId: string; totalAmount: number; transportId?: string } | null = null

  const b = await prisma.booking.findUnique({ where: { reference }, include: { trip: true, payments: true } })
  if (b) {
    booking = { id: b.id, tripId: b.tripId, totalAmount: b.totalAmount, transportId: (b.trip as unknown as { transportId: string }).transportId }
    // Prefer pending/processing payment for this booking
    const payments = (b as unknown as { payments: PaymentRow[] }).payments
    payment = (payments.find((x) => x && ["pending", "processing"].includes(x.status)) ?? payments[0] ?? null) as PaymentRow | null
  }
  if (!payment) {
    const byRef = await prisma.payment.findFirst({ where: { providerRef: reference } })
    if (byRef) {
      payment = byRef as unknown as PaymentRow
      const bb = await prisma.booking.findUnique({ where: { id: byRef.bookingId }, include: { trip: true } })
      if (bb) booking = { id: bb.id, tripId: bb.tripId, totalAmount: bb.totalAmount, transportId: (bb.trip as unknown as { transportId: string }).transportId }
    }
  }
  // Also try providerRef composite for cinetpay: booking.reference is aggregateId but cinetpay uses cpm_trans_id which equals booking.reference
  if (!payment) {
    throw new UnrecoverableError(`payment not found for reference ${reference}`)
  }
  // At this point payment is non-null
  const pay: PaymentRow = payment
  if (!booking) {
    const bb = await prisma.booking.findUnique({ where: { id: pay.bookingId }, include: { trip: true } })
    if (!bb) throw new UnrecoverableError(`booking not found for payment ${pay.id}`)
    booking = { id: bb.id, tripId: bb.tripId, totalAmount: bb.totalAmount, transportId: (bb.trip as unknown as { transportId: string }).transportId }
  }

  // Idempotency guard inside worker second layer (T-03-13) — payment is non-null here
  if (pay.status === "success") return
  if (["failed", "expired", "refunded"].includes(pay.status)) return

  // Provider verify step — mandatory for CinetPay, safety for NotchPay
  const verifyResult = await mustVerifyProvider(pay as never, booking as never)

  if (verifyResult.status === "success") {
    await confirmPaymentSuccess(pay, event)
  } else if (verifyResult.status === "failed" || verifyResult.status === "expired") {
    await failPayment(pay, event, verifyResult.status as "failed" | "expired")
  } else {
    // pending — leave for reconciliation
    return
  }
}

/**
 * Reconcile stale pending payments older than 5m.
 * Calls provider verifyPayment and drives to terminal state.
 */
export async function reconcileStalePayments(): Promise<number> {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000)
  const stale = await prisma.payment.findMany({
    where: { status: { in: ["pending", "processing"] as never }, createdAt: { lt: cutoff } },
    take: 100,
  })
  let count = 0
  for (const p of stale) {
    try {
      const provider = getProvider(p.provider as SupportedProvider)
      if (!p.providerRef) continue
      const verified = await provider.verifyPayment(p.providerRef)
      // Amount mismatch guard already in mustVerifyProvider for success path; here also check
      if (verified.status === "success") {
        // For CinetPay ensure amount matches booking
        if (p.provider === "cinetpay") {
          const booking = await prisma.booking.findUnique({ where: { id: p.bookingId } })
          if (booking && verified.amount !== booking.totalAmount) {
            await failPayment(p as never, verified.rawPayload, "failed")
            count++
            continue
          }
        }
        await confirmPaymentSuccess(p as never, verified.rawPayload)
      } else if (verified.status === "failed" || verified.status === "expired") {
        await failPayment(p as never, verified.rawPayload, verified.status as never)
      } else {
        // still pending — leave
        continue
      }
      count++
    } catch (e) {
      console.error(`reconcile payment ${p.id} failed`, e)
      // transient — will retry next cron
    }
  }
  if (count > 0) console.log(`reconcileStalePayments processed ${count}`)
  return count
}
