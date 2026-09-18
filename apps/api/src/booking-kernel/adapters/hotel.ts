import { prisma } from "@camermove/db"
import { ConflictError } from "@camermove/config"
import { EVENT_TOPICS } from "@camermove/events"
import { referenceForKind } from "../references.js"
import type { ConfirmLink, ConfirmNotification, CancelEntity } from "../types.js"
import type { AdapterInstance } from "./types.js"

export const hotelAdapter: AdapterInstance = {
  kind: "hotel",
  table: "HotelRoom",
  expiryTable: "HotelBooking",
  idField: "roomTypeId",
  notFoundMessage: "Chambre introuvable",

  // Inventory-first: the room must exist before booking. The lock in
  // reserve() targets this row; the booking row is created by create().
  async find(id: string) {
    return prisma.hotelRoom.findUnique({ where: { id } })
  },

  async findLink(paymentId: string, tx?: unknown) {
    // Await is mandatory (Prisma 6 lazy proxy is truthy — see trip.ts).
    // Link describes the hotel booking entity, not the payment row.
    const t = tx as { payment: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> } } | undefined
    const p = await (t
      ? t.payment.findUnique({ where: { id: paymentId }, include: { hotelBooking: true } })
      : prisma.payment.findUnique({ where: { id: paymentId }, include: { hotelBooking: true } }))
    if (!p) return null
    const hb = (p as unknown as { hotelBooking: { id: string; userId: string; status: string; totalAmount: number } | null }).hotelBooking
    if (!hb) return null
    return { id: hb.id, userId: hb.userId, status: hb.status, totalAmount: hb.totalAmount }
  },

  isConfirmable(entity: ConfirmLink) { return entity.status === "pending_payment" },

  async confirm(tx: unknown, link: ConfirmLink, _event: unknown) {
    await (tx as { hotelBooking: { update: (a: unknown) => Promise<unknown> } }).hotelBooking.update({
      where: { id: link.id }, data: { status: "confirmed" },
    })
  },

  notification(entity: Record<string, unknown>): ConfirmNotification {
    const link = entity as ConfirmLink
    return { topic: EVENT_TOPICS.hotelBookingConfirmed, type: "hotel.booking.confirmed", userId: link.userId, payload: { bookingId: link.id, reference: link.reference, amount: link.totalAmount } }
  },

  async findEntityByPaymentId(paymentId: string) {
    return prisma.payment.findUnique({ where: { id: paymentId }, include: { hotelBooking: true } })
  },

  makeReference(id: string) { return referenceForKind("hotel", id) },

  calcTotalAmount(entity: Record<string, unknown>, input) {
    const pricePerNight = Number(entity.pricePerNight ?? 0)
    const ms = (input.checkOutDate?.getTime() ?? 0) - (input.checkInDate?.getTime() ?? 0)
    const nights = Number.isFinite(ms) ? Math.max(1, Math.ceil(ms / 86400000)) : 1
    return pricePerNight * nights
  },

  async checkAvailability(entity, input, tx) {
    const checkInDate = input.checkInDate
    const checkOutDate = input.checkOutDate
    if (!checkInDate || !checkOutDate) throw new ConflictError("Dates de séjour requises")
    const overlapping = await (tx as { hotelBooking: { count: (a: unknown) => Promise<number> } }).hotelBooking.count({
      where: { roomTypeId: entity.id, status: { in: ["pending_payment", "confirmed"] }, checkInDate: { lt: checkOutDate }, checkOutDate: { gt: checkInDate } },
    })
    if (overlapping >= Number(entity.quantity ?? 1)) throw new ConflictError("Plus de disponibilité pour ces dates")
  },

  mapCreateData(data) {
    // HotelBooking has no reference column (derived via referenceForKind).
    const { reference: _reference, ...rest } = data
    return rest
  },

  async create(data: Record<string, unknown>, tx: unknown) {
    const t = tx as { hotelBooking: { create: (a: unknown) => Promise<Record<string, unknown>> } }
    return t.hotelBooking.create({ data })
  },

  assertCancellable() {},
  async findFresh(tx, id) { return (tx as { hotelBooking: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> } }).hotelBooking.findUnique({ where: { id } }) as unknown as Promise<Partial<CancelEntity> & CancelEntity | null> },
  async releaseInventory() {},
  async cancel(tx, entity) { return entity as unknown as Record<string, unknown> },
  auditAction: "hotel.booking.cancel",
  auditEntityType: "HotelBooking",
}
