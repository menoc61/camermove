import { prisma } from "@camermove/db"
import { ConflictError, ForbiddenError, NotFoundError, createLogger } from "@camermove/config"
import { EVENT_TOPICS, makeEvent, publishEvent } from "@camermove/events"
import { referenceForKind, tripReference, type PayableKind } from "./references.js"
import type { ConfirmLink, ConfirmNotification, CancelEntity } from "./types.js"

const log = createLogger()

export interface AdapterInstance {
  kind: PayableKind
  table: string
  idField: string
  notFoundMessage: string
  find: (id: string) => Promise<Record<string, unknown> | null>
  findLink: (paymentId: string, tx?: unknown) => Promise<ConfirmLink | null>
  isConfirmable: (entity: ConfirmLink) => boolean
  confirm: (tx: unknown, entityId: string) => Promise<void>
  notification: (entity: Record<string, unknown>) => ConfirmNotification
  findEntityByPaymentId: (paymentId: string) => Promise<Record<string, unknown> | null>
  makeReference: (id: string) => string
  calcTotalAmount: (entity: Record<string, unknown>, input: { meta: Record<string, unknown> }) => number
  checkAvailability?: (entity: Record<string, unknown>, input: { meta: Record<string, unknown> }, tx: unknown) => Promise<void> | undefined
  create: (data: Record<string, unknown>, tx: unknown) => Promise<Record<string, unknown>>
  // Cancel-specific
  assertCancellable: (entity: Partial<CancelEntity> & CancelEntity) => void | Promise<void>
  findFresh: (tx: unknown, id: string) => Promise<Partial<CancelEntity> & CancelEntity | null>
  releaseInventory?: (tx: unknown, entity: Partial<CancelEntity> & CancelEntity) => Promise<void>
  cancel: (tx: unknown, entity: Partial<CancelEntity> & CancelEntity) => Promise<Record<string, unknown>>
  auditAction: string
  auditEntityType: string
  auditExtra?: (entity: Partial<CancelEntity> & CancelEntity) => Record<string, unknown>
}

export function getAdapter(kind: PayableKind): AdapterInstance {
  switch (kind) {
    case "hotel": return hotelAdapter
    case "rental": return rentalAdapter
    case "event": return eventAdapter
    case "parcel": return parcelAdapter
    case "trip": return tripAdapter
    case "insurance": return insuranceAdapter
  }
}

function toConfirmLink(row: Record<string, unknown> | null): ConfirmLink | null {
  if (!row) return null
  return { id: row.id as string, userId: row.userId as string, status: row.status as string, totalAmount: row.totalAmount as number }
}

// ── Hotel ──────────────────────────────────────────────────────────

