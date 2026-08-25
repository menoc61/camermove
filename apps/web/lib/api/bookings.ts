function apiBase() { return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000" }

export type BookingResponse = { booking: { id: string; reference: string; holdExpiresAt: string; totalAmount: number; status: string }; totalAmount: number; holdExpiresAt: string }

export async function createBooking(input: { tripId: string; seatCount: number; passengers: Array<{ fullName: string; phone?: string }> }, token: string): Promise<BookingResponse> {
  const res = await fetch(`${apiBase()}/api/v1/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const text = await res.text()
    const err = new Error(text) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return res.json()
}
export async function getBooking(id: string, token: string) {
  const res = await fetch(`${apiBase()}/api/v1/bookings/${id}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function cancelBooking(id: string, token: string) {
  const res = await fetch(`${apiBase()}/api/v1/bookings/${id}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": crypto.randomUUID() } })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function bulkCancelBookings(ids: string[], token: string) {
  const res = await fetch(`${apiBase()}/api/v1/bookings/bulk/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<{ affected: number }>
}
