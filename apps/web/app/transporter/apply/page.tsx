/**
 * /transporter/apply — RSC wrapper. Reads the JWT forwarded by middleware via
 * the `x-cm-user-token` request header (fallback: cm_access cookie), then
 * renders the client wizard. Unauthenticated visitors are redirected to
 * /login?next=/transporter/apply (belt-and-braces alongside middleware).
 *
 * Per AGENTS.md §1 statelessness: the token is consumed from request
 * headers / cookies; no server session is created.
 */
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { ApplyWizard } from "../../../components/partner/ApplyWizard"

export default async function TransporterApplyPage() {
  const h = await headers()
  const c = await cookies()
  const token = h.get("x-cm-user-token") ?? c.get("cm_access")?.value ?? null
  if (!token) {
    redirect("/login?next=/transporter/apply")
  }
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Devenir partenaire transporteur</h1>
      <ApplyWizard token={token} />
    </main>
  )
}
