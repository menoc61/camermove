/**
 * Transactional payment state machine + reconciliation.
 * All mutations are inside Prisma $transaction with SELECT ... FOR UPDATE
 * to serialize against expireHolds (T-03-16, T-03-20).
 */
import { prisma } from "@camermove/db"
import { createLogger } from "@camermove/config"
import { getProvider } from "../providers/index.js"
import type { SupportedProvider } from "../providers/types.js"
import { computeCommission } from "../commission.js"
import { EVENT_TOPICS, publishPaymentConfirmed, publishTicketIssued } from "@camermove/events"
import { generateAndIssueTicket } from "../../tickets/ticket.service.js"
import type { IssuedTicket } from "../../tickets/ticket.service.js"
import { PAYABLE_KINDS_BY_PREFIX, referenceForKind, confirmPaymentSuccess as kernelConfirm, failPayment as kernelFail } from "../../booking-kernel/index.js"

class UnrecoverableError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = "UnrecoverableError"
  }
}

const log = createLogger()

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

/** Non-transport payment routing (hotels, rentals, parcels, insurance, events).
 * These services create Payment rows with bookingId=null linked via the
 * entity's paymentId, and use derived references (HOTEL-XXXXXXXX, ...).
 * There is no reference column on those tables, so we reverse the reference
 * by prefix-scan on the id prefix and verify the recomputed reference matches.
 */
type NonTripKind = "hotel" | "rental" | "parcel" | "insurance" | "event"
interface NonTripTarget {
  kind: NonTripKind
  payment: { id: string; bookingId: string | null; provider: string; providerRef: string | null; status: string; amount: number }
  expectedAmount: number
}

// Prefix registry lives in the booking-kernel — single source of truth, no drift.
const NON_TRIP_PREFIXES = PAYABLE_KINDS_BY_PREFIX

async function findEntityByDerivedReference(kind: NonTripKind, reference: string): Promise<{ id: string; paymentId: string | null; total: number } | null> {
  const entry = NON_TRIP_PREFIXES.find((p) => p.kind === kind)
  if (!entry || !reference.startsWith(entry.prefix)) return null
  const suffix = reference.slice(entry.prefix.length)
  if (!/^[A-Za-z0-9]{8}$/.test(suffix)) return null
  const idPrefix = suffix.toLowerCase()
  const entityDelegates: Record<NonTripKind, { rows: (where: unknown) => Promise<Array<Record<string, unknown>>>; totalField: string }> = {
    hotel: { rows: async (w) => prisma.hotelBooking.findMany(w as never) as never, totalField: "totalAmount" },
    rental: { rows: async (w) => prisma.rentalBooking.findMany(w as never) as never, totalField: "totalAmount" },
    parcel: { rows: async (w) => prisma.parcel.findMany(w as never) as never, totalField: "shippingCost" },
    insurance: { rows: async (w) => prisma.insurancePolicy.findMany(w as never) as never, totalField: "premium" },
    event: { rows: async (w) => prisma.eventBooking.findMany(w as never) as never, totalField: "totalAmount" },
  }
  const { rows, totalField } = entityDelegates[kind]
  const found = (await rows({ where: { id: { startsWith: idPrefix } }, take: 5 })) as Array<{ id: string; paymentId: string | null }>
  const hit = found.find((r) => referenceForKind(kind, r.id) === reference)
  return hit ? { id: hit.id, paymentId: hit.paymentId, total: Number((hit as Record<string, unknown>)[totalField]) } : null
}

async function resolveNonTripPayment(reference: string): Promise<NonTripTarget | null> {
  for (const { kind } of NON_TRIP_PREFIXES) {
    const entity = await findEntityByDerivedReference(kind, reference)
    if (!entity?.paymentId) continue
    const pay = await prisma.payment.findUnique({ where: { id: entity.paymentId } })
    if (!pay) continue
    return {
      kind,
      payment: pay as unknown as NonTripTarget["payment"],
      expectedAmount: entity.total,
    }
  }
  return null
}

