/**
 * payment.confirmed — funds received. Complements booking.confirmed when
 * the user has multiple bookings, or for the rare payment-only flow.
 */
import type { NotificationEventPayload } from "@camermove/shared"

type Ctx = { email: string | null; phone: string | null; firstName?: string }

export function renderPaymentConfirmed(data: NotificationEventPayload, user: Ctx) {
  const firstName = user.firstName ?? ""
  const ref = data.reference ?? ""
  const amount = data.amount ? `${data.amount.toLocaleString("fr-FR")} XAF` : ""
  return {
    email: user.email
      ? {
          to: user.email,
          subject: `Paiement reçu — CamerMove`,
          text: `Bonjour${firstName ? " " + firstName : ""},\n\nNous avons reçu votre paiement de ${amount} pour la réservation ${ref}. Votre e-billet arrive dans quelques instants.\n\nCamerMove`,
        }
      : undefined,
    whatsapp: user.phone
      ? {
          to: user.phone,
          body: `CamerMove: Paiement ${amount} reçu pour ${ref}.`,
        }
      : undefined,
    push: {
      to: "topic",
      topic: "",
      title: "Paiement reçu",
      message: `${ref} — ${amount}`,
    },
  }
}
