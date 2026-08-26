import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { Dashboard } from "../../components/dashboard/Dashboard"
import { Skeleton } from "@/components/ui/skeleton"
import type { DashboardResponse } from "../../lib/api/dashboard"

async function loadDashboard(token: string): Promise<DashboardResponse> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
  const res = await fetch(`${base}/api/v1/me/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return { upcoming: [], history: [], tickets: [] }
  return (await res.json()) as DashboardResponse
}

async function DashboardInner() {
  const h = await headers()
  const c = await cookies()
  const token = h.get("x-cm-user-token") ?? c.get("cm_access")?.value ?? null
  if (!token) redirect("/login?next=/dashboard")
  const data = await loadDashboard(token!)
  return <Dashboard initialData={data} token={token!} />
}

function DashboardFallback() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Mes voyages</h1>
      <Suspense fallback={<DashboardFallback />}>
        <DashboardInner />
      </Suspense>
    </main>
  )
}
