/**
 * /tickets/[id] — RSC wrapper. Auth-gated by middleware. Fetches the
 * ticket detail server-side via /api/v1/me/tickets/:id. On 404 (or missing
 * token), redirects to /dashboard.
 */
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { ApiError } from "../../../lib/api/client"
import { getTicket } from "../../../lib/api/tickets"
import { TicketDetail } from "../../../components/tickets/TicketDetail"
import { SkeletonCard } from "../../../components/dashboard/SkeletonCard"

async function TicketInner({ id }: { id: string }) {
  const h = await headers()
  const c = await cookies()
  const token = h.get("x-cm-user-token") ?? c.get("cm_access")?.value ?? null
  if (!token) {
    redirect(`/login?next=/tickets/${id}`)
  }
  try {
    const data = await getTicket(id, token!)
    return (
      <main className="mx-auto max-w-md p-4">
        <TicketDetail data={data} />
      </main>
    )
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      redirect("/dashboard")
    }
    return (
      <main className="mx-auto max-w-md p-4">
        <h1 className="mb-4 text-xl font-semibold text-slate-900">Billet</h1>
        <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
          Erreur de chargement. <a className="underline" href="/dashboard">Retour au tableau de bord</a>
        </div>
      </main>
    )
  }
}

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense fallback={
      <main className="mx-auto max-w-md p-4">
        <SkeletonCard />
      </main>
    }>
      <TicketInner id={id} />
    </Suspense>
  )
}
