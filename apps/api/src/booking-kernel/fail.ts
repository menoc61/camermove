/**
 * failPayment — generic ACID fail ceremony for any payable kind.
 * Mirrors confirm.ts: locks payment + entity rows inside a single $transaction,
 * flips payment.status to "failed" / "expired", flips the entity status (cancelled),
 * releases inventory through the adapter, audits, and publishes a typed notification.
 *
 * Called from the webhook + reconciliation cron when a provider returns
 * failed/expired. Replaces the legacy trip-specific reconciliation.ts:failPayment.
 */
import { prisma } from "@camermove/db"
import { EVENT_TOPICS, makeEvent, publishEvent } from "@camermove/events"
import { getAdapter } from "./adapters.js"
import type { ConfirmLink } from "./types.js"

export type FailStatus = "failed" | "expired"

export async function failPayment(
  kind: string,
  paymentId: string,
  event: unknown,
  targetStatus: FailStatus = "failed",
): Promise<{ handled: boolean; entityId?: string }> {
  const adapter = getAdapter(kind as any)
  let handled = false
  let entityId: string | undefined

  await prisma.$transaction(async (tx: unknown) => {
    const t = tx as {
      $queryRawUnsafe: (q: string, ...v: unknown[]) => Promise<unknown>
      payment: { findUnique: (a: unknown) => Promise<{ status: string; provider: string } | null>; update: (a: unknown) => Promise<unknown> }
      booking: { update: (a: unknown) => Promise<unknown>; findUnique: (a: unknown) => Promise<{ id: string; tripId: string; seatCount: number; userId: string; totalAmount: number; reference: string } | null> }
      auditLog: { create: (a: unknown) => Promise<unknown> }
    }
    // Lock the entity row + payment row
    const link = await adapter.findLink(paymentId, tx)
    if (!link) return
    await t.$queryRawUnsafe(`SELECT "id" FROM "${adapter.table}" WHERE "id" = $1 FOR UPDATE`, link.id)
    await t.$queryRawUnsafe(`SELECT "id" FROM "Payment" WHERE "id" = $1 FOR UPDATE`, paymentId)
    const freshPayment = await t.payment.findUnique({ where: { id: paymentId } })
    if (!freshPayment) return
    if (freshPayment.status === "success") return  // can't fail a success
    if (["failed", "expired", "refunded"].includes(freshPayment.status)) return  // idempotent

    await t.payment.update({ where: { id: paymentId }, data: { status: targetStatus, webhookPayload: event as never } })

    // Adapter handles entity.status flip + inventory release (e.g. trip releases held seats)
    await adapter.releaseInventory?.(tx, link as never)
    // Generic cancel signal on the entity row
    await adapter.cancel(tx, link as never)

    try {
      await t.auditLog.create({
        data: {
          actorId: "system",
          action: `payment.${targetStatus}`,
          entityType: "Payment",
          entityId: paymentId,
          metadata: { provider: freshPayment.provider, kind, [`${kind}Id`]: link.id, deliveryId: (event as Record<string, unknown>)?.id ?? null } as never,
        },
      })
    } catch {}
    handled = true
    entityId = link.id
  })

  if (handled && entityId) {
    // publish a typed failure notification — consumer subscription decides if it's a delivery failure alert
    try {
      await publishEvent(
        EVENT_TOPICS.paymentConfirmed,
        makeEvent(`${kind}.payment.${targetStatus}`, entityId, {
          type: `${kind}.payment.${targetStatus}`,
          entityId,
          status: targetStatus,
          ts: new Date().toISOString(),
        }),
      )
    } catch {}
  }

  return { handled, entityId }
}