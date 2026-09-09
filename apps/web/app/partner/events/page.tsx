import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { EventsPartnerClient } from "@/components/partner/EventsPartnerClient"

export default async function PartnerEventsPage() {
  const h = await headers()
  const c = await cookies()
  const token = h.get("x-cm-user-token") ?? c.get("cm_access")?.value ?? null
  if (!token) redirect("/login?next=/partner/events")
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">Partner — Événements</h1>
      <p className="text-sm text-muted-foreground">Gérez vos événements, billets, et ventes.</p>
      <EventsPartnerClient token={token} />
    </main>
  )
}
