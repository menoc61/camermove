/**
 * payment.failed / payment.expired — funds NOT received. Tells the user the
 * hold will lapse and how to retry, instead of leaving them in silence.
 */
import type { NotificationEventPayload } from "@camermove/shared"

type Ctx = { email: string | null; phone: string | null; firstName?: string }

export function renderPaymentFailed(data: NotificationEventPayload, user: Ctx) {
  const firstName = user.firstName ?? ""
  const ref = data.reference ?? data.bookingId ?? ""
  const expired = data.status === "expired"
  const subject = expired ? `Réservation expirée — CamerMove` : `Paiement échoué — CamerMove`
  const text =
    `Bonjour${firstName ? " " + firstName : ""},\n\n` +
    (expired
      ? `Votre réservation ${ref} a expiré avant la réception du paiement. Les places ont été libérées.\nRelancez une réservation quand vous êtes prêt à payer.`
      : `Nous n'avons pas pu confirmer votre paiement pour la réservation ${ref}.\nAucun montant n'a été débité. Réessayez depuis « Mes voyages ».`) +
    `\n\nCamerMove`
  return {
    email: user.email
      ? {
          to: user.email,
          subject,
          text,
        }
      : undefined,
    whatsapp: user.phone
      ? {
          to: user.phone,
          body: expired
            ? `CamerMove: réservation ${ref} expirée, places libérées.`
            : `CamerMove: paiement échoué pour ${ref}, aucun débit. Réessayez.`,
        }
      : undefined,
    push: {
      to: "topic",
      topic: "",
      title: expired ? "Réservation expirée" : "Paiement échoué",
      message: ref,
    },
  }
}
