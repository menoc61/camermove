/**
 * confirmPaymentSuccess — one idempotent, ACID confirmation path for every
 * payable kind (webhook / reconciliation entry point).
 * Ceremony owned here: FOR UPDATE row locks on Payment + entity, status
 * idempotency re-checks, payment.success flip, entity confirm flip, AuditLog,
 * typed notification publish (re-published on replay for fan-out safety).
 */
import { prisma } from "@camermove/db"
import { observeBooking, observePayment } from "@camermove/observability"
import { NotFoundError } from "@camermove/config"
import { EVENT_TOPICS, makeEvent, publishEvent, publishPaymentConfirmed, publishTicketIssued, type EventTopic } from "@camermove/events"
import { getAdapter } from "./adapters.js"
import type { ConfirmLink, ConfirmNotification } from "./types.js"

export interface ConfirmPaymentAdapter {
  kind: string
  notFoundMessage: string
  findLink: (paymentId: string, tx?: unknown) => Promise<ConfirmLink | null>
  table: string
  isConfirmable: (entity: ConfirmLink) => boolean
  confirm: (tx: unknown, link: ConfirmLink, event: unknown) => Promise<void>
  notification: (link: ConfirmLink) => ConfirmNotification
}

export async function confirmPaymentSuccess(
  kind: string,
  paymentId: string,
  event: unknown,
): Promise<{ confirmed: boolean; entityId: string }> {
  const adapter = getAdapter(kind as any)
  const link = await adapter.findLink(paymentId)
  if (!link) throw new NotFoundError(adapter.notFoundMessage)

  let wasNew = false
  await prisma.$transaction(async (tx: unknown) => {
    const t = tx as {
      $queryRawUnsafe: (q: string, ...v: unknown[]) => Promise<unknown>
      payment: { findUnique: (a: unknown) => Promise<{ status: string; provider: string } | null>; update: (a: unknown) => Promise<unknown> }
      auditLog: { create: (a: unknown) => Promise<unknown> }
    }
    // Lock the entity row (holds table: Booking for trip) + the payment row.
    // adapter.table is the lock-side table (Trip for reserve); expiryTable is
    // the booking-side row this confirm mutates.
    await t.$queryRawUnsafe(`SELECT "id" FROM "${adapter.expiryTable ?? adapter.table}" WHERE "id" = $1 FOR UPDATE`, link.id)
    await t.$queryRawUnsafe(`SELECT "id" FROM "Payment" WHERE "id" = $1 FOR UPDATE`, paymentId)
    const freshPayment = await t.payment.findUnique({ where: { id: paymentId } })
    if (!freshPayment) return
    if (freshPayment.status === "success") return
    if (["failed", "expired", "refunded"].includes(freshPayment.status)) return
    const freshEntity = await adapter.findLink(paymentId, tx)
    if (!freshEntity || !adapter.isConfirmable(freshEntity)) return
    await t.payment.update({ where: { id: paymentId }, data: { status: "success", webhookPayload: event as never } })
    await adapter.confirm(tx, freshEntity, event)
    try {
      await t.auditLog.create({
        data: {
          actorId: "system",
          action: "payment.success",
          entityType: "Payment",
          entityId: paymentId,
          metadata: { provider: freshPayment.provider, kind, [`${kind}Id`]: link.id, deliveryId: (event as Record<string, unknown>)?.id ?? null } as never,
        },
      })
    } catch {}
    wasNew = true
    try {
      observePayment(freshPayment.provider, "success")
      observeBooking("confirmed")
    } catch {}
  })

  const note = adapter.notification(link)
  await publishEvent(
    note.topic as any,
    makeEvent(note.type, link.id, { type: note.type, userId: note.userId, payload: note.payload }),
  )

  // Trip fan-out (C7): the worker consumes `ticket.issued` + `payment.confirmed`
  // with dedicated templates. The kernel ticket create happens in-tx, so the
  // events go out here, post-commit. Published on first confirm AND replay
  // (deterministic ids → consumer dedupes) so a lost publish is healed by retry.
  if (kind === "trip") {
    const tripLink = link as ConfirmLink & { tripId?: string; reference?: string }
    const ticket = await prisma.ticket.findFirst({
      where: { bookingId: link.id },
      select: { id: true, verificationCode: true },
    })
    if (ticket) {
      await publishTicketIssued(link.id, link.userId, {
        bookingId: link.id,
        reference: tripLink.reference ?? link.id,
        ticketId: ticket.id,
        verificationCode: ticket.verificationCode,
        amount: link.totalAmount,
        tripId: tripLink.tripId ?? "",
      })
    }
    await publishPaymentConfirmed(link.id, link.userId, {
      bookingId: link.id,
      reference: tripLink.reference ?? link.id,
      amount: link.totalAmount,
      tripId: tripLink.tripId ?? "",
    })
  }
  return { confirmed: wasNew, entityId: link.id }
}

export function confirmedTopicFor(kind: "hotel" | "rental" | "event"): EventTopic {
  if (kind === "hotel") return EVENT_TOPICS.hotelBookingConfirmed
  if (kind === "rental") return EVENT_TOPICS.rentalBookingConfirmed
  return EVENT_TOPICS.eventBookingConfirmed
}
