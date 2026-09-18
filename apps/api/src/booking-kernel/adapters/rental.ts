import { prisma } from "@camermove/db"
import { ConflictError } from "@camermove/config"
import { EVENT_TOPICS } from "@camermove/events"
import { referenceForKind } from "../references.js"
import type { ConfirmLink, ConfirmNotification, CancelEntity } from "../types.js"
import type { AdapterInstance } from "./types.js"

export const rentalAdapter: AdapterInstance = {
  kind: "rental",
  table: "RentalVehicle",
  expiryTable: "RentalBooking",
  idField: "rentalVehicleId",
  notFoundMessage: "Véhicule de location introuvable",

  // Inventory-first: the vehicle must exist before booking.
  async find(id: string) {
    return prisma.rentalVehicle.findUnique({ where: { id } })
  },

  async findLink(paymentId: string, tx?: unknown) {
    // Await is mandatory (Prisma 6 lazy proxy is truthy — see trip.ts).
    // Link describes the rental booking entity, not the payment row.
    const t = tx as { payment: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> } } | undefined
    const p = await (t
      ? t.payment.findUnique({ where: { id: paymentId }, include: { rentalBooking: true } })
      : prisma.payment.findUnique({ where: { id: paymentId }, include: { rentalBooking: true } }))
    if (!p) return null
    const rb = (p as unknown as { rentalBooking: { id: string; userId: string; status: string; totalAmount: number } | null }).rentalBooking
    if (!rb) return null
    return { id: rb.id, userId: rb.userId, status: rb.status, totalAmount: rb.totalAmount }
  },

  isConfirmable(entity: ConfirmLink) { return entity.status === "pending_payment" },

  async confirm(tx: unknown, link: ConfirmLink, _event: unknown) {
    await (tx as { rentalBooking: { update: (a: unknown) => Promise<unknown> } }).rentalBooking.update({
      where: { id: link.id }, data: { status: "confirmed" },
    })
  },

  notification(entity: Record<string, unknown>): ConfirmNotification {
    const link = entity as ConfirmLink
    return { topic: EVENT_TOPICS.rentalBookingConfirmed, type: "rental.booking.confirmed", userId: link.userId, payload: { bookingId: link.id, reference: link.reference, amount: link.totalAmount } }
  },

  async findEntityByPaymentId(paymentId: string) {
    return prisma.payment.findUnique({ where: { id: paymentId }, include: { rentalBooking: true } })
  },

  makeReference(id: string) { return referenceForKind("rental", id) },

  calcTotalAmount(entity: Record<string, unknown>, input) {
    const pricePerUnit = Number(entity.pricePerUnit ?? 0)
    const ms = (input.endDate?.getTime() ?? 0) - (input.startDate?.getTime() ?? 0)
    const days = Number.isFinite(ms) ? Math.max(1, Math.ceil(ms / 86400000)) : 1
    return pricePerUnit * days
  },

  async checkAvailability(entity, input, tx) {
    const startDate = input.startDate
    const endDate = input.endDate
    if (!startDate || !endDate) throw new ConflictError("Dates de location requises")
    const overlapping = await (tx as { rentalBooking: { count: (a: unknown) => Promise<number> } }).rentalBooking.count({
      where: { rentalVehicleId: entity.id, status: { in: ["pending_payment", "confirmed"] }, startDate: { lt: endDate }, endDate: { gt: startDate } },
    })
    // One physical vehicle: any overlap blocks the period.
    if (overlapping >= 1) throw new ConflictError("Plus de disponibilité pour cette période — déjà réservé")
  },

  mapCreateData(data, input, entity) {
    // RentalBooking has no reference column; duration/unit derive from dates + vehicle.
    const { reference: _reference, ...rest } = data
    const ms = ((input.endDate as Date | undefined)?.getTime() ?? 0) - ((input.startDate as Date | undefined)?.getTime() ?? 0)
    const duration = Number.isFinite(ms) ? Math.max(1, Math.ceil(ms / 86400000)) : 1
    return {
      ...rest,
      duration,
      durationUnit: (entity.durationUnit as string | undefined) ?? "day",
    }
  },

  async create(data: Record<string, unknown>, tx: unknown) {
    const t = tx as { rentalBooking: { create: (a: unknown) => Promise<Record<string, unknown>> } }
    return t.rentalBooking.create({ data })
  },

  assertCancellable() {},
  async findFresh(tx, id) { return (tx as { rentalBooking: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> } }).rentalBooking.findUnique({ where: { id } }) as unknown as Promise<Partial<CancelEntity> & CancelEntity | null> },
  async releaseInventory() {},
  async cancel(tx, entity) { return entity as unknown as Record<string, unknown> },
  auditAction: "rental.booking.cancel",
  auditEntityType: "RentalBooking",
}
