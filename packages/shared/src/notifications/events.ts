/**
 * Typed notification event contract — shared between apps/api (publisher) and
 * apps/worker (consumer/dispatcher). Discriminated union keeps each event
 * type's payload strongly typed so channel adapters never read undefined
 * fields. See 04-RESEARCH.md Pitfalls: Phase 3 shipped bare {userId, bookingId}
 * which silently produced Notification rows with payload missing to/subject.
 */

export type NotificationEventType =
  | "booking.confirmed"
  | "payment.confirmed"
  | "payment.failed"
  | "payment.expired"
  | "ticket.issued"
  | "trip.reminder.24h"
  | "hotel.booking.confirmed"
  | "rental.booking.confirmed"
  | "parcel.status.changed"
  | "insurance.policy.issued"
  | "event.booking.confirmed"
  | "booking.status.changed"

/** Per-event payload — every field optional, dispatcher only renders what's present. */
export interface NotificationEventPayload {
  /** Booking reference (CM-XXXXXXXX). */
  reference?: string
  /** Booking id (cuid). */
  bookingId?: string
  /** User id (cuid). */
  userId?: string
  /** Ticket id (cuid) — present for ticket.issued only. */
  ticketId?: string
  /** 12-char base32 verification code — present for ticket.issued / trip.reminder. */
  verificationCode?: string
  /** Amount in XAF (integer) — present for payment.confirmed. */
  amount?: number
  /** Trip id (cuid) — present for ticket.issued / trip.reminder. */
  tripId?: string
  /** Departure ISO timestamp. */
  departureAt?: string
  /** Origin city (e.g. "Yaoundé"). */
  origin?: string
  /** Destination city (e.g. "Douala"). */
  destination?: string
  /** Transporter company name — present for ticket.issued. */
  transporter?: string
  /** Number of seats — present for booking.confirmed. */
  seatCount?: number
  /** Hotel name — present for hotel.booking.confirmed. */
  hotelName?: string
  /** Room name — present for hotel.booking.confirmed. */
  roomName?: string
  /** Check-in ISO date — present for hotel.booking.confirmed. */
  checkInDate?: string
  /** Check-out ISO date — present for hotel.booking.confirmed. */
  checkOutDate?: string
  /** Pickup city — present for rental.booking.confirmed. */
  pickupCity?: string
  /** Dropoff city — present for rental.booking.confirmed. */
  dropoffCity?: string
  /** Rental start ISO date — present for rental.booking.confirmed. */
  startDate?: string
  /** Rental end ISO date — present for rental.booking.confirmed. */
  endDate?: string
  /** Parcel id (cuid) — present for parcel.status.changed. */
  parcelId?: string
  /** Parcel tracking number (CM-XXXX-XXXX) — present for parcel.status.changed. */
  trackingNumber?: string
  /** New parcel status — present for parcel.status.changed. */
  status?: string
  /** Parcel current location — present for parcel.status.changed. */
  location?: string
  /** Policy id (cuid) — present for insurance.policy.issued. */
  policyId?: string
  /** Policy number (INS-XXXXXX-XXXXXXXX) — present for insurance.policy.issued. */
  policyNumber?: string
  /** Coverage type (basic|standard|premium|family) — present for insurance.policy.issued. */
  coverageType?: string
  /** Event name — present for event.booking.confirmed. */
  eventName?: string
  /** Event venue — present for event.booking.confirmed. */
  venue?: string
  /** EventBooking ticket number (EVT-XXXX-XXXX) — present for event.booking.confirmed. */
  ticketNumber?: string
  /** Number of event tickets — present for event.booking.confirmed. */
  quantity?: number
  /** Service label (e.g. "Hôtel", "Location", "Événement", "Assurance", "Colis") — present for booking.status.changed. */
  serviceLabel?: string
  /** Entity label (hotel/vehicle/event name, destination, tracking number) — present for booking.status.changed. */
  entityLabel?: string
  /** New booking status (e.g. "cancelled") — present for booking.status.changed. */
  newStatus?: string
}

export interface NotificationEvent {
  type: NotificationEventType
  userId: string
  payload: NotificationEventPayload
}
