/**
 * parcel.status.changed — parcel moved to a new tracking status.
 * French copy, branded HTML for email, single-SMS WhatsApp, ntfy push limits.
 */
import type { NotificationEventPayload } from "@camermove/shared"

type Ctx = { email: string | null; phone: string | null; firstName?: string }

export function renderParcelStatusChanged(data: NotificationEventPayload, user: Ctx) {
  const firstName = user.firstName ?? ""
  const tracking = data.trackingNumber ?? data.reference ?? ""
  const status = data.status ?? ""
  const location = data.location ? ` à ${data.location}` : ""
  return {
    email: user.email
      ? {
          to: user.email,
          subject: `Colis ${tracking} — ${status} — CamerMove`,
          text: `Bonjour${firstName ? " " + firstName : ""},\n\nVotre colis ${tracking} est maintenant au statut: ${status}${location}.\n\nSuivez votre colis depuis votre espace CamerMove.\n\nCamerMove`,
        }
      : undefined,
    whatsapp: user.phone
      ? {
          to: user.phone,
          body: `CamerMove: Colis ${tracking} — ${status}${location}.`,
        }
      : undefined,
    push: {
      to: "topic",
      topic: "",
      title: "Colis mis à jour",
      message: `${tracking} — ${status}`,
    },
  }
}
