/**
 * confirmPaymentSuccess — one idempotent, ACID confirmation path for every
 * payable kind (webhook / reconciliation entry point).
 * Ceremony owned here: FOR UPDATE row locks on Payment + entity, status
 * idempotency re-checks, payment.success flip, entity confirm flip, AuditLog,
 * typed notification publish (re-published on replay for fan-out safety).
 */
import { prisma } from "@camermove/db"
import { NotFoundError } from "@camermove/config"
import { EVENT_TOPICS, makeEvent, publishEvent, type EventTopic } from "@camermove/events"
import type { PayableKind } from "./references"

export interface ConfirmLink {
  id: string
  userId: string
  status: string
  totalAmount: number
}

export interface ConfirmNotification {
  topic: EventTopic
  type: string
  userId: string
  payload: Record<string, unknown>
}

export interface ConfirmPaymentAdapter {
  kind: PayableKind
  notFoundMessage: string
  /** tx is provided when re-reading inside the confirm transaction — use it for freshness. */
  findLink: (paymentId: string, tx?: unknown) => Promise<ConfirmLink | null>
  /** Physical table name for the SELECT ... FOR UPDATE lock. */
  table: string
  /** Entity gate: return false to skip confirmation (e.g. not pending_payment). */
  isConfirmable: (entity: ConfirmLink) => boolean
  /** Flip the entity into its confirmed state. Parcel: no-op. */
  confirm: (tx: unknown, entityId: string) => Promise<void>
  notification: (link: ConfirmLink) => ConfirmNotification
}

export async function confirmPaymentSuccess(
  adapter: ConfirmPaymentAdapter,
  paymentId: string,
  event: unknown,
): Promise<{ confirmed: boolean; entityId: string }> {
  const link = await adapter.findLink(paymentId)
  if (!link) throw new NotFoundError(adapter.notFoundMessage)

  let wasNew = false
  await prisma.$transaction(async (tx: unknown) => {
    const t = tx as {
      $queryRawUnsafe: (q: string, ...v: unknown[]) => Promise<unknown>
      payment: { findUnique: (a: unknown) => Promise<{ status: string; provider: string } | null>; update: (a: unknown) => Promise<unknown> }
      auditLog: { create: (a: unknown) => Promise<unknown> }
    }
    // adapter.table comes from a closed adapter map (never user input); id is parameterized.
    await t.$queryRawUnsafe(`SELECT "id" FROM "${adapter.table}" WHERE "id" = $1 FOR UPDATE`, link.id)
    await t.$queryRawUnsafe(`SELECT "id" FROM "Payment" WHERE "id" = $1 FOR UPDATE`, paymentId)
    const freshPayment = await t.payment.findUnique({ where: { id: paymentId } })
    if (!freshPayment) return
    if (freshPayment.status === "success") return
    if (["failed", "expired", "refunded"].includes(freshPayment.status)) return
    const freshEntity = await adapter.findLink(paymentId, tx) // re-read inside tx
    if (!freshEntity || !adapter.isConfirmable(freshEntity)) return
    await t.payment.update({ where: { id: paymentId }, data: { status: "success", webhookPayload: event as never } })
    await adapter.confirm(tx, link.id)
    try {
      await t.auditLog.create({
        data: {
          actorId: "system",
          action: "payment.success",
          entityType: "Payment",
          entityId: paymentId,
          metadata: { provider: freshPayment.provider, kind: adapter.kind, [`${adapter.kind}Id`]: link.id, deliveryId: (event as Record<string, unknown>)?.id ?? null } as never,
        },
      })
    } catch {}
    wasNew = true
  })

  const note = adapter.notification(link)
  await publishEvent(
    note.topic,
    makeEvent(note.type, link.id, { type: note.type, userId: note.userId, payload: note.payload }),
  )
  return { confirmed: wasNew, entityId: link.id }
}

/** Convenience: topic/type for the common "confirmed" notification of a kind. */
export function confirmedTopicFor(kind: "hotel" | "rental" | "event"): EventTopic {
  if (kind === "hotel") return EVENT_TOPICS.hotelBookingConfirmed
  if (kind === "rental") return EVENT_TOPICS.rentalBookingConfirmed
  return EVENT_TOPICS.eventBookingConfirmed
}
