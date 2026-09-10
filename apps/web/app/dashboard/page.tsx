import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Dashboard } from "../../components/dashboard/Dashboard"
import { getDashboard } from "../../lib/api/dashboard"
import type { DashboardResponse } from "../../lib/api/dashboard"

async function DashboardInner() {
  const h = await headers()
  const c = await cookies()
  const token = h.get("x-cm-user-token") ?? c.get("cm_access")?.value ?? null
  if (!token) redirect("/login?next=/dashboard")

  let data: DashboardResponse
  try {
    data = await getDashboard(token)
  } catch {
    data = { upcoming: [], history: [], tickets: [] }
  }

  return <Dashboard initialData={data} token={token} />
}

function DashboardFallback() {
  return (
    <div className="flex flex-col gap-3 px-4 lg:px-6">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

export default function Page() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader title="Dashboard" />
        <Suspense fallback={<DashboardFallback />}>
          <DashboardInner />
        </Suspense>
      </SidebarInset>
    </SidebarProvider>
  )
}