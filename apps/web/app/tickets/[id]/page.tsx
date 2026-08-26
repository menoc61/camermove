/**
 * /tickets/[id] — RSC page for the authenticated ticket holder.
 * Reads the JWT forwarded by middleware via `x-cm-user-token` header,
 * falls back to `cm_access` cookie, fetches server-side, and renders
 * the full TicketDetail view.
 *
 * Per UI-SPEC: QR at 240×240 centered, passenger list, trip info.
 * Per AGENTS.md §1: stateless, no server session, token from request.
 */
import { cookies, headers } from "next/headers"
import { notFound } from "next/navigation"
import { TicketDetail } from "../../../components/tickets/TicketDetail"
import type { TicketDetailResponse } from "../../../lib/api/tickets"

async function loadTicket(token: string, id: string): Promise<TicketDetailResponse | null> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
  try {
    const res = await fetch(`${base}/api/v1/me/tickets/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (res.status === 404) return null
    if (!res.ok) return null
    return (await res.json()) as TicketDetailResponse
  } catch {
    return null
  }
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const h = await headers()
  const c = await cookies()
  const token = h.get("x-cm-user-token") ?? c.get("cm_access")?.value ?? null

  // Guard missing id (should never happen for a valid route)
  if (!id) {
    const { redirect } = await import("next/navigation")
    redirect("/login")
  }

  if (!token) {
    // Middleware already gates this, but defend-in-depth.
    const { redirect } = await import("next/navigation")
    redirect("/login?next=/tickets/" + id)
  }

  // token/navigation redirect is in the closure; assert id (guarded above)
  const ticket = await loadTicket(token!, id!)

  if (!ticket) {
    notFound()
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <TicketDetail data={ticket} />
    </main>
  )
}
