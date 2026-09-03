import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { BookingsClient } from "@/components/transporter/Bookings"

export default async function BookingsPage() {
  const h = await headers()
  const c = await cookies()
  const token = h.get("x-cm-user-token") ?? c.get("cm_access")?.value ?? null
  if (!token) redirect("/login?next=/transporter/bookings")
  return <BookingsClient token={token} />
}
