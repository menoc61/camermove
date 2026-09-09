import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { ParcelsPartnerClient } from "@/components/partner/ParcelsPartnerClient"

export default async function PartnerParcelsPage() {
  const h = await headers()
  const c = await cookies()
  const token = h.get("x-cm-user-token") ?? c.get("cm_access")?.value ?? null
  if (!token) redirect("/login?next=/partner/parcels")
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">Partner — Colis</h1>
      <p className="text-sm text-muted-foreground">Gérez vos envois et états.</p>
      <ParcelsPartnerClient token={token} />
    </main>
  )
}
