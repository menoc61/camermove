/**
 * booking.status.changed — generic status change (e.g. user cancellation) for
 * the 5 non-transport services (hotels, rentals, events, insurance, parcels).
 * French copy, branded HTML for email, single-SMS WhatsApp, ntfy push limits.
 */
import type { NotificationEventPayload } from "@camermove/shared"

type Ctx = { email: string | null; phone: string | null; firstName?: string }

export function renderBookingStatusChanged(data: NotificationEventPayload, user: Ctx) {
  const firstName = user.firstName ?? ""
  const service = data.serviceLabel ?? "Réservation"
  const entity = data.entityLabel ? ` (${data.entityLabel})` : ""
  const ref = data.reference ?? data.trackingNumber ?? data.policyNumber ?? data.ticketNumber ?? ""
  const status = data.newStatus ?? data.status ?? ""
  return {
    email: user.email
      ? {
          to: user.email,
          subject: `${service}${entity} — ${status} — CamerMove`,
          text: `Bonjour${firstName ? " " + firstName : ""},\n\nVotre ${service.toLowerCase()}${entity}${ref ? ` (${ref})` : ""} est maintenant au statut: ${status}.\n\nRetrouvez le détail depuis votre espace CamerMove.\n\nCamerMove`,
        }
      : undefined,
    whatsapp: user.phone
      ? {
          to: user.phone,
          body: `CamerMove: ${service}${entity}${ref ? ` ${ref}` : ""} — ${status}.`,
        }
      : undefined,
    push: {
      to: "topic",
      topic: "",
      title: `${service} ${status}`,
      message: `${ref}${entity}`,
    },
  }
}
