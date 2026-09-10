function apiBase() { return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000" }

export type BookingResponse = { booking: { id: string; reference: string; holdExpiresAt: string; totalAmount: number; status: string }; totalAmount: number; holdExpiresAt: string }

export interface MyBookingItem {
  id: string
  reference: string
  origin: string
  destination: string
  departureAt: string
  totalAmount: number
  status: string
  ticketId: string | null
}

export interface MyBookingsResponse {
  items: MyBookingItem[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export interface MyTicketItem {
  id: string
  verificationCode: string
  origin: string
  destination: string
  departureAt: string
  status: string
}

export interface MyTicketsResponse {
  items: MyTicketItem[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export interface MyBookingsParams {
  page?: number
  perPage?: number
  scope?: "upcoming" | "history" | "all"
}

export interface MyTicketsParams {
  page?: number
  perPage?: number
}

export async function fetchMyBookings(token: string, params: MyBookingsParams = {}): Promise<MyBookingsResponse> {
  const qs = new URLSearchParams()
  if (params.page) qs.set("page", String(params.page))
  if (params.perPage) qs.set("perPage", String(params.perPage))
  if (params.scope) qs.set("scope", params.scope)
  const res = await fetch(`${apiBase()}/api/v1/me/bookings${qs.toString() ? `?${qs.toString()}` : ""}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    const err = new Error(text) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return res.json()
}

export async function fetchMyTickets(token: string, params: MyTicketsParams = {}): Promise<MyTicketsResponse> {
  const qs = new URLSearchParams()
  if (params.page) qs.set("page", String(params.page))
  if (params.perPage) qs.set("perPage", String(params.perPage))
  const res = await fetch(`${apiBase()}/api/v1/tickets/me${qs.toString() ? `?${qs.toString()}` : ""}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    const err = new Error(text) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return res.json()
}

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
export type TripPaymentResult = {
  payment: { id: string }
  authorizationUrl: string | null
  paymentUrl: string | null
}
export async function createTripPayment(
  token: string,
  bookingId: string,
  opts: { provider: "notchpay" | "cinetpay"; method?: string; phone?: string; email?: string }
): Promise<TripPaymentResult> {
  const res = await fetch(`${apiBase()}/api/v1/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ bookingId, provider: opts.provider, method: opts.method, phone: opts.phone, email: opts.email }),
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