async function resolveNonTripPaymentByPaymentId(paymentId: string): Promise<NonTripTarget | null> {
  const pay = await prisma.payment.findUnique({ where: { id: paymentId } })
  if (!pay) return null
  const p = pay as unknown as NonTripTarget["payment"]
  const hb = (await prisma.hotelBooking.findFirst({ where: { paymentId } })) as unknown as { totalAmount: number } | null
  if (hb) return { kind: "hotel", payment: p, expectedAmount: hb.totalAmount }
  const rb = (await prisma.rentalBooking.findFirst({ where: { paymentId } })) as unknown as { totalAmount: number } | null
  if (rb) return { kind: "rental", payment: p, expectedAmount: rb.totalAmount }
  const parcel = (await prisma.parcel.findFirst({ where: { paymentId } })) as unknown as { shippingCost: number } | null
  if (parcel) return { kind: "parcel", payment: p, expectedAmount: parcel.shippingCost }
  const policy = (await prisma.insurancePolicy.findFirst({ where: { paymentId } })) as unknown as { premium: number } | null
  if (policy) return { kind: "insurance", payment: p, expectedAmount: policy.premium }
  const eb = (await prisma.eventBooking.findFirst({ where: { paymentId } })) as unknown as { totalAmount: number } | null
  if (eb) return { kind: "event", payment: p, expectedAmount: eb.totalAmount }
  return null
}

async function confirmNonTripPayment(target: NonTripTarget, event: unknown): Promise<void> {
  if (target.kind === "hotel") {
    const { confirmHotelPaymentSuccess } = await import("../../hotels/service.js")
    await confirmHotelPaymentSuccess(target.payment.id, event)
  } else if (target.kind === "rental") {
    const { confirmRentalPaymentSuccess } = await import("../../rentals/service.js")
    await confirmRentalPaymentSuccess(target.payment.id, event)
  } else if (target.kind === "parcel") {
    const { confirmParcelPaymentSuccess } = await import("../../parcels/service.js")
    await confirmParcelPaymentSuccess(target.payment.id, event)
  } else if (target.kind === "insurance") {
    const { confirmInsurancePaymentSuccess } = await import("../../insurance/service.js")
    await confirmInsurancePaymentSuccess(target.payment.id, event)
  } else {
    const { confirmEventPaymentSuccess } = await import("../../events/service.js")
    await confirmEventPaymentSuccess(target.payment.id, event)
  }
}

async function failNonTripPayment(target: NonTripTarget, event: unknown, targetStatus: "failed" | "expired" = "failed"): Promise<void> {
  const pay = target.payment
  await prisma.$transaction(async (tx: unknown) => {
    const t = tx as typeof prisma
    await (t as unknown as { $queryRaw: (q: TemplateStringsArray, ...v: unknown[]) => Promise<unknown> }).$queryRaw`SELECT "id" FROM "Payment" WHERE "id"=${pay.id} FOR UPDATE`
    const fresh = await t.payment.findUnique({ where: { id: pay.id } })
    if (!fresh) return
    if (["success", "refunded"].includes(fresh.status as string)) return
    if (fresh.status === targetStatus) return
    await t.payment.update({ where: { id: pay.id }, data: { status: targetStatus, webhookPayload: event as never } })
    try {
      await t.auditLog.create({
        data: {
          actorId: "system",
          action: `payment.${targetStatus}`,
          entityType: "Payment",
          entityId: pay.id,
          metadata: { provider: pay.provider, entityKind: target.kind, deliveryId: (event as Record<string, unknown>)?.id ?? null } as never,
        },
      })
    } catch {}
  })
}

