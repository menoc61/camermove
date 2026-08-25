/**
 * trip.reminder.24h — sent ~24h before departure, idempotent.
 * Reference + verificationCode only, no PII.
 */
import type { NotificationEventPayload } from "@camermove/shared"

type Ctx = { email: string | null; phone: string | null; firstName?: string }

export function renderTripReminder24h(data: NotificationEventPayload, user: Ctx) {
  const firstName = user.firstName ?? ""
  const ref = data.reference ?? ""
  const code = data.verificationCode ?? ""
  const route = data.origin && data.destination ? `${data.origin} → ${data.destination}` : ""
  const date = data.departureAt ?? ""
  return {
    email: user.email
      ? {
          to: user.email,
          subject: `Rappel — départ ${date} — CamerMove`,
          text: `Bonjour${firstName ? " " + firstName : ""},\n\nRappel: votre bus ${route} part le ${date}.\nRéférence: ${ref}\nCode: ${code}\n\nCamerMove`,
        }
      : undefined,
    whatsapp: user.phone
      ? {
          to: user.phone,
          body: `CamerMove: Rappel — ${ref} part ${date}. ${route}.`,
        }
      : undefined,
    push: {
      to: "topic",
      topic: "",
      title: "Rappel de départ",
      message: `${ref} — ${date}`,
    },
  }
}
