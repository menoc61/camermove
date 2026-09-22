/**
 * cancel — one ACID user-cancellation path for every payable kind
 * except trip bookings (tiered refunds are trip-specific and stay in
 * bookings/cancellation.ts).
 * Ceremony owned here: ownership/admin gate, pre-condition policy hook,
 * SELECT ... FOR UPDATE + fresh re-check inside $transaction, inventory
 * release hook, status flip, AuditLog, typed status.changed publish.
 */
import { prisma } from "@camermove/db"
import { observeBooking } from "@camermove/observability"
import { ConflictError, ForbiddenError, NotFoundError } from "@camermove/config"
import { EVENT_TOPICS, makeEvent, publishEvent } from "@camermove/events"
import { getAdapter } from "./adapters.js"
import type { CancelEntity } from "./types.js"
export type { CancelEntity } from "./types.js"

export interface CancelNotification {
  topic: string
  type?: string
  userId: string
  payload: Record<string, unknown>
}

export interface CancelInput {
  entityId: string
  actorId: string
  actorRole?: string
}

export async function cancel(kind: string, input: CancelInput): Promise<unknown> {
  const adapter = getAdapter(kind as any)
  const entity = await adapter.find(input.entityId)
  if (!entity) throw new NotFoundError(adapter.notFoundMessage)
  const entityWithUser = entity as Record<string, unknown> & { userId: string }
  assertOwnedOrAdmin(entityWithUser, input.actorId, input.actorRole ?? "traveler")
  adapter.assertCancellable(entity as unknown as Partial<CancelEntity> & CancelEntity)

  const updated = await prisma.$transaction(async (tx: unknown) => {
    const t = tx as { $queryRawUnsafe: (q: string, ...v: unknown[]) => Promise<unknown> }
    await t.$queryRawUnsafe(`SELECT "id" FROM "${adapter.table}" WHERE "id" = $1 FOR UPDATE`, input.entityId)
    const fresh = await adapter.findFresh(tx, input.entityId)
    if (!fresh) throw new NotFoundError(adapter.notFoundMessage)
    adapter.assertCancellable(fresh as unknown as Partial<CancelEntity> & CancelEntity)
    if (adapter.releaseInventory) await adapter.releaseInventory(tx, fresh as unknown as Partial<CancelEntity> & CancelEntity)
    return adapter.cancel(tx, fresh as unknown as Partial<CancelEntity> & CancelEntity)
  })

  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: adapter.auditAction,
        entityType: adapter.auditEntityType,
        entityId: input.entityId,
        metadata: {
          userId: entityWithUser.userId,
          status: "cancelled",
          totalAmount: (entity as { totalAmount: number }).totalAmount,
          ...(adapter.auditExtra ? adapter.auditExtra(entity as unknown as Partial<CancelEntity> & CancelEntity) : {}),
        } as never,
      },
    })
  } catch {}

  try { observeBooking("cancelled") } catch {}

  const note = adapter.notification(entity as unknown as Record<string, unknown>)
  await publishEvent(
    note.topic as any,
    makeEvent(note.type ?? "booking.status.changed", input.entityId, {
      type: note.type ?? "booking.status.changed",
      userId: note.userId,
      payload: note.payload,
    }),
  )
  return updated
}

export function assertOwnedOrAdmin(entity: { userId: string }, actorId: string, actorRole: string): void {
  const isAdmin = actorRole === "admin" || actorRole === "super_admin"
  if (!isAdmin && entity.userId !== actorId) throw new ForbiddenError("Accès refusé")
}
