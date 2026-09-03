import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { RoutesClient } from "@/components/transporter/Routes"

export default async function RoutesPage() {
  const h = await headers()
  const c = await cookies()
  const token = h.get("x-cm-user-token") ?? c.get("cm_access")?.value ?? null
  if (!token) redirect("/login?next=/transporter/routes")
  return <RoutesClient token={token} />
}
