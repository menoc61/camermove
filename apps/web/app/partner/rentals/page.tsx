import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { RentalsPartnerClient } from "@/components/partner/RentalsPartnerClient"

export default async function PartnerRentalsPage() {
  const h = await headers()
  const c = await cookies()
  const token = h.get("x-cm-user-token") ?? c.get("cm_access")?.value ?? null
  if (!token) redirect("/login?next=/partner/rentals")
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">Partner — Véhicules</h1>
      <p className="text-sm text-muted-foreground">Gérez vos véhicules, photos presigned et disponibilité.</p>
      <RentalsPartnerClient token={token} />
    </main>
  )
}
