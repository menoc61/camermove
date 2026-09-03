import { apiFetch } from "./client"

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
}

export interface RentalVehicle {
  id: string
  make: string
  model: string
  category: string
  capacity: number
  transmission: string | null
  hasDriver: boolean
  pricePerUnit: number
  durationUnit: string
  pickupCity: string
  photos: string[]
  amenities: string[]
  status: string
  partnerStatus: string
  fuelType: string | null
  year: number | null
}

export interface RentalsParams {
  city?: string
  pickupCity?: string
  category?: string
  hasDriver?: boolean
  minPrice?: number
  maxPrice?: number
  q?: string
  page?: number
  perPage?: number
  limit?: number
  startDate?: string
  endDate?: string
}

export interface RentalsResponse {
  items: RentalVehicle[]
  total: number
  page: number
  perPage: number
  totalPages: number
  meta?: { cached: boolean }
}

export async function fetchRentals(params: RentalsParams): Promise<RentalsResponse> {
  const qs = new URLSearchParams()
  if (params.pickupCity) qs.set("pickupCity", params.pickupCity)
  else if (params.city) qs.set("pickupCity", params.city)
  if (params.category) qs.set("category", params.category)
  if (params.hasDriver != null) qs.set("hasDriver", String(params.hasDriver))
  if (params.minPrice != null) qs.set("minPrice", String(params.minPrice))
  if (params.maxPrice != null) qs.set("maxPrice", String(params.maxPrice))
  if (params.q) qs.set("q", params.q)
  qs.set("page", String(params.page ?? 1))
  qs.set("perPage", String(params.perPage ?? params.limit ?? 20))
  const res = await fetch(`${apiBase()}/api/v1/rentals?${qs.toString()}`, { cache: "no-store" })
  if (!res.ok) throw new Error("rentals search failed")
  return res.json()
}

export async function fetchRental(id: string): Promise<RentalVehicle> {
  const res = await fetch(`${apiBase()}/api/v1/rentals/${id}`, { cache: "no-store" })
  if (!res.ok) throw new Error("rental not found")
  return res.json()
}

export interface CreateRentalBookingBody {
  rentalVehicleId: string
  startDate: string
  endDate: string
  pickupCity: string
  pickupAddress?: string
  dropoffCity?: string
  dropoffAddress?: string
  driverName?: string
  driverPhone?: string
}

export function createRentalBooking(token: string, body: CreateRentalBookingBody) {
  const headers: Record<string, string> = { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }
  return apiFetch<{ id: string; totalAmount: number; status: string }>(`/api/v1/rentals/bookings`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    token,
  })
}

export function fetchMyRentalBookings(token: string) {
  return apiFetch<{ items: unknown[] }>(`/api/v1/rentals/bookings/me`, { method: "GET", token })
}
