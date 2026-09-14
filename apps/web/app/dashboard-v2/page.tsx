import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { DashboardShell } from "@/components/dashboard-v2/layout/DashboardShell"
import { DashboardV2 } from "@/components/dashboard-v2/DashboardV2"
import { getDashboard } from "@/lib/api/dashboard"
import { ApiError } from "@/lib/api/client"
import type { DashboardResponse } from "@/lib/api/dashboard"

async function DashboardV2Inner() {
  const h = await headers()
  const c = await cookies()
  const token = h.get("x-cm-user-token") ?? c.get("cm_access")?.value ?? null
  if (!token) redirect("/login?next=/dashboard-v2")

  let data: DashboardResponse
  try {
    data = await getDashboard(token)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login?next=/dashboard-v2")
    }
    data = { upcoming: [], history: [], tickets: [] }
  }

  return <DashboardV2 initialData={data} token={token} />
}

function DashboardV2Fallback() {
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
      <Suspense fallback={<DashboardV2Fallback />}>
        <DashboardV2Inner />
      </Suspense>
    </DashboardShell>
  )
}
