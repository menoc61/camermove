/**
 * insurance.policy.issued — insurance premium received, policy is now active.
 * French copy, branded HTML for email, single-SMS WhatsApp, ntfy push limits.
 */
import type { NotificationEventPayload } from "@camermove/shared"

type Ctx = { email: string | null; phone: string | null; firstName?: string }

export function renderInsurancePolicyIssued(data: NotificationEventPayload, user: Ctx) {
  const firstName = user.firstName ?? ""
  const policy = data.policyNumber ?? data.reference ?? ""
  const coverage = data.coverageType ?? ""
  const dates = data.startDate && data.endDate ? `du ${data.startDate} au ${data.endDate}` : ""
  return {
    email: user.email
      ? {
          to: user.email,
          subject: `Police d'assurance ${policy} active — CamerMove`,
          text: `Bonjour${firstName ? " " + firstName : ""},\n\nVotre police d'assurance ${policy} (couverture ${coverage}) ${dates} est active.\n\nConservez ce numéro de police pour toute réclamation.\n\nCamerMove`,
        }
      : undefined,
    whatsapp: user.phone
      ? {
          to: user.phone,
          body: `CamerMove: Assurance ${policy} active. Couverture ${coverage} ${dates}.`,
        }
      : undefined,
    push: {
      to: "topic",
      topic: "",
      title: "Assurance active",
      message: `${policy} — ${coverage}`,
    },
  }
}
