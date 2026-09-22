import { prisma } from "@camermove/db"
import { ConflictError, NotFoundError } from "@camermove/config"
import { EVENT_TOPICS } from "@camermove/events"
import { referenceForKind } from "../references.js"
import type { ConfirmLink, ConfirmNotification, CancelEntity } from "../types.js"
import type { AdapterInstance } from "./types.js"

export const eventAdapter: AdapterInstance = {
  kind: "event",
  table: "Event",
  expiryTable: "EventBooking",
  idField: "eventId",
  notFoundMessage: "Événement introuvable",

  // Inventory-first: the event must exist before ticketing.
  async find(id: string) {
    return prisma.event.findUnique({ where: { id } })
  },

  async findLink(paymentId: string, tx?: unknown) {
    // Await is mandatory (Prisma 6 lazy proxy is truthy — see trip.ts).
    // Link describes the event booking entity, not the payment row.
    const t = tx as { payment: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> } } | undefined
    const p = await (t
      ? t.payment.findUnique({ where: { id: paymentId }, include: { eventBooking: true } })
      : prisma.payment.findUnique({ where: { id: paymentId }, include: { eventBooking: true } }))
    if (!p) return null
    const eb = (p as unknown as { eventBooking: { id: string; userId: string; status: string; totalAmount: number } | null }).eventBooking
    if (!eb) return null
    return { id: eb.id, userId: eb.userId, status: eb.status, totalAmount: eb.totalAmount }
  },

  isConfirmable(entity: ConfirmLink) { return entity.status === "pending_payment" },

  async confirm(tx: unknown, link: ConfirmLink, _event: unknown) {
    await (tx as { eventBooking: { update: (a: unknown) => Promise<unknown> } }).eventBooking.update({
      where: { id: link.id }, data: { status: "confirmed" },
    })
  },

  notification(entity: Record<string, unknown>): ConfirmNotification {
    const link = entity as ConfirmLink
    return { topic: EVENT_TOPICS.eventBookingConfirmed, type: "event.booking.confirmed", userId: link.userId, payload: { bookingId: link.id, reference: link.reference, amount: link.totalAmount } }
  },

  async findEntityByPaymentId(paymentId: string) {
    return prisma.payment.findUnique({ where: { id: paymentId }, include: { eventBooking: true } })
  },

  makeReference(id: string) { return referenceForKind("event", id) },

  calcTotalAmount(entity: Record<string, unknown>, input?) {
    const meta = input?.meta as Record<string, unknown> | undefined
    const base = Number((meta?.price as number) ?? 0)
    const qty = Number(meta?.quantity ?? 1)
    return base * qty
  },

  async checkAvailability(_entity, input, tx) {
    const categoryId = input.meta?.ticketCategoryId as string | undefined
    if (!categoryId) return
    const quantity = Number(input.meta?.quantity ?? 1)
    const category = await (tx as { ticketCategory: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> } }).ticketCategory.findUnique({ where: { id: categoryId } })
    if (!category) throw new NotFoundError("Catégorie de billet introuvable")
    const sold = Number(category.sold ?? 0)
    const held = Number(category.held ?? 0)
    if ((category.quantity as number) - sold - held < quantity) throw new ConflictError("Quantité insuffisante")
  },

  mapCreateData(data) {
    // EventBooking has no reference column (derived via referenceForKind).
    const { reference: _reference, ...rest } = data
    return rest
  },

  async create(data: Record<string, unknown>, tx: unknown) {
    const t = tx as { eventBooking: { create: (a: unknown) => Promise<Record<string, unknown>> } }
    return t.eventBooking.create({ data })
  },

  assertCancellable() {},
  async findFresh(tx, id) { return (tx as { eventBooking: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> } }).eventBooking.findUnique({ where: { id } }) as unknown as Promise<Partial<CancelEntity> & CancelEntity | null> },
  async releaseInventory(tx, entity) { await (tx as { ticketCategory: { update: (a: unknown) => Promise<unknown> } }).ticketCategory.update({ where: { id: (entity as unknown as { ticketCategoryId: string }).ticketCategoryId }, data: { held: { decrement: (entity as unknown as { quantity: number }).quantity } } }) },
  async cancel(tx, entity) { return entity as unknown as Record<string, unknown> },
  auditAction: "event.booking.cancel",
  auditEntityType: "EventBooking",
}
