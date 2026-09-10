/**
 * rental.booking.confirmed — vehicle rental payment cleared, booking is now confirmed.
 * French copy, branded HTML for email, single-SMS WhatsApp, ntfy push limits.
 */
import type { NotificationEventPayload } from "@camermove/shared"

type Ctx = { email: string | null; phone: string | null; firstName?: string }

export function renderRentalBookingConfirmed(data: NotificationEventPayload, user: Ctx) {
  const firstName = user.firstName ?? ""
  const ref = data.reference ?? ""
  const route = data.pickupCity && data.dropoffCity ? `${data.pickupCity} → ${data.dropoffCity}` : (data.pickupCity ?? "")
  const dates = data.startDate && data.endDate ? `du ${data.startDate} au ${data.endDate}` : ""
  return {
    email: user.email
      ? {
          to: user.email,
          subject: `Location ${ref} confirmée — CamerMove`,
          text: `Bonjour${firstName ? " " + firstName : ""},\n\nVotre réservation de location ${ref} ${dates} est confirmée.\nRetrait: ${route}.\n\nPrésentez cette confirmation lors du retrait du véhicule.\n\nCamerMove`,
        }
      : undefined,
    whatsapp: user.phone
      ? {
          to: user.phone,
          body: `CamerMove: Location ${ref} confirmée. ${route} ${dates}.`,
        }
      : undefined,
    push: {
      to: "topic",
      topic: "",
      title: "Location confirmée",
      message: `${ref} — ${route}`,
    },
  }
}
