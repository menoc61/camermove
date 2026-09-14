import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ParcelsPartnerClient } from "@/components/partner/ParcelsPartnerClient"

export default async function PartnerParcelsPage() {
  const h = await headers()
  const c = await cookies()
  const token = h.get("x-cm-user-token") ?? c.get("cm_access")?.value ?? null
  if (!token) redirect("/login?next=/partner/parcels")
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Partenaire — Colis</h1>
        <p className="text-sm text-muted-foreground">
          Colis enregistrés auprès de vos opérateurs. Un opérateur que vous ne détenez pas n&apos;apparaît pas ici.
        </p>
        <Link href="/partner" className="text-sm underline underline-offset-4">← Espace partenaire</Link>
      </div>
      <ParcelsPartnerClient token={token} />
    </main>
  )
}
