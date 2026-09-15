/**
 * cancelIfPending — one ACID user-cancellation path for every payable kind
 * except trip bookings (tiered refunds are trip-specific and stay in
 * bookings/cancellation.ts).
 * Ceremony owned here: ownership/admin gate, pre-condition policy hook,
 * SELECT ... FOR UPDATE + fresh re-check inside $transaction, inventory
 * release hook, status flip, AuditLog, typed status.changed publish.
 */
import { prisma } from "@camermove/db"
import { ConflictError, ForbiddenError, NotFoundError } from "@camermove/config"
import { EVENT_TOPICS, makeEvent, publishEvent } from "@camermove/events"

export interface CancelEntity {
  id: string
  userId: string
  status: string
  totalAmount: number
}

export interface CancelNotification {
  topic?: typeof EVENT_TOPICS.bookingStatusChanged
  type?: string
  userId: string
  payload: Record<string, unknown>
}

export interface CancelPendingAdapter<E extends CancelEntity> {
  notFoundMessage: string
  /** Load the entity with any label relations needed for the notification. */
  find: (id: string) => Promise<E | null>
  /** Physical table name for the SELECT ... FOR UPDATE lock. */
  table: string
  /** Policy gate — throws ConflictError when not cancellable (checked twice: before + inside tx). */
  assertCancellable: (entity: Partial<E> & CancelEntity) => void | Promise<void>
  /** Refreshed entity read inside the tx (use the tx client); may omit label-only fields. */
  findFresh: (tx: unknown, id: string) => Promise<(Partial<E> & CancelEntity) | null>
  /** Release held inventory inside the tx (event: sold decrement; others: none). */
  releaseInventory?: (tx: unknown, entity: Partial<E> & CancelEntity) => Promise<void>
  /** Flip the entity status (and write any domain rows, e.g. parcel status log). */
  cancel: (tx: unknown, entity: Partial<E> & CancelEntity) => Promise<unknown>
  auditAction: string
  auditEntityType: string
  auditExtra?: (entity: Partial<E> & CancelEntity) => Record<string, unknown>
  notification: (entity: Partial<E> & CancelEntity) => CancelNotification
}

export function assertOwnedOrAdmin(entity: { userId: string }, actorId: string, actorRole: string): void {
  const isAdmin = actorRole === "admin" || actorRole === "super_admin"
  if (!isAdmin && entity.userId !== actorId) throw new ForbiddenError("Accès refusé")
}

export async function cancelIfPending<E extends CancelEntity>(
  adapter: CancelPendingAdapter<E>,
  id: string,
  actorId: string,
  actorRole = "traveler",
): Promise<unknown> {
  const entity = await adapter.find(id)
  if (!entity) throw new NotFoundError(adapter.notFoundMessage)
  assertOwnedOrAdmin(entity, actorId, actorRole)
  adapter.assertCancellable(entity)

  const updated = await prisma.$transaction(async (tx: unknown) => {
    const t = tx as { $queryRawUnsafe: (q: string, ...v: unknown[]) => Promise<unknown> }
    // adapter.table comes from a closed adapter map (never user input); id is parameterized.
    await t.$queryRawUnsafe(`SELECT "id" FROM "${adapter.table}" WHERE "id" = $1 FOR UPDATE`, id)
    const fresh = await adapter.findFresh(tx, id)
    if (!fresh) throw new NotFoundError(adapter.notFoundMessage)
    adapter.assertCancellable(fresh)
    if (adapter.releaseInventory) await adapter.releaseInventory(tx, fresh)
    return adapter.cancel(tx, fresh)
  })

  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action: adapter.auditAction,
        entityType: adapter.auditEntityType,
        entityId: id,
        metadata: {
          userId: entity.userId,
          status: "cancelled",
          totalAmount: entity.totalAmount,
          ...(adapter.auditExtra ? adapter.auditExtra(entity) : {}),
        } as never,
      },
    })
  } catch {}

  const note = adapter.notification(entity)
  await publishEvent(
    note.topic ?? EVENT_TOPICS.bookingStatusChanged,
    makeEvent(note.type ?? "booking.status.changed", id, {
      type: note.type ?? "booking.status.changed",
      userId: note.userId,
      payload: note.payload,
    }),
  )
  return updated
}
