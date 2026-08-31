import { apiFetch } from "./client"

export interface Vehicle {
  id: string
  type: string
  capacity: number
  plateNumber: string | null
  status: string
  createdAt: string
}

export interface Route {
  id: string
  originCity: string
  destinationCity: string
  active: boolean
  createdAt: string
  _count: { trips: number }
}

export interface Trip {
  id: string
  departureAt: string
  arrivalEstimateAt: string | null
  price: number
  totalSeats: number
  status: string
  vehicleTypeInfo: string | null
  conditions: string | null
  cancellationPolicy: string | null
  route: Route
  vehicle: Vehicle | null
  seatAvailability: { seatsAvailable: number; seatsHeld: number; seatsBooked: number } | null
  _count: { bookings: number }
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  totalPages: number
}

export interface TransporterBooking {
  id: string
  reference: string
  seatCount: number
  totalAmount: number
  status: string
  createdAt: string
  trip: Trip
  user: { id: string; email: string; firstName: string | null; lastName: string | null; phone: string | null }
  passengers: { id: string; fullName: string; phone: string | null }[]
  payments: { id: string; amount: number; status: string; provider: string }[]
  tickets: { id: string; verificationCode: string; status: string }[]
}

export interface TransporterStats {
  activeTrips: number
  upcomingTrips: number
  totalBookings: number
  todayBookings: number
  totalRevenue: number
}

export async function getTransporterStats(token: string): Promise<TransporterStats> {
  return apiFetch<TransporterStats>("/api/v1/transporter/stats", { method: "GET", token })
}

export async function getTransporterProfile(token: string): Promise<Record<string, unknown>> {
  return apiFetch("/api/v1/transporter/profile", { method: "GET", token })
}

export async function updateTransporterProfile(token: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  return apiFetch("/api/v1/transporter/profile", { method: "PUT", token, body: JSON.stringify(data), headers: { "Content-Type": "application/json" } })
}

export async function listVehicles(token: string): Promise<Vehicle[]> {
  return apiFetch<Vehicle[]>("/api/v1/transporter/vehicles", { method: "GET", token })
}

export async function createVehicle(token: string, data: Record<string, unknown>): Promise<Vehicle> {
  return apiFetch<Vehicle>("/api/v1/transporter/vehicles", { method: "POST", token, body: JSON.stringify(data), headers: { "Content-Type": "application/json" } })
}

export async function updateVehicle(token: string, id: string, data: Record<string, unknown>): Promise<Vehicle> {
  return apiFetch<Vehicle>(`/api/v1/transporter/vehicles/${id}`, { method: "PUT", token, body: JSON.stringify(data), headers: { "Content-Type": "application/json" } })
}

export async function deleteVehicle(token: string, id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/transporter/vehicles/${id}`, { method: "DELETE", token })
}

export async function listRoutes(token: string): Promise<Route[]> {
  return apiFetch<Route[]>("/api/v1/transporter/routes", { method: "GET", token })
}

export async function createRoute(token: string, data: Record<string, unknown>): Promise<Route> {
  return apiFetch<Route>("/api/v1/transporter/routes", { method: "POST", token, body: JSON.stringify(data), headers: { "Content-Type": "application/json" } })
}

export async function updateRoute(token: string, id: string, data: Record<string, unknown>): Promise<Route> {
  return apiFetch<Route>(`/api/v1/transporter/routes/${id}`, { method: "PUT", token, body: JSON.stringify(data), headers: { "Content-Type": "application/json" } })
}

export async function deleteRoute(token: string, id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/transporter/routes/${id}`, { method: "DELETE", token })
}

export async function listTrips(token: string, params: Record<string, string> = {}): Promise<PaginatedResponse<Trip>> {
  const qs = new URLSearchParams(params).toString()
  return apiFetch<PaginatedResponse<Trip>>(`/api/v1/transporter/trips${qs ? `?${qs}` : ""}`, { method: "GET", token })
}

export async function createTrip(token: string, data: Record<string, unknown>): Promise<Trip> {
  return apiFetch<Trip>("/api/v1/transporter/trips", { method: "POST", token, body: JSON.stringify(data), headers: { "Content-Type": "application/json" } })
}

export async function updateTrip(token: string, id: string, data: Record<string, unknown>): Promise<Trip> {
  return apiFetch<Trip>(`/api/v1/transporter/trips/${id}`, { method: "PUT", token, body: JSON.stringify(data), headers: { "Content-Type": "application/json" } })
}

export async function deleteTrip(token: string, id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/transporter/trips/${id}`, { method: "DELETE", token })
}

export async function listBookings(token: string, params: Record<string, string> = {}): Promise<PaginatedResponse<TransporterBooking>> {
  const qs = new URLSearchParams(params).toString()
  return apiFetch<PaginatedResponse<TransporterBooking>>(`/api/v1/transporter/bookings${qs ? `?${qs}` : ""}`, { method: "GET", token })
}
