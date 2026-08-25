/**
 * /dashboard — RSC wrapper. Reads the JWT forwarded by middleware via the
 * `x-cm-user-token` request header, falls back to the cm_access cookie,
 * then fetches the dashboard data server-side. Renders the client view.
 *
 * Per AGENTS.md §1 statelessness: the token is consumed from the request
 * headers / cookies; no server session is created.
 */
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { Dashboard } from "../../components/dashboard/Dashboard"
import { SkeletonCard } from "../../components/dashboard/SkeletonCard"
import type { DashboardResponse } from "../../lib/api/dashboard"

async function loadDashboard(token: string): Promise<DashboardResponse> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
  const res = await fetch(`${base}/api/v1/me/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) {
    // Empty shape on error so the page still renders; client view shows retry.
    return { upcoming: [], history: [], tickets: [] }
  }
  return (await res.json()) as DashboardResponse
}

async function DashboardInner() {
  const h = await headers()
  const c = await cookies()
  const token = h.get("x-cm-user-token") ?? c.get("cm_access")?.value ?? null
  if (!token) {
    redirect("/login?next=/dashboard")
  }
  const data = await loadDashboard(token!)
  return <Dashboard initialData={data} token={token!} />
}

function DashboardFallback() {
  return (
    <div className="space-y-3">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold text-[#0e9f8f]">Mes voyages</h1>
      <Suspense fallback={<DashboardFallback />}>
        <DashboardInner />
      </Suspense>
    </main>
  )
}
