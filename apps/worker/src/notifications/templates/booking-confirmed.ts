/**
 * booking.confirmed — payment cleared, booking is now confirmed, ticket coming.
 * French copy, branded HTML for email, single-SMS WhatsApp, ntfy push limits.
 */
import type { NotificationEventPayload } from "@camermove/shared"

type Ctx = { email: string | null; phone: string | null; firstName?: string }

export function renderBookingConfirmed(data: NotificationEventPayload, user: Ctx) {
  const firstName = user.firstName ?? ""
  const ref = data.reference ?? ""
  const route = data.origin && data.destination ? `${data.origin} → ${data.destination}` : ""
  const date = data.departureAt ?? ""
  const seats = data.seatCount ? `${data.seatCount} place(s)` : ""
  return {
    email: user.email
      ? {
          to: user.email,
          subject: `Réservation ${ref} confirmée — CamerMove`,
          text: `Bonjour${firstName ? " " + firstName : ""},\n\nVotre réservation ${ref} pour ${route} le ${date} est confirmée.\n${seats} retenue(s).\n\nVotre e-billet avec QR code arrive dans quelques instants.\n\nCamerMove`,
        }
      : undefined,
    whatsapp: user.phone
      ? {
          to: user.phone,
          body: `CamerMove: Réservation ${ref} confirmée. ${route} ${date}. Billet envoyé par email.`,
        }
      : undefined,
    push: {
      to: "topic",
      topic: "",
      title: "Réservation confirmée",
      message: `${ref} — ${route}`,
    },
  }
}
