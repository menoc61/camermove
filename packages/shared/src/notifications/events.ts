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
  | "ticket.issued"
  | "trip.reminder.24h"

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
}

export interface NotificationEvent {
  type: NotificationEventType
  userId: string
  payload: NotificationEventPayload
}
