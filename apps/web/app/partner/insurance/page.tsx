import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { InsurancePartnerClient } from "@/components/partner/InsurancePartnerClient"

export default async function PartnerInsurancePage() {
  const h = await headers()
  const c = await cookies()
  const token = h.get("x-cm-user-token") ?? c.get("cm_access")?.value ?? null
  if (!token) redirect("/login?next=/partner/insurance")
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">Partner — Assurance</h1>
      <p className="text-sm text-muted-foreground">Gérez vos polices d&#39;assurance voyage.</p>
      <InsurancePartnerClient token={token} />
    </main>
  )
}
