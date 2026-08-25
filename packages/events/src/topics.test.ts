import { describe, it, expect } from "vitest"
import { EVENT_TOPICS } from "./topics"

describe("EVENT_TOPICS", () => {
  it("defines all required topics", () => {
    expect(EVENT_TOPICS.bookingCreated).toBe("camermove.booking.created")
    expect(EVENT_TOPICS.paymentCompleted).toBe("camermove.payment.completed")
    expect(EVENT_TOPICS.ticketIssued).toBe("camermove.ticket.issued")
    expect(EVENT_TOPICS.seatHeldExpired).toBe("camermove.seat.held.expired")
    expect(EVENT_TOPICS.notificationShouldSend).toBe("camermove.notification.should-send")
  })
})
