/**
 * Domain adapters for each payable kind.
 * Each adapter supplies only the predicates and callbacks the kernel needs.
 * No business logic duplication — kernel owns the ACID ceremony.
 */
import { prisma } from "@camermove/db"
import { getAppSettingsCached } from "@camermove/db"
import { ConflictError, NotFoundError, BadRequestError } from "@camermove/config"
import type { AdapterConfig, EntityRow, OverlapCheckInput, PayableKind, ReserveInput } from "./types"
import { referenceForKind, tripReference, tripPrefix } from "./references"

/** Shared helpers */
async function getHoldExpiryMinutes(): Promise<number> {
  try {
    const s = await getAppSettingsCached()
    const v = Number((s as { holdExpiryMinutes?: unknown }).holdExpiryMinutes ?? 15)
    return Number.isFinite(v) && v > 0 ? v : 15
  } catch {
    return 15
  }
}

function calcNights(checkIn: Date, checkOut: Date): number {
  const ms = checkOut.getTime() - checkIn.getTime()
  return Math.max(1, Math.ceil(ms / 86400000))
}

/** Trip adapter — uses SeatAvailability FOR UPDATE + atomic hold helpers */
export const tripAdapter: AdapterConfig = {
  kind: "trip",
  table: "Booking",
  idField: "id",
  referencePrefix: tripPrefix(),
  generateReference: tripReference,
  async findEntity(id: string, tx?: unknown) {
    const client = (tx as { booking: { findUnique: (a: unknown) => Promise<unknown> } })?.booking ?? prisma.booking
    return client.findUnique({
      where: { id },
      include: { passengers: true, trip: true },
    })
  },
  async findEntityByPaymentId(paymentId: string) {
    return prisma.booking.findFirst({ where: { paymentId } })
  },
  async overlapPredicate(_tx: unknown, input: OverlapCheckInput) {
    if (!input.seatCount) throw new BadRequestError("seatCount required")
    const rows = await prisma.$queryRaw<Array<{ seatsAvailable: number; seatsHeld: number }>>`
      SELECT "seatsAvailable", "seatsHeld" FROM "SeatAvailability"
      WHERE "tripId" = ${input.entityId}
      FOR UPDATE
    `
    const row = rows[0]
    if (!row) throw new ConflictError("Aucune disponibilité pour ce trajet")
    if (row.seatsAvailable < input.seatCount) throw new ConflictError("Places insuffisantes")
    return row.seatsAvailable
  },
  async priceFn(_tx: unknown, input: OverlapCheckInput) {
    const trip = await prisma.trip.findUnique({ where: { id: input.entityId }, select: { price: true } })
    if (!trip) throw new NotFoundError("Trajet introuvable")
    return trip.price * (input.seatCount ?? 1)
  },
  async releaseInventory(_tx: unknown, entityId: string, seatCount = 1) {
    await prisma.seatAvailability.update({
      where: { tripId: entityId },
      data: { seatsAvailable: { increment: seatCount }, seatsHeld: { decrement: seatCount } },
    })
  },
  getHoldExpiryMinutes,
  notificationPayload: (entity: EntityRow) => ({
    bookingId: entity.id,
    reference: entity.reference,
    amount: entity.totalAmount,
    tripId: (entity as { trip?: { id: string } }).trip?.id,
    seatCount: (entity as { seatCount?: number }).seatCount,
  }),
}

/** Hotel adapter — overlap count on HotelBooking by date range */
export const hotelAdapter: AdapterConfig = {
  kind: "hotel",
  table: "HotelBooking",
  idField: "id",
  referencePrefix: "HOTEL-",
  generateReference: (id) => referenceForKind("hotel", id),
  async findEntity(id: string, tx?: unknown) {
    const client = (tx as { hotelBooking: { findUnique: (a: unknown) => Promise<unknown> } })?.hotelBooking ?? prisma.hotelBooking
    return client.findUnique({ where: { id }, include: { hotel: true, roomType: true } })
  },
  async findEntityByPaymentId(paymentId: string) {
    return prisma.hotelBooking.findFirst({ where: { paymentId }, include: { hotel: true, roomType: true } })
  },
  async overlapPredicate(tx: unknown, input: OverlapCheckInput) {
    if (!input.roomTypeId || !input.checkInDate || !input.checkOutDate) {
      throw new BadRequestError("roomTypeId, checkInDate, checkOutDate required")
    }
    const t = tx as { hotelBooking: { count: (a: unknown) => Promise<number> } }
    return t.hotelBooking.count({
      where: {
        roomTypeId: input.roomTypeId,
        status: { in: ["pending_payment", "confirmed"] },
        checkInDate: { lt: input.checkOutDate },
        checkOutDate: { gt: input.checkInDate },
      },
    })
  },
  async priceFn(tx: unknown, input: OverlapCheckInput) {
    if (!input.roomTypeId) throw new BadRequestError("roomTypeId required")
    const t = tx as { hotelRoom: { findUnique: (a: unknown) => Promise<{ pricePerNight: number } | null> } }
    const room = await t.hotelRoom.findUnique({
      where: { id: input.roomTypeId },
      select: { pricePerNight: true },
    })
    if (!room) throw new NotFoundError("Type de chambre introuvable")
    const nights = calcNights(input.checkInDate!, input.checkOutDate!)
    return room.pricePerNight * nights
  },
  async releaseInventory() {
    // Hotel availability is computed via overlap count — no physical inventory to release
  },
  getHoldExpiryMinutes,
  notificationPayload: (entity: EntityRow) => ({
    bookingId: entity.id,
    reference: entity.reference,
    amount: entity.totalAmount,
    hotelId: (entity as { hotelId?: string }).hotelId,
    roomTypeId: (entity as { roomTypeId?: string }).roomTypeId,
    checkInDate: (entity as { checkInDate?: Date }).checkInDate,
    checkOutDate: (entity as { checkOutDate?: Date }).checkOutDate,
  }),
}

