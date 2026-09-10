function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
}

export interface Event {
  id: string
  name: string
  venue: string
  city: string
  startDate: string
  endDate: string | null
  eventType: string
  status: string
  posterUrl: string | null
  description?: string | null
  ticketCategories?: TicketCategory[]
}

export interface TicketCategory {
  id: string
  name: string
  description: string | null
  price: number
  quantity: number
  sold: number
  status: string
  available: number
}

export interface EventBooking {
  id: string
  ticketNumber: string
  qrCode: string | null
  event: Event
  ticketCategory: TicketCategory
  quantity: number
  totalAmount: number
  status: string
  createdAt: string
}

export interface EventSearchQuery {
  search?: string
  city?: string
  eventType?: string
  dateFrom?: string
  dateTo?: string
  q?: string
  page?: number
  perPage?: number
  limit?: number
  offset?: number
  orderBy?: string
  groupBy?: string[]
}

export interface CreateEventBookingBody {
  eventId: string
  ticketCategoryId: string
  quantity: number
}

export interface EventBookingParams {
  id: string
}

export async function fetchEvents(
  token?: string,
  params: EventSearchQuery = {}
): Promise<{ items: Event[]; total: number; page: number; totalPages: number }> {
  const url = new URL(`${apiBase()}/api/v1/events`)
  const searchParams = new URLSearchParams()
  if (params.search) searchParams.append("search", params.search)
  if (params.city) searchParams.append("city", params.city)
  if (params.eventType) searchParams.append("eventType", params.eventType)
  if (params.dateFrom) searchParams.append("dateFrom", params.dateFrom)
  if (params.dateTo) searchParams.append("dateTo", params.dateTo)
  if (params.q) searchParams.append("q", params.q)
  if (params.page) searchParams.append("page", String(params.page))
  if (params.perPage) searchParams.append("perPage", String(params.perPage))
  if (params.limit) searchParams.append("limit", String(params.limit))
  if (params.offset) searchParams.append("offset", String(params.offset))
  if (params.orderBy) searchParams.append("orderBy", params.orderBy)
  if (params.groupBy) searchParams.append("groupBy", JSON.stringify(params.groupBy))
  url.search = searchParams.toString()

  const res = await fetch(url, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchEvent(id: string, token?: string): Promise<Event> {
  const res = await fetch(`${apiBase()}/api/v1/events/${id}`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function createEventBooking(
  token: string,
  body: CreateEventBookingBody,
  idempotencyKey?: string
): Promise<EventBooking> {
  const res = await fetch(`${apiBase()}/api/v1/events/bookings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": idempotencyKey || crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchMyEventBookings(
  token: string,
  params?: { dateFrom?: string; dateTo?: string; q?: string; page?: number; perPage?: number }
): Promise<{ items: EventBooking[]; total: number; page: number; perPage: number; totalPages: number }> {
  const url = new URL(`${apiBase()}/api/v1/events/bookings/me`)
  const searchParams = new URLSearchParams()
  if (params?.dateFrom) searchParams.append("dateFrom", params.dateFrom)
  if (params?.dateTo) searchParams.append("dateTo", params.dateTo)
  if (params?.q) searchParams.append("q", params.q)
  if (params?.page) searchParams.append("page", String(params.page))
  if (params?.perPage) searchParams.append("perPage", String(params.perPage))
  url.search = searchParams.toString()

  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchEventBooking(id: string, token: string): Promise<EventBooking> {
  const res = await fetch(`${apiBase()}/api/v1/events/bookings/${id}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function cancelEventBooking(token: string, id: string): Promise<{ id: string; status: string }> {
  const res = await fetch(`${apiBase()}/api/v1/events/bookings/${id}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": crypto.randomUUID() },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function createEventBookingPayment(
  eventBookingId: string,
  token: string,
  provider?: string
): Promise<{ paymentUrl: string; authorizationUrl: string }> {
  const res = await fetch(`${apiBase()}/api/v1/events/bookings/${eventBookingId}/pay`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({ provider: provider ?? "notchpay" }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}