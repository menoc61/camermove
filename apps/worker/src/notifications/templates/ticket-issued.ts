/**
 * ticket.issued — e-ticket ready, contains verificationCode + trip info.
 * No raw PII in subject/title (only firstName may appear in body).
 */
import type { NotificationEventPayload } from "@camermove/shared"

type Ctx = { email: string | null; phone: string | null; firstName?: string }

export function renderTicketIssued(data: NotificationEventPayload, user: Ctx) {
  const firstName = user.firstName ?? ""
  const ref = data.reference ?? ""
  const code = data.verificationCode ?? ""
  const route = data.origin && data.destination ? `${data.origin} → ${data.destination}` : ""
  const date = data.departureAt ?? ""
  return {
    email: user.email
      ? {
          to: user.email,
          subject: `Votre e-billet CamerMove — ${ref}`,
          text: `Bonjour${firstName ? " " + firstName : ""},\n\nVotre e-billet est prêt.\n\nRéférence: ${ref}\nCode de vérification: ${code}\nTrajet: ${route}\nDépart: ${date}\n\nPrésentez le QR code ci-joint ou le code de vérification au contrôleur.\n\nCamerMove`,
        }
      : undefined,
    whatsapp: user.phone
      ? {
          to: user.phone,
          body: `CamerMove: Billet ${ref} prêt. Code: ${code}. ${route} ${date}.`,
        }
      : undefined,
    push: {
      to: "topic",
      topic: "",
      title: "E-billet prêt",
      message: `${ref} — code ${code}`,
    },
  }
}