export async function confirmPaymentSuccess(payment: { id: string; bookingId: string }, event: unknown): Promise<void> {
  // Fetch booking to get tripId for row locks
  const p = await prisma.payment.findUnique({ where: { id: payment.id }, include: { booking: { include: { trip: true } } } })
  if (!p) throw new UnrecoverableError(`payment not found ${payment.id}`)
  if (!p.bookingId) throw new UnrecoverableError(`payment ${payment.id} has no bookingId (non-transport payment)`)
  // Capture under a local const so the string narrowing survives into the tx closure.
  const bookingId: string = p.bookingId
  const booking = p.booking as unknown as { id: string; tripId: string; seatCount: number; totalAmount: number; status: string; trip: { transportId: string }; userId: string; reference: string }

  // Issued ticket is captured during the transaction so we can publish the
  // typed NotificationEvent after commit. Only set when a NEW ticket is
  // generated (not on idempotent replay).
  let issuedTicket: IssuedTicket | null = null
  let ticketCreateSucceeded = false

  await prisma.$transaction(async (tx: unknown) => {
    const t = tx as typeof prisma
    // Serialize against expireHolds — lock Booking and SeatAvailability
    await (t as unknown as { $queryRaw: (q: TemplateStringsArray, ...v: unknown[]) => Promise<unknown> }).$queryRaw`SELECT "id" FROM "Booking" WHERE "id"=${bookingId} FOR UPDATE`
    await (t as unknown as { $queryRaw: (q: TemplateStringsArray, ...v: unknown[]) => Promise<unknown> }).$queryRaw`SELECT "tripId" FROM "SeatAvailability" WHERE "tripId"=${booking.tripId} FOR UPDATE`

    // Re-fetch inside tx under lock
    const freshPayment = await t.payment.findUnique({ where: { id: p.id } })
    const freshBooking = await t.booking.findUnique({ where: { id: bookingId } })
    if (!freshPayment || !freshBooking) return
    // Idempotency guard — already success
    if (freshPayment.status === "success") return
    if (["failed", "expired", "refunded"].includes(freshPayment.status as string)) return
    // Expiry race: only confirm if still pending_payment
    if (freshBooking.status !== "pending_payment") return

    await t.payment.update({ where: { id: p.id }, data: { status: "success", webhookPayload: event as never } })
    await t.booking.update({ where: { id: bookingId }, data: { status: "confirmed" } })

    // Seat transition: seatsHeld -> seatsBooked, guard not negative
    const sa = await t.seatAvailability.findUnique({ where: { tripId: booking.tripId } })
    if (sa) {
      const held = sa.seatsHeld ?? 0
      const dec = Math.min(booking.seatCount, held)
      // If held < seatCount, log warn but clamp to avoid negative
      if (held < booking.seatCount) {
        log.warn({ held, seatCount: booking.seatCount, tripId: booking.tripId }, "seatsHeld below seatCount, clamping")
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
      issuedTicket = await generateAndIssueTicket(t as never, bookingId)
      ticketCreateSucceeded = true
    } catch (e) {
      log.error({ err: (e as Error).message, bookingId }, "ticket generation failed")
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
              bookingId,
              ticketId: issuedTicket.id,
              userId: (booking as unknown as { userId: string }).userId,
            } as never,
          },
        })
      } catch {}
    }
  })

  // Publish Kafka events after tx commit (best-effort).
  // Replaces the inline producer ceremony (C4) — single envelope, single seam.
  const candidate: IssuedTicket | null = ticketCreateSucceeded ? (issuedTicket as IssuedTicket | null) : null
  const justIssuedTicket: IssuedTicket | null = candidate && candidate.createdNew ? candidate : null
  if (justIssuedTicket) {
    await publishTicketIssued(booking.id, booking.userId, {
      bookingId: booking.id,
      reference: booking.reference,
      ticketId: justIssuedTicket.id,
      verificationCode: justIssuedTicket.verificationCode,
      amount: booking.totalAmount,
      tripId: booking.tripId,
    })
  }
  // Always fire payment.confirmed — channels need the "amount received" notification
  // on both first issue and replay so retrying consumer-side catches any lost publish.
  await publishPaymentConfirmed(booking.id, booking.userId, {
    bookingId: booking.id,
    reference: booking.reference,
    amount: booking.totalAmount,
    tripId: booking.tripId,
  })
}

