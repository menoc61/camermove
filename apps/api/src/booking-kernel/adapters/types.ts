import type { PayableKind } from "../references.js"
import type { ConfirmLink, ConfirmNotification, CancelEntity } from "../types.js"

/**
 * Reserve-time input view. Mirrors ReserveInput's date/quantity/meta fields
 * without importing reserve.js (which would cycle back into adapters).
 */
export interface ReserveCalcInput {
  meta: Record<string, unknown>
  quantity?: number
  checkInDate?: Date
  checkOutDate?: Date
  startDate?: Date
  endDate?: Date
  [key: string]: unknown
}

export interface AdapterInstance {
  kind: PayableKind
  /** Inventory table: row-locked + loaded by find() during reserve.
   *  The bookable inventory that must exist BEFORE the booking row
   *  (Trip, HotelRoom, RentalVehicle, Event). */
  table: string
  /** Table holding the expirable hold row (status + holdExpiresAt).
   *  Differs from `table` for trip (holds live on Booking, locks on Trip).
   *  Null when the kind has no expiring holds (parcel, insurance). */
  expiryTable: string | null
  /** meta key carrying the inventory id (trip id, room id, vehicle id, event id). */
  idField: string
  /** False when the kind has no pre-existing inventory to lock/load
   *  (parcel: every field comes from meta). Reserve then skips the
   *  lock + find + hold-expiry scheduling for that kind. */
  requiresInventory?: boolean
  /** Pre-generate the booking-row id when the reference must derive from
   *  it before create (parcel: referenceForKind(parcel, id) must match the
   *  row for webhook prefix-scan resolution). Reserve injects it as data.id. */
  newEntityId?: () => string
  /** Remap kernel create-data to the booking table's columns
   *  (strip kernel-only fields like reference, add derived ones like
   *  trackingNumber/tripId/duration). Defaults to identity. */
  mapCreateData?: (data: Record<string, unknown>, input: ReserveCalcInput, entity: Record<string, unknown>) => Record<string, unknown>
  notFoundMessage: string
  find: (id: string) => Promise<Record<string, unknown> | null>
  findLink: (paymentId: string, tx?: unknown) => Promise<ConfirmLink | null>
  isConfirmable: (entity: ConfirmLink) => boolean
  confirm: (tx: unknown, link: ConfirmLink, event: unknown) => Promise<void>
  notification: (entity: Record<string, unknown>) => ConfirmNotification
  findEntityByPaymentId: (paymentId: string) => Promise<Record<string, unknown> | null>
  makeReference: (id: string) => string
  calcTotalAmount: (entity: Record<string, unknown>, input: ReserveCalcInput) => number
  checkAvailability?: (entity: Record<string, unknown>, input: ReserveCalcInput, tx: unknown) => Promise<void> | undefined
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
