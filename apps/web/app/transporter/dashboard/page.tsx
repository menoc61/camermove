import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { TransporterDashboardClient } from "@/components/transporter/Dashboard"

export default async function DashboardPage() {
  const h = await headers()
  const c = await cookies()
  const token = h.get("x-cm-user-token") ?? c.get("cm_access")?.value ?? null
  if (!token) redirect("/login?next=/transporter/dashboard")
  return <TransporterDashboardClient token={token} />
}
