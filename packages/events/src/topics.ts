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
} as const

export type EventTopic = (typeof EVENT_TOPICS)[keyof typeof EVENT_TOPICS]
