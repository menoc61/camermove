import { prisma } from "@camermove/db"
import { ConflictError } from "@camermove/config"
import { EVENT_TOPICS } from "@camermove/events"
import { referenceForKind } from "../references.js"
import type { ConfirmLink, ConfirmNotification, CancelEntity } from "../types.js"
import type { AdapterInstance } from "./types.js"

export const parcelAdapter: AdapterInstance = {
  kind: "parcel",
  table: "Parcel",
  expiryTable: null,
  idField: "senderCity",
  notFoundMessage: "Colis introuvable",
  requiresInventory: false,

  // No pre-existing inventory: every parcel field comes from meta.
  // The row id is pre-generated so referenceForKind(parcel, id) matches
  // the stored row for webhook prefix-scan resolution.
  newEntityId() {
    const rand = Array.from({ length: 19 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("")
    return `cmparcel${rand}`
  },

  async find(_id: string) {
    return null
  },

  async findLink(paymentId: string, tx?: unknown) {
    // Await is mandatory (Prisma 6 lazy proxy is truthy — see trip.ts).
    // Link describes the parcel entity (amount = shippingCost), not the payment row.
    const t = tx as { payment: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> } } | undefined
    const p = await (t
      ? t.payment.findUnique({ where: { id: paymentId }, include: { parcel: true } })
      : prisma.payment.findUnique({ where: { id: paymentId }, include: { parcel: true } }))
    if (!p) return null
    const parcel = (p as unknown as { parcel: { id: string; userId: string; status: string; shippingCost: number } | null }).parcel
    if (!parcel) return null
    return { id: parcel.id, userId: parcel.userId, status: parcel.status, totalAmount: parcel.shippingCost }
  },

  isConfirmable() { return true },

  async confirm(tx: unknown, link: ConfirmLink, _event: unknown) {
    await (tx as { parcel: { update: (a: unknown) => Promise<unknown> } }).parcel.update({
      where: { id: link.id }, data: { paymentId: link.id },
    })
  },

  notification(entity: Record<string, unknown>): ConfirmNotification {
    const link = entity as ConfirmLink
    return { topic: EVENT_TOPICS.paymentConfirmed, type: "payment.confirmed", userId: link.userId, payload: { bookingId: link.id, reference: link.reference, amount: link.totalAmount } }
  },

  async findEntityByPaymentId(paymentId: string) {
    return prisma.payment.findUnique({ where: { id: paymentId }, include: { parcel: true } })
  },

  makeReference(id: string) { return referenceForKind("parcel", id) },

  calcTotalAmount(_entity: Record<string, unknown>, input) {
    return Number(input.meta?.shippingCost ?? 0)
  },

  mapCreateData(data) {
    // Parcel has no reference/totalAmount/holdExpiresAt columns; the
    // tracking number IS the payment reference.
    const { reference, totalAmount: _totalAmount, holdExpiresAt: _holdExpiresAt, status: _status, ...rest } = data
    return { ...rest, trackingNumber: reference as string, status: "registered" }
  },

  async create(data: Record<string, unknown>, tx: unknown) {
    const t = tx as { parcel: { create: (a: unknown) => Promise<Record<string, unknown>> } }
    return t.parcel.create({ data })
  },

  assertCancellable(entity) {
    if (entity.status !== "registered") throw new ConflictError(`Colis non annulable — statut: ${entity.status}`)
    if ((entity as { paymentId?: string }).paymentId) throw new ConflictError("Colis déjà payé — contactez le support")
  },
  async findFresh(tx, id) { return (tx as { parcel: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> } }).parcel.findUnique({ where: { id } }) as unknown as Promise<Partial<CancelEntity> & CancelEntity | null> },
  async releaseInventory() {},
  async cancel(tx, entity) {
    return (tx as { parcel: { update: (a: unknown) => Promise<Record<string, unknown>> } }).parcel.update({
      where: { id: (entity as { id: string }).id }, data: { status: "cancelled" },
    }) as Promise<Record<string, unknown>>
  },
  auditAction: "parcel.booking.cancel",
  auditEntityType: "Parcel",
}
