/**
 * booking-kernel — the one lifecycle module for every payable entity kind
 * (trip, hotel, rental, event, parcel, insurance).
 * Domain adapters supply only: link lookup, overlap/release policy, notification
 * payload and reference prefix. The kernel owns the ACID ceremony:
 * SELECT ... FOR UPDATE, idempotency re-checks, audit log, typed event publish.
 */

export type PayableKind = "trip" | "hotel" | "rental" | "event" | "parcel" | "insurance"

/** Single source of truth for payment references per entity kind. */
export const ENTITY_REFERENCE_PREFIX: Record<Exclude<PayableKind, "trip">, string> = {
  hotel: "HOTEL-",
  rental: "RENTAL-",
  event: "EVENT-",
  parcel: "PARCEL-",
  insurance: "INS-",
} as const

export const TRIP_REFERENCE_PREFIX = "CM-" as const

export function referenceForKind(kind: Exclude<PayableKind, "trip">, id: string): string {
  return `${ENTITY_REFERENCE_PREFIX[kind]}${id.slice(0, 8).toUpperCase()}`
}

export function tripReference(id: string): string {
  return `${TRIP_REFERENCE_PREFIX}${id.slice(0, 8).toUpperCase()}`
}

export const PAYABLE_KINDS_BY_PREFIX: Array<{ prefix: string; kind: Exclude<PayableKind, "trip"> }> = (
  Object.entries(ENTITY_REFERENCE_PREFIX) as Array<[Exclude<PayableKind, "trip">, string]>
).map(([kind, prefix]) => ({ prefix, kind }))