export const hotelAdapter: AdapterInstance = {
  kind: "hotel",
  table: "HotelBooking",
  idField: "roomTypeId",
  notFoundMessage: "Réservation hôtelière introuvable",

  async find(id: string) {
    return prisma.hotelBooking.findUnique({ where: { id } })
  },

  async findLink(paymentId: string, tx?: unknown) {
    const p = tx ? (tx as { payment: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> } }).payment.findUnique({ where: { id: paymentId }, include: { hotelBooking: true } })
      : await prisma.payment.findUnique({ where: { id: paymentId }, include: { hotelBooking: true } })
    return toConfirmLink(p as Record<string, unknown>)
  },

  isConfirmable(entity: ConfirmLink) { return entity.status === "pending_payment" },

  async confirm(tx: unknown, entityId: string) {
    await (tx as { hotelBooking: { update: (a: unknown) => Promise<unknown> } }).hotelBooking.update({
      where: { id: entityId }, data: { status: "confirmed" },
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

  calcTotalAmount(entity: Record<string, unknown>) {
    const pricePerNight = Number(entity.pricePerNight ?? 0)
    const nights = Math.max(1, Math.ceil((Number(entity.checkOutDate ?? 0) - Number(entity.checkInDate ?? 0)) / 86400000))
    return pricePerNight * nights
  },

  async checkAvailability(entity, input, tx) {
    const checkInDate = entity.checkInDate as Date
    const checkOutDate = entity.checkOutDate as Date
    const overlapping = await (tx as { hotelBooking: { count: (a: unknown) => Promise<number> } }).hotelBooking.count({
      where: { roomTypeId: entity.roomTypeId, status: { in: ["pending_payment", "confirmed"] }, checkInDate: { lt: checkOutDate }, checkOutDate: { gt: checkInDate } },
    })
    if (overlapping >= (entity.quantity as number)) throw new ConflictError("Plus de disponibilité pour ces dates")
  },

  async create(data: Record<string, unknown>, tx: unknown) {
    const t = tx as { hotelBooking: { create: (a: unknown) => Promise<Record<string, unknown>> } }
    return t.hotelBooking.create({ data: { ...data, checkInDate: data.checkInDate ?? (data.meta as Record<string, unknown>)?.checkInDate, checkOutDate: data.checkOutDate ?? (data.meta as Record<string, unknown>)?.checkOutDate } })
  },

  assertCancellable() {},
  async findFresh(tx, id) { return (tx as { hotelBooking: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> } }).hotelBooking.findUnique({ where: { id } }) as unknown as Promise<Partial<CancelEntity> & CancelEntity | null> },
  async releaseInventory() {},
  async cancel(tx, entity) { return entity as unknown as Record<string, unknown> },
  auditAction: "hotel.booking.cancel",
  auditEntityType: "HotelBooking",
}

// ── Rental ─────────────────────────────────────────────────────────

export const rentalAdapter: AdapterInstance = {
  kind: "rental",
  table: "RentalBooking",
  idField: "rentalVehicleId",
  notFoundMessage: "Réservation de location introuvable",

  async find(id: string) {
    return prisma.rentalBooking.findUnique({ where: { id } })
  },

  async findLink(paymentId: string, tx?: unknown) {
    const p = tx ? (tx as { payment: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> } }).payment.findUnique({ where: { id: paymentId }, include: { rentalBooking: true } })
      : await prisma.payment.findUnique({ where: { id: paymentId }, include: { rentalBooking: true } })
    return toConfirmLink(p as Record<string, unknown>)
  },

  isConfirmable(entity: ConfirmLink) { return entity.status === "pending_payment" },

  async confirm(tx: unknown, entityId: string) {
    await (tx as { rentalBooking: { update: (a: unknown) => Promise<unknown> } }).rentalBooking.update({
      where: { id: entityId }, data: { status: "confirmed" },
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

  calcTotalAmount(entity: Record<string, unknown>) {
    const pricePerDay = Number(entity.pricePerDay ?? entity.pricePerNight ?? 0)
    const ms = (entity.endDate as Date ? (entity.endDate as Date).getTime() : 0) - (entity.startDate as Date ? (entity.startDate as Date).getTime() : 0)
    const days = Math.max(1, Math.ceil(ms / 86400000))
    return pricePerDay * days
  },

  async checkAvailability(entity, input, tx) {
    const startDate = entity.startDate as Date
    const endDate = entity.endDate as Date
    const overlapping = await (tx as { rentalBooking: { count: (a: unknown) => Promise<number> } }).rentalBooking.count({
      where: { rentalVehicleId: entity.rentalVehicleId, status: { in: ["pending_payment", "confirmed"] }, startDate: { lt: endDate }, endDate: { gt: startDate } },
    })
    if (overlapping >= ((entity as { quantity?: number }).quantity ?? 1)) throw new ConflictError("Plus de disponibilité pour cette période — déjà réservé")
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

// ── Event ──────────────────────────────────────────────────────────

export const eventAdapter: AdapterInstance = {
  kind: "event",
  table: "EventBooking",
  idField: "eventId",
  notFoundMessage: "Billet événement introuvable",

  async find(id: string) {
    return prisma.eventBooking.findUnique({ where: { id } })
  },

  async findLink(paymentId: string, tx?: unknown) {
    const p = tx ? (tx as { payment: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> } }).payment.findUnique({ where: { id: paymentId }, include: { eventBooking: true } })
      : await prisma.payment.findUnique({ where: { id: paymentId }, include: { eventBooking: true } })
    return toConfirmLink(p as Record<string, unknown>)
  },

  isConfirmable(entity: ConfirmLink) { return entity.status === "pending_payment" },

  async confirm(tx: unknown, entityId: string) {
    await (tx as { eventBooking: { update: (a: unknown) => Promise<unknown> } }).eventBooking.update({
      where: { id: entityId }, data: { status: "confirmed" },
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

  calcTotalAmount(entity: Record<string, unknown>, input?: Record<string, unknown>) {
    const meta = input?.meta as Record<string, unknown> | undefined
    const base = Number(entity.totalAmount ?? (meta?.price as number) ?? 0)
    const qty = Number(input?.quantity ?? 1)
    return base * qty
  },

  async checkAvailability(entity, input, tx) {
    const categoryId = (entity.ticketCategoryId ?? entity.ticketCategoryId) as string | undefined
    if (!categoryId) return
    const quantity = Number(input.meta?.quantity ?? 1)
    const category = await (tx as { ticketCategory: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> } }).ticketCategory.findUnique({ where: { id: categoryId } })
    if (!category) throw new NotFoundError("Catégorie de billet introuvable")
    const sold = Number(category.sold ?? 0)
    const held = Number(category.held ?? 0)
    if ((category.quantity as number) - sold - held < quantity) throw new ConflictError("Quantité insuffisante")
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

// ── Parcel ─────────────────────────────────────────────────────────

export const parcelAdapter: AdapterInstance = {
  kind: "parcel",
  table: "Parcel",
  idField: "senderCity",
  notFoundMessage: "Colis introuvable",

  async find(id: string) {
    return prisma.parcel.findUnique({ where: { id } })
  },

  async findLink(paymentId: string, tx?: unknown) {
    const p = tx ? (tx as { payment: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> } }).payment.findUnique({ where: { id: paymentId }, include: { parcel: true } })
      : await prisma.payment.findUnique({ where: { id: paymentId }, include: { parcel: true } })
    return toConfirmLink(p as Record<string, unknown>)
  },

  isConfirmable() { return true },

  async confirm(tx: unknown, entityId: string) {
    await (tx as { parcel: { update: (a: unknown) => Promise<unknown> } }).parcel.update({
      where: { id: entityId }, data: { paymentId: entityId },
    })
  },

  notification(entity: Record<string, unknown>): ConfirmNotification {
    const link = entity as ConfirmLink
    return { topic: EVENT_TOPICS.paymentConfirmed, type: "payment.confirmed", userId: link.userId, payload: { bookingId: link.id, reference: link.reference, amount: link.totalAmount } }
  },

  async findEntityByPaymentId(paymentId: string) {
    return prisma.payment.findUnique({ where: { id: paymentId }, include: { parcel: true } })
  },

  makeReference(id: string) { return `PARCEL-${id.slice(0, 8).toUpperCase()}` },

  calcTotalAmount(entity: Record<string, unknown>) {
    return Number(entity.shippingCost ?? 0)
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

// ── Trip ───────────────────────────────────────────────────────────

export const tripAdapter: AdapterInstance = {
  kind: "trip",
  table: "Booking",
  idField: "tripId",
  notFoundMessage: "Réservation introuvable",

  async find(id: string) {
    return prisma.booking.findUnique({ where: { id } })
  },

  async findLink(paymentId: string, tx?: unknown) {
    const p = tx ? (tx as { payment: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> } }).payment.findUnique({ where: { id: paymentId }, include: { booking: true } })
      : await prisma.payment.findUnique({ where: { id: paymentId }, include: { booking: true } })
    return toConfirmLink(p as Record<string, unknown>)
  },

  isConfirmable(entity: ConfirmLink) { return entity.status === "pending_payment" },

  async confirm(tx: unknown, entityId: string) {
    await (tx as { booking: { update: (a: unknown) => Promise<unknown> } }).booking.update({
      where: { id: entityId }, data: { status: "confirmed" },
    })
  },

  notification(entity: Record<string, unknown>): ConfirmNotification {
    const link = entity as ConfirmLink
    return { topic: EVENT_TOPICS.bookingConfirmed, type: "booking.confirmed", userId: link.userId, payload: { bookingId: link.id, reference: link.reference, amount: link.totalAmount } }
  },

  async findEntityByPaymentId(paymentId: string) {
    return prisma.payment.findUnique({ where: { id: paymentId }, include: { booking: true } })
  },

  makeReference(id: string) { return tripReference(id) },

  calcTotalAmount(entity: Record<string, unknown>) {
    return Number(entity.totalAmount ?? 0)
  },

  async create(data: Record<string, unknown>, tx: unknown) {
    const t = tx as { booking: { create: (a: unknown) => Promise<Record<string, unknown>> } }
    return t.booking.create({ data })
  },

  assertCancellable() {},
  async findFresh(tx, id) { return (tx as { booking: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> } }).booking.findUnique({ where: { id } }) as unknown as Promise<Partial<CancelEntity> & CancelEntity | null> },
  async releaseInventory() {},
  async cancel(tx, entity) { return entity as unknown as Record<string, unknown> },
  auditAction: "booking.cancel",
  auditEntityType: "Booking",
}

// ── Insurance ──────────────────────────────────────────────────────

export const insuranceAdapter: AdapterInstance = {
  kind: "insurance",
  table: "InsurancePolicy",
  idField: "bookingId",
  notFoundMessage: "Assurance introuvable",

  async find(id: string) {
    return prisma.insurancePolicy.findUnique({ where: { id } })
  },

  async findLink(paymentId: string, tx?: unknown) {
    const p = tx ? (tx as { payment: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> } }).payment.findUnique({ where: { id: paymentId }, include: { insurancePolicy: true } })
      : await prisma.payment.findUnique({ where: { id: paymentId }, include: { insurancePolicy: true } })
    return toConfirmLink(p as Record<string, unknown>)
  },

  isConfirmable(entity: ConfirmLink) { return entity.status === "pending_payment" },

  async confirm(tx: unknown, entityId: string) {
    await (tx as { insurancePolicy: { update: (a: unknown) => Promise<unknown> } }).insurancePolicy.update({
      where: { id: entityId }, data: { status: "confirmed" },
    })
  },

  notification(entity: Record<string, unknown>): ConfirmNotification {
    const link = entity as ConfirmLink
    return { topic: EVENT_TOPICS.paymentConfirmed, type: "payment.confirmed", userId: link.userId, payload: { bookingId: link.id, reference: link.reference, amount: link.totalAmount } }
  },

  async findEntityByPaymentId(paymentId: string) {
    return prisma.payment.findUnique({ where: { id: paymentId }, include: { insurancePolicy: true } })
  },

  makeReference(id: string) { return `INS-${id.slice(0, 8).toUpperCase()}` },

  calcTotalAmount(entity: Record<string, unknown>) {
    return Number(entity.totalAmount ?? 0)
  },

  async create(data: Record<string, unknown>, tx: unknown) {
    const t = tx as { insurancePolicy: { create: (a: unknown) => Promise<Record<string, unknown>> } }
    return t.insurancePolicy.create({ data })
  },

  assertCancellable() {},
  async findFresh(tx, id) { return (tx as { insurancePolicy: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> } }).insurancePolicy.findUnique({ where: { id } }) as unknown as Promise<Partial<CancelEntity> & CancelEntity | null> },
  async releaseInventory() {},
  async cancel(tx, entity) { return entity as unknown as Record<string, unknown> },
  auditAction: "insurance.booking.cancel",
  auditEntityType: "InsurancePolicy",
}
