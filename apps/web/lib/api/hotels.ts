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

export function fetchMyHotelBookings(token: string) {
  return apiFetch<HotelsResponse | { items: unknown[] }>(`/api/v1/hotels/bookings/me`, { method: "GET", token })
}
