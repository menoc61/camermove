import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { HotelsPartnerClient } from "@/components/partner/HotelsPartnerClient"

export default async function PartnerHotelsPage() {
  const h = await headers()
  const c = await cookies()
  const token = h.get("x-cm-user-token") ?? c.get("cm_access")?.value ?? null
  if (!token) redirect("/login?next=/partner/hotels")
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">Partner — Hôtels</h1>
      <p className="text-sm text-muted-foreground">Gérez vos hôtels, chambres, disponibilités et photos presigned.</p>
      <HotelsPartnerClient token={token} />
    </main>
  )
}
