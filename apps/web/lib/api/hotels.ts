import { apiFetch } from "./client"

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
}

export interface HotelRoom {
  id: string
  hotelId: string
  name: string
  capacity: number
  bedType: string | null
  amenities: string[]
  photos: string[]
  pricePerNight: number
  quantity: number
  status: string
}

export interface HotelItem {
  id: string
  name: string
  city: string
  region: string | null
  starRating: number | null
  amenities: string[]
  photos: string[]
  status: string
  partnerStatus: string
  rooms: HotelRoom[]
  description: string | null
}

export interface HotelsParams {
  city?: string
  checkIn?: string
  checkOut?: string
  guests?: number
  minPrice?: number
  maxPrice?: number
  q?: string
  page?: number
  limit?: number
  perPage?: number
  orderBy?: string
}

export interface HotelsResponse {
  items: HotelItem[]
  total: number
  page: number
  perPage: number
  totalPages: number
  meta?: { cached: boolean }
}

export async function fetchHotels(params: HotelsParams): Promise<HotelsResponse> {
  const qs = new URLSearchParams()
  if (params.city) qs.set("city", params.city)
  if (params.checkIn) qs.set("checkIn", params.checkIn)
  if (params.checkOut) qs.set("checkOut", params.checkOut)
  if (params.guests != null) qs.set("guests", String(params.guests))
  if (params.minPrice != null) qs.set("minPrice", String(params.minPrice))
  if (params.maxPrice != null) qs.set("maxPrice", String(params.maxPrice))
  if (params.q) qs.set("q", params.q)
  qs.set("page", String(params.page ?? 1))
  qs.set("perPage", String(params.perPage ?? params.limit ?? 20))
  if (params.orderBy) qs.set("orderBy", params.orderBy)
  const res = await fetch(`${apiBase()}/api/v1/hotels?${qs.toString()}`, { cache: "no-store" })
  if (!res.ok) throw new Error("hotels search failed")
  return res.json()
}

export async function fetchHotel(id: string): Promise<HotelItem> {
  const res = await fetch(`${apiBase()}/api/v1/hotels/${id}`, { cache: "no-store" })
  if (!res.ok) throw new Error("hotel not found")
  return res.json()
}

export interface CreateHotelBookingBody {
  hotelId: string
  roomTypeId: string
  checkIn: string
  checkOut: string
  guests: number
  guestNames?: string[]
  specialRequests?: string
}

export function createHotelBooking(token: string, body: CreateHotelBookingBody) {
  const headers: Record<string, string> = { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }
  return apiFetch<{ id: string; totalAmount: number; status: string }>(`/api/v1/hotels/bookings`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    token,
  })
}

export function fetchHotelBooking(token: string, id: string) {
  return apiFetch<{
    id: string
    status: string
    checkIn: string
    checkOut: string
    guests: number
    totalAmount: number
    hotel?: { id: string; name: string; city: string } | null
    roomType?: { id: string; name: string } | null
    payment?: { status: string } | null
  }>(`/api/v1/hotels/bookings/${id}`, { method: "GET", token })
}

export interface MyHotelBookingsParams {
  page?: number
  perPage?: number
  q?: string
  dateFrom?: string
  dateTo?: string
}

// Loose response type — kept identical to the pre-pagination wrapper so other
// consumers (insurance page, partner client) that treat the result as an
// array keep compiling. The dashboard types its own items shape via
// apiFetch<{ items: HotelBookingItem[]; total; page; perPage; totalPages }>.
// At runtime the API always returns the paginated envelope.
export function fetchMyHotelBookings(token: string, params: MyHotelBookingsParams = {}): Promise<HotelsResponse | { items: unknown[] }> {
  const qs = new URLSearchParams()
  if (params.page) qs.set("page", String(params.page))
  if (params.perPage) qs.set("perPage", String(params.perPage))
  if (params.q) qs.set("q", params.q)
  if (params.dateFrom) qs.set("dateFrom", params.dateFrom)
  if (params.dateTo) qs.set("dateTo", params.dateTo)
  return apiFetch<HotelsResponse | { items: unknown[] }>(`/api/v1/hotels/bookings/me${qs.toString() ? `?${qs.toString()}` : ""}`, { method: "GET", token })
}

export function cancelHotelBooking(token: string, id: string) {
  return apiFetch<{ id: string; status: string }>(`/api/v1/hotels/bookings/${id}/cancel`, {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    token,
  })
}

export interface HotelPaymentOpts {
  provider: "notchpay" | "cinetpay"
  method?: string
  phone?: string
  email?: string
}

export interface HotelPaymentResult {
  payment: { id: string }
  authorizationUrl: string | null
  paymentUrl: string | null
}

export async function createHotelPayment(
  token: string,
  bookingId: string,
  opts: HotelPaymentOpts
): Promise<HotelPaymentResult> {
  const res = await apiFetch<{ payment: { id: string }; authorizationUrl: string | null; paymentUrl?: string | null }>(
    `/api/v1/hotels/bookings/${bookingId}/pay`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ provider: opts.provider, method: opts.method, phone: opts.phone, email: opts.email }),
      token,
    }
  )
  return { payment: res.payment, authorizationUrl: res.authorizationUrl, paymentUrl: res.paymentUrl ?? res.authorizationUrl }
}