/** Rental adapter — overlap check on RentalBooking by date range */
export const rentalAdapter: AdapterConfig = {
  kind: "rental",
  table: "RentalBooking",
  idField: "id",
  referencePrefix: "RENTAL-",
  generateReference: (id) => referenceForKind("rental", id),
  async findEntity(id: string, tx?: unknown) {
    const client = (tx as { rentalBooking: { findUnique: (a: unknown) => Promise<unknown> } })?.rentalBooking ?? prisma.rentalBooking
    return client.findUnique({ where: { id }, include: { vehicle: true } })
  },
  async findEntityByPaymentId(paymentId: string) {
    return prisma.rentalBooking.findFirst({ where: { paymentId }, include: { vehicle: true } })
  },
  async overlapPredicate(tx: unknown, input: OverlapCheckInput) {
    if (!input.rentalVehicleId || !input.startDate || !input.endDate) {
      throw new BadRequestError("rentalVehicleId, startDate, endDate required")
    }
    const t = tx as { rentalBooking: { findFirst: (a: unknown) => Promise<unknown> } }
    return t.rentalBooking.findFirst({
      where: {
        rentalVehicleId: input.rentalVehicleId,
        status: { in: ["pending_payment", "confirmed", "active"] },
        startDate: { lt: input.endDate },
        endDate: { gt: input.startDate },
      },
    }).then((r) => (r ? 1 : 0))
  },
  async priceFn(tx: unknown, input: OverlapCheckInput) {
    if (!input.rentalVehicleId) throw new BadRequestError("rentalVehicleId required")
    const t = tx as { rentalVehicle: { findUnique: (a: unknown) => Promise<{ pricePerUnit: number; durationUnit: string } | null> } }
    const vehicle = await t.rentalVehicle.findUnique({
      where: { id: input.rentalVehicleId },
      select: { pricePerUnit: true, durationUnit: true },
    })
    if (!vehicle) throw new NotFoundError("Véhicule introuvable")
    const ms = input.endDate!.getTime() - input.startDate!.getTime()
    const unit = vehicle.durationUnit as "hour" | "day" | "week" | "month"
    let duration: number
    if (unit === "hour") duration = Math.max(1, Math.ceil(ms / 3600000))
    else if (unit === "week") duration = Math.max(1, Math.ceil(ms / (86400000 * 7)))
    else if (unit === "month") duration = Math.max(1, Math.ceil(ms / (86400000 * 30)))
    else duration = Math.max(1, Math.ceil(ms / 86400000))
    return vehicle.pricePerUnit * duration
  },
  async releaseInventory() {
    // Rental availability computed via overlap — no physical inventory to release
  },
  getHoldExpiryMinutes,
  notificationPayload: (entity: EntityRow) => ({
    bookingId: entity.id,
    reference: entity.reference,
    amount: entity.totalAmount,
    rentalVehicleId: (entity as { rentalVehicleId?: string }).rentalVehicleId,
    startDate: (entity as { startDate?: Date }).startDate,
    endDate: (entity as { endDate?: Date }).endDate,
    pickupCity: (entity as { pickupCity?: string }).pickupCity,
    dropoffCity: (entity as { dropoffCity?: string }).dropoffCity,
  }),
}

