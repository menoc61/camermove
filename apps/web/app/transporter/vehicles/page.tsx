import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { VehiclesClient } from "@/components/transporter/Vehicles"

export default async function VehiclesPage() {
  const h = await headers()
  const c = await cookies()
  const token = h.get("x-cm-user-token") ?? c.get("cm_access")?.value ?? null
  if (!token) redirect("/login?next=/transporter/vehicles")
  return <VehiclesClient token={token} />
}
