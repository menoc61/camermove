export const EVENT_TOPICS = {
  bookingCreated: "camermove.booking.created",
  paymentCompleted: "camermove.payment.completed",
  paymentInitiated: "camermove.payment.initiated",
  paymentFailed: "camermove.payment.failed",
  paymentRefunded: "camermove.payment.refunded",
  paymentWebhookReceived: "camermove.payment.webhook.received",
  ticketIssued: "camermove.ticket.issued",
  seatHeldExpired: "camermove.seat.held.expired",
  notificationShouldSend: "camermove.notification.should-send",
  notificationsFailed: "camermove.notifications.failed",
  // Phase 4 typed notification event topics
  bookingConfirmed: "camermove.booking.confirmed",
  paymentConfirmed: "camermove.payment.confirmed",
  tripReminder24h: "camermove.trip.reminder.24h",
} as const

export type EventTopic = (typeof EVENT_TOPICS)[keyof typeof EVENT_TOPICS]