/** Event adapter — overlap check on TicketCategory sold count */
export const eventAdapter: AdapterConfig = {
  kind: "event",
  table: "EventBooking",
  idField: "id",
  referencePrefix: "EVENT-",
  generateReference: (id) => referenceForKind("event", id),
  async findEntity(id: string, tx?: unknown) {
    const client = (tx as { eventBooking: { findUnique: (a: unknown) => Promise<unknown> } })?.eventBooking ?? prisma.eventBooking
    return client.findUnique({ where: { id }, include: { event: true, ticketCategory: true } })
  },
  async findEntityByPaymentId(paymentId: string) {
    return prisma.eventBooking.findFirst({ where: { paymentId }, include: { event: true, ticketCategory: true } })
  },
  async overlapPredicate(tx: unknown, input: OverlapCheckInput) {
    if (!input.ticketCategoryId || !input.quantity) {
      throw new BadRequestError("ticketCategoryId, quantity required")
    }
    const t = tx as { ticketCategory: { findUnique: (a: unknown) => Promise<{ quantity: number; sold: number } | null> } }
    const cat = await t.ticketCategory.findUnique({
      where: { id: input.ticketCategoryId },
      select: { quantity: true, sold: true },
    })
    if (!cat) throw new NotFoundError("Catégorie de billet introuvable")
    const available = cat.quantity - cat.sold
    if (available < input.quantity) throw new ConflictError("Quantité insuffisante")
    return available
  },
  async priceFn(tx: unknown, input: OverlapCheckInput) {
    if (!input.ticketCategoryId || !input.quantity) throw new BadRequestError("ticketCategoryId, quantity required")
    const t = tx as { ticketCategory: { findUnique: (a: unknown) => Promise<{ price: number } | null> } }
    const cat = await t.ticketCategory.findUnique({
      where: { id: input.ticketCategoryId },
      select: { price: true },
    })
    if (!cat) throw new NotFoundError("Catégorie de billet introuvable")
    return cat.price * input.quantity
  },
  async releaseInventory(tx: unknown, entityId: string) {
    const t = tx as { eventBooking: { findUnique: (a: unknown) => Promise<{ ticketCategoryId: string; quantity: number } | null>; ticketCategory: { update: (a: unknown) => Promise<unknown> } } }
    const booking = await t.eventBooking.findUnique({
      where: { id: entityId },
      select: { ticketCategoryId: true, quantity: true },
    })
    if (booking) {
      await t.ticketCategory.update({
        where: { id: booking.ticketCategoryId },
        data: { sold: { decrement: booking.quantity } },
      })
    }
  },
  getHoldExpiryMinutes,
  notificationPayload: (entity: EntityRow) => ({
    bookingId: entity.id,
    reference: entity.reference,
    amount: entity.totalAmount,
    eventId: (entity as { eventId?: string }).eventId,
    ticketCategoryId: (entity as { ticketCategoryId?: string }).ticketCategoryId,
    quantity: (entity as { quantity?: number }).quantity,
  }),
}

/** Parcel adapter — no overlap check, simple payment reference */
export const parcelAdapter: AdapterConfig = {
  kind: "parcel",
  table: "Parcel",
  idField: "id",
  referencePrefix: "PARCEL-",
  generateReference: (id) => referenceForKind("parcel", id),
  async findEntity(id: string, tx?: unknown) {
    const client = (tx as { parcel: { findUnique: (a: unknown) => Promise<unknown> } })?.parcel ?? prisma.parcel
    return client.findUnique({ where: { id } })
  },
  async findEntityByPaymentId(paymentId: string) {
    return prisma.parcel.findFirst({ where: { paymentId } })
  },
  async overlapPredicate() {
    return 0 // no overlap check for parcels
  },
  async priceFn(_tx: unknown, input: OverlapCheckInput) {
    const parcel = await prisma.parcel.findUnique({ where: { id: input.entityId }, select: { shippingCost: true } })
    if (!parcel) throw new NotFoundError("Colis introuvable")
    return parcel.shippingCost
  },
  async releaseInventory() {
    // No inventory for parcels
  },
  getHoldExpiryMinutes,
  notificationPayload: (entity: EntityRow) => ({
    parcelId: entity.id,
    reference: entity.reference,
    amount: entity.totalAmount,
    trackingNumber: (entity as { trackingNumber?: string }).trackingNumber,
    senderCity: (entity as { senderCity?: string }).senderCity,
    recipientCity: (entity as { recipientCity?: string }).recipientCity,
  }),
}

/** Insurance adapter — placeholder for future implementation */
export const insuranceAdapter: AdapterConfig = {
  kind: "insurance",
  table: "InsurancePolicy",
  idField: "id",
  referencePrefix: "INS-",
  generateReference: (id) => referenceForKind("insurance", id),
  async findEntity(id: string, tx?: unknown) {
    const client = (tx as { insurancePolicy: { findUnique: (a: unknown) => Promise<unknown> } })?.insurancePolicy ?? prisma.insurancePolicy
    return client.findUnique({ where: { id } })
  },
  async findEntityByPaymentId(paymentId: string) {
    return prisma.insurancePolicy.findFirst({ where: { paymentId } })
  },
  async overlapPredicate() {
    return 0 // no overlap check for insurance
  },
  async priceFn(_tx: unknown, input: OverlapCheckInput) {
    const policy = await prisma.insurancePolicy.findUnique({ where: { id: input.entityId }, select: { premium: true } })
    if (!policy) throw new NotFoundError("Police d'assurance introuvable")
    return policy.premium
  },
  async releaseInventory() {
    // No inventory for insurance
  },
  getHoldExpiryMinutes,
  notificationPayload: (entity: EntityRow) => ({
    policyId: entity.id,
    reference: entity.reference,
    amount: entity.totalAmount,
  }),
}

/** Registry of all adapters */
export const ADAPTERS: Record<PayableKind, AdapterConfig> = {
  trip: tripAdapter,
  hotel: hotelAdapter,
  rental: rentalAdapter,
  event: eventAdapter,
  parcel: parcelAdapter,
  insurance: insuranceAdapter,
}

/** Get adapter by kind */
export function getAdapter(kind: PayableKind): AdapterConfig {
  return ADAPTERS[kind]
}