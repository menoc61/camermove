export async function createBooking(input: { tripId: string; seatCount: number; passengers: Array<{ fullName: string; phone?: string }> }, token: string) {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
  const res = await fetch(`${base}/api/v1/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function getBooking(id: string, token: string) {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
  const res = await fetch(`${base}/api/v1/bookings/${id}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
