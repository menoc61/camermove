import { request, resourceClient } from "./resource"

const transporter = resourceClient<TransporterStats>("/api/v1/transporter")

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

export function getTransporterStats(token: string): Promise<TransporterStats> {
  return transporter.get<TransporterStats>("/stats", { token })
}

export function getTransporterProfile(token: string): Promise<Record<string, unknown>> {
  return transporter.get("/profile", { token })
}

export function updateTransporterProfile(token: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  return transporter.update("/profile", data, { token })
}

export function listVehicles(token: string): Promise<Vehicle[]> {
  return transporter.get<Vehicle[]>("/vehicles", { token })
}

export function createVehicle(token: string, data: Record<string, unknown>): Promise<Vehicle> {
  return transporter.create<Vehicle>("/vehicles", data, { token })
}

export function updateVehicle(token: string, id: string, data: Record<string, unknown>): Promise<Vehicle> {
  return transporter.update<Vehicle>(`/vehicles/${id}`, data, { token })
}

export async function deleteVehicle(token: string, id: string): Promise<void> {
  await transporter.remove(`/vehicles/${id}`, { token })
}

export function listRoutes(token: string): Promise<Route[]> {
  return transporter.get<Route[]>("/routes", { token })
}

export function createRoute(token: string, data: Record<string, unknown>): Promise<Route> {
  return transporter.create<Route>("/routes", data, { token })
}

export function updateRoute(token: string, id: string, data: Record<string, unknown>): Promise<Route> {
  return transporter.update<Route>(`/routes/${id}`, data, { token })
}

export async function deleteRoute(token: string, id: string): Promise<void> {
  await transporter.remove(`/routes/${id}`, { token })
}

export function listTrips(token: string, params: Record<string, string> = {}): Promise<PaginatedResponse<Trip>> {
  return transporter.list<Trip>("/trips", { token, params })
}

export function createTrip(token: string, data: Record<string, unknown>): Promise<Trip> {
  return transporter.create<Trip>("/trips", data, { token })
}

export function updateTrip(token: string, id: string, data: Record<string, unknown>): Promise<Trip> {
  return transporter.update<Trip>(`/trips/${id}`, data, { token })
}

export async function deleteTrip(token: string, id: string): Promise<void> {
  await transporter.remove(`/trips/${id}`, { token })
}

export function listBookings(token: string, params: Record<string, string> = {}): Promise<PaginatedResponse<TransporterBooking>> {
  return transporter.list<TransporterBooking>("/bookings", { token, params })
}

export async function listPayments(token: string, params: Record<string, string> = {}): Promise<PaginatedResponse<{ id: string; amount: number; status: string; provider: string }>> {
  const r = await transporter.list<TransporterBooking>("/bookings", { token, params })
  return {
    ...r,
    items: r.items.flatMap((b) => b.payments.map((p) => ({ ...p, bookingId: b.id }))) as unknown as { id: string; amount: number; status: string; provider: string }[],
  }
}

// NOTE: there is no transporter-scoped commissions endpoint yet — this route is
// admin-only. Do not silently swallow the 403; surface it so the UI can tell the
// user the section is unavailable instead of showing a fake empty list.
export function listCommissions(token: string): Promise<PaginatedResponse<{ id: string; commissionAmount: number; netAmount: number; payoutStatus: string }>> {
  return request(`/api/v1/admin/commissions`, { method: "GET", token })
}

export function bulkCreateTrips(token: string, trips: Record<string, unknown>[]): Promise<{ count: number }> {
  return transporter.request<{ count: number }>("/api/v1/trips/bulk", { method: "POST", token, body: { trips } })
}
