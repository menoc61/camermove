import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { TripsClient } from "@/components/transporter/Trips"

export default async function TripsPage() {
  const h = await headers()
  const c = await cookies()
  const token = h.get("x-cm-user-token") ?? c.get("cm_access")?.value ?? null
  if (!token) redirect("/login?next=/transporter/trips")
  return <TripsClient token={token} />
}
