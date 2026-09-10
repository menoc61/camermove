/**
 * Notification Kafka handlers — Phase 4 typed events.
 *
 * Subscribes to: booking.confirmed, payment.confirmed, ticket.issued,
 * trip.reminder.24h, hotel.booking.confirmed, rental.booking.confirmed,
 * parcel.status.changed, insurance.policy.issued, event.booking.confirmed,
 * booking.status.changed.
 * Each handler extracts the typed NotificationEvent from
 * the Kafka envelope and forwards to the dispatcher.
 *
 * Idempotency: the dispatcher creates one Notification row per (event × channel)
 * inside the consumer; the NotificationEvent contains a unique eventId (from
 * Kafka event.id) so re-delivery is observable in the Notification table. For
 * the dispatcher-level dedup, the Notification table is the source of truth
 * (presence check on type + userId + payload.bookingId).
 */
import type { Env } from "@camermove/config"
import { createNotificationDispatcher } from "../notifications/dispatcher"
import type { NotificationEvent } from "@camermove/shared"

export function createNotificationHandlers(env: Env) {
  const dispatcher = createNotificationDispatcher(env)

  return {
    async onBookingConfirmed(event: { data: unknown }) {
      const data = event.data as NotificationEvent
      if (!data?.userId) return
      await dispatcher.dispatch(data)
    },
    async onPaymentConfirmed(event: { data: unknown }) {
      const data = event.data as NotificationEvent
      if (!data?.userId) return
      await dispatcher.dispatch(data)
    },
    async onTicketIssued(event: { data: unknown }) {
      const data = event.data as NotificationEvent
      if (!data?.userId) return
      await dispatcher.dispatch(data)
    },
    async onTripReminder(event: { data: unknown }) {
      const data = event.data as NotificationEvent
      if (!data?.userId) return
      await dispatcher.dispatch(data)
    },
    async onHotelBookingConfirmed(event: { data: unknown }) {
      const data = event.data as NotificationEvent
      if (!data?.userId) return
      await dispatcher.dispatch(data)
    },
    async onRentalBookingConfirmed(event: { data: unknown }) {
      const data = event.data as NotificationEvent
      if (!data?.userId) return
      await dispatcher.dispatch(data)
    },
    async onParcelStatusChanged(event: { data: unknown }) {
      const data = event.data as NotificationEvent
      if (!data?.userId) return
      await dispatcher.dispatch(data)
    },
    async onInsurancePolicyIssued(event: { data: unknown }) {
      const data = event.data as NotificationEvent
      if (!data?.userId) return
      await dispatcher.dispatch(data)
    },
    async onEventBookingConfirmed(event: { data: unknown }) {
      const data = event.data as NotificationEvent
      if (!data?.userId) return
      await dispatcher.dispatch(data)
    },
    async onBookingStatusChanged(event: { data: unknown }) {
      const data = event.data as NotificationEvent
      if (!data?.userId) return
      await dispatcher.dispatch(data)
    },
  }
}
