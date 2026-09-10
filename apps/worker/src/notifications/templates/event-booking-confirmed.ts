/**
 * event.booking.confirmed — event ticket payment cleared, tickets are now confirmed.
 * French copy, branded HTML for email, single-SMS WhatsApp, ntfy push limits.
 */
import type { NotificationEventPayload } from "@camermove/shared"

type Ctx = { email: string | null; phone: string | null; firstName?: string }

export function renderEventBookingConfirmed(data: NotificationEventPayload, user: Ctx) {
  const firstName = user.firstName ?? ""
  const ticket = data.ticketNumber ?? data.reference ?? ""
  const eventName = data.eventName ?? ""
  const venue = data.venue ? ` à ${data.venue}` : ""
  const date = data.startDate ?? data.departureAt ?? ""
  const qty = data.quantity ? `${data.quantity} billet(s)` : ""
  return {
    email: user.email
      ? {
          to: user.email,
          subject: `Billets ${ticket} confirmés — CamerMove`,
          text: `Bonjour${firstName ? " " + firstName : ""},\n\nVos billets pour ${eventName}${venue} le ${date} sont confirmés.\n${qty}.\nNuméro de billet: ${ticket}.\n\nPrésentez le QR code à l'entrée.\n\nCamerMove`,
        }
      : undefined,
    whatsapp: user.phone
      ? {
          to: user.phone,
          body: `CamerMove: Billets ${ticket} confirmés. ${eventName}${venue} ${date}.`,
        }
      : undefined,
    push: {
      to: "topic",
      topic: "",
      title: "Billets confirmés",
      message: `${ticket} — ${eventName}`,
    },
  }
}
