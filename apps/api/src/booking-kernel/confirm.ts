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
    await t.$queryRawUnsafe(`SELECT "id" FROM "${adapter.table}" WHERE "id" = $1 FOR UPDATE`, link.id)
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
  })

  const note = adapter.notification(link)
  await publishEvent(
    note.topic as any,
    makeEvent(note.type, link.id, { type: note.type, userId: note.userId, payload: note.payload }),
  )
  return { confirmed: wasNew, entityId: link.id }
}

export function confirmedTopicFor(kind: "hotel" | "rental" | "event"): EventTopic {
  if (kind === "hotel") return EVENT_TOPICS.hotelBookingConfirmed
  if (kind === "rental") return EVENT_TOPICS.rentalBookingConfirmed
  return EVENT_TOPICS.eventBookingConfirmed
}
