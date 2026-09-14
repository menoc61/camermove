import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { DashboardShell } from "@/components/dashboard-v2/layout/DashboardShell"
import { DashboardV2 } from "@/components/dashboard-v2/DashboardV2"
import { getDashboard } from "@/lib/api/dashboard"
import { ApiError } from "@/lib/api/client"
import type { DashboardResponse } from "@/lib/api/dashboard"

/**
 * The single client dashboard — v1 and v2 merged here (the old
 * components/dashboard implementation was removed as duplicate).
 */
async function DashboardInner() {
  const h = await headers()
  const c = await cookies()
  const token = h.get("x-cm-user-token") ?? c.get("cm_access")?.value ?? null
  if (!token) redirect("/login?next=/dashboard")

  let data: DashboardResponse
  try {
    data = await getDashboard(token)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login?next=/dashboard")
    }
    data = { upcoming: [], history: [], tickets: [] } as DashboardResponse
  }

  return <DashboardV2 initialData={data} token={token} />
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

export default function Page() {
  return (
    <DashboardShell title="Tableau de bord">
      <Suspense fallback={<DashboardFallback />}>
        <DashboardInner />
      </Suspense>
    </DashboardShell>
  )
}
