/**
 * hotel.booking.confirmed — hotel payment cleared, room hold is now confirmed.
 * French copy, branded HTML for email, single-SMS WhatsApp, ntfy push limits.
 */
import type { NotificationEventPayload } from "@camermove/shared"

type Ctx = { email: string | null; phone: string | null; firstName?: string }

export function renderHotelBookingConfirmed(data: NotificationEventPayload, user: Ctx) {
  const firstName = user.firstName ?? ""
  const ref = data.reference ?? ""
  const hotel = data.hotelName ?? ""
  const room = data.roomName ?? ""
  const dates = data.checkInDate && data.checkOutDate ? `du ${data.checkInDate} au ${data.checkOutDate}` : ""
  return {
    email: user.email
      ? {
          to: user.email,
          subject: `Réservation hôtel ${ref} confirmée — CamerMove`,
          text: `Bonjour${firstName ? " " + firstName : ""},\n\nVotre réservation hôtel ${ref}${hotel ? ` à ${hotel}` : ""}${room ? ` (${room})` : ""} ${dates} est confirmée.\n\nPrésentez cette confirmation à la réception lors de votre arrivée.\n\nCamerMove`,
        }
      : undefined,
    whatsapp: user.phone
      ? {
          to: user.phone,
          body: `CamerMove: Réservation hôtel ${ref} confirmée. ${hotel} ${dates}.`,
        }
      : undefined,
    push: {
      to: "topic",
      topic: "",
      title: "Réservation hôtel confirmée",
      message: `${ref} — ${hotel}`,
    },
  }
}
