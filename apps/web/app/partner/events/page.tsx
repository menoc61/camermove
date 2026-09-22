import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { EventsPartnerClient } from "@/components/partner/EventsPartnerClient"
import { VerifyTicketCard } from "@/components/partner/VerifyTicketCard"

export default async function PartnerEventsPage() {
  const h = await headers()
  const c = await cookies()
  const token = h.get("x-cm-user-token") ?? c.get("cm_access")?.value ?? null
  if (!token) redirect("/login?next=/partner/events")
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Partenaire — Événements</h1>
        <p className="text-sm text-muted-foreground">
          Vos événements organisés, leurs billets et leurs ventes (KPIs par événement).
        </p>
        <Link href="/partner" className="text-sm underline underline-offset-4">← Espace partenaire</Link>
      </div>
      <VerifyTicketCard token={token} />
      <EventsPartnerClient token={token} />
    </main>
  )
}
