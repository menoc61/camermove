import type { Prisma } from "@camermove/db"

export type PayableKind = "trip" | "hotel" | "rental" | "event" | "parcel" | "insurance"

export type EntityStatus = "pending_payment" | "confirmed" | "cancelled" | "expired" | "refunded"

export interface OverlapCheckInput {
  kind: PayableKind
  entityId: string
  startDate?: Date
  endDate?: Date
  seatCount?: number
  roomTypeId?: string
  rentalVehicleId?: string
  ticketCategoryId?: string
}

export interface OverlapPredicate {
  (tx: unknown, input: OverlapCheckInput): Promise<number>
}

export interface PriceFn {
  (tx: unknown, input: OverlapCheckInput): Promise<number>
}

export interface ReleaseInventoryFn {
  (tx: unknown, entityId: string, seatCount?: number): Promise<void>
}

export interface AdapterConfig {
  kind: PayableKind
  table: string
  idField: string
  referencePrefix: string
  generateReference: (id: string) => string
  findEntity: (id: string, tx?: unknown) => Promise<EntityRow | null>
  findEntityByPaymentId: (paymentId: string) => Promise<EntityRow | null>
  overlapPredicate: OverlapPredicate
  priceFn: PriceFn
  releaseInventory: ReleaseInventoryFn
  getHoldExpiryMinutes: () => Promise<number>
  notificationPayload: (entity: EntityRow) => Record<string, unknown>
  auditExtra?: (entity: EntityRow) => Record<string, unknown>
}

export interface EntityRow {
  id: string
  userId: string
  status: string
  totalAmount: number
  paymentId?: string | null
  [key: string]: unknown
}

export interface ReserveInput {
  kind: PayableKind
  userId: string
  seatCount?: number
  passengers?: Array<{ fullName: string; phone?: string }>
  checkInDate?: Date
  checkOutDate?: Date
  guestCount?: number
  guestNames?: string[]
  specialRequests?: string
  startDate?: Date
  endDate?: Date
  pickupCity?: string
  dropoffCity?: string
  driverName?: string
  driverPhone?: string
  eventId?: string
  ticketCategoryId?: string
  quantity?: number
  senderName?: string
  senderPhone?: string
  recipientName?: string
  recipientPhone?: string
  senderCity?: string
  recipientCity?: string
  recipientAddress?: string
  parcelType?: string
  weightKg?: number
  dimensionsCm?: string
  description?: string
  declaredValue?: number
  operatorId?: string
  meta?: Record<string, unknown>
}

export interface ReserveResult {
  entity: EntityRow
  holdExpiresAt: Date
  reference: string
  totalAmount: number
}

export interface ConfirmInput {
  paymentId: string
  event: unknown
}

export interface CancelInput {
  entityId: string
  actorId: string
  actorRole?: string
}

export interface ExpireHoldInput {
  entityId: string
}