export async function failPayment(payment: { id: string; bookingId: string }, event: unknown, targetStatus: "failed" | "expired" = "failed"): Promise<void> {
  const p = await prisma.payment.findUnique({ where: { id: payment.id }, include: { booking: true } })
  if (!p) return
  if (!p.bookingId) return // non-transport payment — handled by failNonTripPayment
  // Capture under a local const so the string narrowing survives into the tx closure.
  const bookingId: string = p.bookingId
  const booking = p.booking as unknown as { id: string; tripId: string; seatCount: number; status: string }

  await prisma.$transaction(async (tx: unknown) => {
    const t = tx as typeof prisma
    await (t as unknown as { $queryRaw: (q: TemplateStringsArray, ...v: unknown[]) => Promise<unknown> }).$queryRaw`SELECT "id" FROM "Booking" WHERE "id"=${bookingId} FOR UPDATE`
    await (t as unknown as { $queryRaw: (q: TemplateStringsArray, ...v: unknown[]) => Promise<unknown> }).$queryRaw`SELECT "tripId" FROM "SeatAvailability" WHERE "tripId"=${booking.tripId} FOR UPDATE`

    const freshPayment = await t.payment.findUnique({ where: { id: p.id } })
    const freshBooking = await t.booking.findUnique({ where: { id: bookingId } })
    if (!freshPayment || !freshBooking) return
    if (["success", "refunded"].includes(freshPayment.status as string)) return // terminal
    if (freshPayment.status === targetStatus) return

    await t.payment.update({ where: { id: p.id }, data: { status: targetStatus, webhookPayload: event as never } })

    // Only release held seats if booking still pending_payment (expiry race)
    if (freshBooking.status === "pending_payment") {
      await t.booking.update({ where: { id: bookingId }, data: { status: "expired" } })
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

    // publishPaymentConfirmed already used by the kernel fail path — no inline producer here.
  })
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
    if (byRef?.bookingId) {
      // Only a booking-linked payment is a transport payment; non-transport
      // (hotel/rental/parcel/insurance/event) fall through to resolveNonTripPayment.
      payment = byRef as unknown as PaymentRow
      const bb = await prisma.booking.findUnique({ where: { id: byRef.bookingId }, include: { trip: true } })
      if (bb) booking = { id: bb.id, tripId: bb.tripId, totalAmount: bb.totalAmount, transportId: (bb.trip as unknown as { transportId: string }).transportId }
    }
  }
  // Also try providerRef composite for cinetpay: booking.reference is aggregateId but cinetpay uses cpm_trans_id which equals booking.reference
  if (!payment) {
    // Non-transport services (hotel/rental/parcel/insurance/event) use derived
    // references — resolve via prefix-scan and drive their own state machine.
    const nonTrip = await resolveNonTripPayment(reference)
    if (nonTrip) {
      const pay = nonTrip.payment
      if (pay.status === "success") return
      if (["failed", "expired", "refunded"].includes(pay.status)) return
      const verifyResult = await mustVerifyProvider(pay as never, { totalAmount: nonTrip.expectedAmount } as never)
      if (verifyResult.status === "success") {
        await confirmNonTripPayment(nonTrip, event)
      } else if (verifyResult.status === "failed" || verifyResult.status === "expired") {
        await failNonTripPayment(nonTrip, event, verifyResult.status as "failed" | "expired")
      }
      return
    }
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
    await kernelConfirm("trip", (pay as unknown as { id: string }).id, event)
  } else if (verifyResult.status === "failed" || verifyResult.status === "expired") {
    await kernelFail("trip", (pay as unknown as { id: string }).id, event, verifyResult.status as "failed" | "expired")
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
        if (!p.bookingId) {
          // Non-transport payment (hotel/rental/parcel/insurance/event)
          const target = await resolveNonTripPaymentByPaymentId(p.id)
          if (!target) continue
          if (p.provider === "cinetpay" && verified.amount !== target.expectedAmount) {
            await failNonTripPayment(target, verified.rawPayload, "failed")
            count++
            continue
          }
          await confirmNonTripPayment(target, verified.rawPayload)
        } else if (p.provider === "cinetpay") {
          const booking = await prisma.booking.findUnique({ where: { id: p.bookingId } })
          if (booking && verified.amount !== booking.totalAmount) {
            await kernelFail("trip", (p as unknown as { id: string }).id, verified.rawPayload, "failed")
            count++
            continue
          }
          await kernelConfirm("trip", (p as unknown as { id: string }).id, verified.rawPayload)
        } else {
          await kernelConfirm("trip", (p as unknown as { id: string }).id, verified.rawPayload)
        }
      } else if (verified.status === "failed" || verified.status === "expired") {
        if (!p.bookingId) {
          const target = await resolveNonTripPaymentByPaymentId(p.id)
          if (!target) continue
          await failNonTripPayment(target, verified.rawPayload, verified.status as never)
        } else {
          await kernelFail("trip", (p as unknown as { id: string }).id, verified.rawPayload, verified.status as "failed" | "expired")
        }
      } else {
        // still pending — leave
        continue
      }
      count++
    } catch (e) {
      log.error({ err: (e as Error).message, paymentId: p.id }, "reconcile payment failed")
      // transient — will retry next cron
    }
  }
  if (count > 0) log.info({ count }, "reconcileStalePayments processed")
  return count
}
