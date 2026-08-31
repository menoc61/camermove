import { apiFetch } from "./client"

export interface AdminStats {
  totalUsers: number
  newUsersToday: number
  totalTransporters: number
  approvedTransporters: number
  pendingApplications: number
  totalTrips: number
  activeTrips: number
  totalBookings: number
  todayBookings: number
  confirmedToday: number
  pendingPayments: number
  totalRevenue: number
  totalCommissions: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  totalPages: number
}

export interface UserItem {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  role: string
  status: string
  createdAt: string
  _count: { bookings: number }
}

export interface TransporterItem {
  id: string
  companyName: string
  email: string
  city: string | null
  transportType: string | null
  status: string
  vehicleCount: number
  createdAt: string
  _count: { vehicles: number; routes: number; trips: number; staffUsers: number }
}

export interface PartnerApplicationItem {
  id: string
  companyName: string
  contactName: string
  phone: string
  email: string
  city: string | null
  transportType: string | null
  vehicleCount: number | null
  routesServed: string[]
  message: string | null
  status: string
  createdAt: string
  documents: { id: string; type: string; mimetype: string }[]
}

export interface TripItem {
  id: string
  departureAt: string
  price: number
  totalSeats: number
  status: string
  vehicleTypeInfo: string | null
  route: { originCity: string; destinationCity: string }
  transport: { id: string; companyName: string }
  seatAvailability: { seatsAvailable: number; seatsHeld: number; seatsBooked: number } | null
  _count: { bookings: number }
}

export interface BookingItem {
  id: string
  reference: string
  seatCount: number
  totalAmount: number
  status: string
  createdAt: string
  trip: {
    id: string
    departureAt: string
    route: { originCity: string; destinationCity: string }
    transport: { companyName: string }
  }
  user: { id: string; email: string; firstName: string | null; lastName: string | null }
  passengers: { id: string; fullName: string; phone: string | null }[]
  payments: { id: string; amount: number; status: string; provider: string }[]
}

export interface PaymentItem {
  id: string
  provider: string
  providerRef: string | null
  amount: number
  method: string | null
  currency: string
  status: string
  createdAt: string
  booking: {
    id: string
    reference: string
    totalAmount: number
    user: { email: string }
  }
}

export interface CommissionItem {
  id: string
  grossAmount: number
  commissionAmount: number
  netAmount: number
  percentApplied: string
  payoutStatus: string
  booking: {
    id: string
    createdAt: string
    trip: { departureAt: string; transport: { companyName: string } }
  }
}

export interface AuditLogItem {
  id: string
  actorId: string
  action: string
  entityType: string
  entityId: string
  metadata: Record<string, unknown> | null
  createdAt: string
  actor: { id: string; email: string; role: string }
}

export interface AppSettings {
  id: string
  commissionPercent: string
  holdExpiryMinutes: number
  cancellationPolicy: string
  smtpHost: string | null
  smtpPort: number | null
  smtpUser: string | null
  smtpFrom: string | null
  featureFlags: Record<string, boolean>
  maintenanceMode: boolean
  updatedAt: string
}

export async function getAdminStats(token: string): Promise<AdminStats> {
  return apiFetch<AdminStats>("/api/v1/admin/stats", { method: "GET", token })
}

export async function listUsers(token: string, params: Record<string, string> = {}): Promise<PaginatedResponse<UserItem>> {
  const qs = new URLSearchParams(params).toString()
  return apiFetch<PaginatedResponse<UserItem>>(`/api/v1/admin/users${qs ? `?${qs}` : ""}`, { method: "GET", token })
}

export async function updateUser(token: string, id: string, data: Record<string, unknown>): Promise<UserItem> {
  return apiFetch<UserItem>(`/api/v1/admin/users/${id}`, { method: "PUT", token, body: JSON.stringify(data), headers: { "Content-Type": "application/json" } })
}

export async function deleteUser(token: string, id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/admin/users/${id}`, { method: "DELETE", token })
}

export async function listTransporters(token: string, params: Record<string, string> = {}): Promise<PaginatedResponse<TransporterItem>> {
  const qs = new URLSearchParams(params).toString()
  return apiFetch<PaginatedResponse<TransporterItem>>(`/api/v1/admin/transporters${qs ? `?${qs}` : ""}`, { method: "GET", token })
}

export async function reviewPartnerApplication(token: string, id: string, data: { status: string; message?: string }): Promise<PartnerApplicationItem> {
  return apiFetch<PartnerApplicationItem>(`/api/v1/admin/partner-applications/${id}/review`, { method: "PUT", token, body: JSON.stringify(data), headers: { "Content-Type": "application/json" } })
}

export async function listPartnerApplications(token: string, params: Record<string, string> = {}): Promise<PaginatedResponse<PartnerApplicationItem>> {
  const qs = new URLSearchParams(params).toString()
  return apiFetch<PaginatedResponse<PartnerApplicationItem>>(`/api/v1/admin/partner-applications${qs ? `?${qs}` : ""}`, { method: "GET", token })
}

export async function listTrips(token: string, params: Record<string, string> = {}): Promise<PaginatedResponse<TripItem>> {
  const qs = new URLSearchParams(params).toString()
  return apiFetch<PaginatedResponse<TripItem>>(`/api/v1/admin/trips${qs ? `?${qs}` : ""}`, { method: "GET", token })
}

export async function updateTrip(token: string, id: string, data: Record<string, unknown>): Promise<TripItem> {
  return apiFetch<TripItem>(`/api/v1/admin/trips/${id}`, { method: "PUT", token, body: JSON.stringify(data), headers: { "Content-Type": "application/json" } })
}

export async function listBookings(token: string, params: Record<string, string> = {}): Promise<PaginatedResponse<BookingItem>> {
  const qs = new URLSearchParams(params).toString()
  return apiFetch<PaginatedResponse<BookingItem>>(`/api/v1/admin/bookings${qs ? `?${qs}` : ""}`, { method: "GET", token })
}

export async function listPayments(token: string, params: Record<string, string> = {}): Promise<PaginatedResponse<PaymentItem>> {
  const qs = new URLSearchParams(params).toString()
  return apiFetch<PaginatedResponse<PaymentItem>>(`/api/v1/admin/payments${qs ? `?${qs}` : ""}`, { method: "GET", token })
}

export async function listCommissions(token: string, params: Record<string, string> = {}): Promise<PaginatedResponse<CommissionItem> & { totals: { commission: number; net: number } }> {
  const qs = new URLSearchParams(params).toString()
  return apiFetch(`/api/v1/admin/commissions${qs ? `?${qs}` : ""}`, { method: "GET", token })
}

export async function markCommissionPaid(token: string, id: string): Promise<CommissionItem> {
  return apiFetch<CommissionItem>(`/api/v1/admin/commissions/${id}/mark-paid`, { method: "PUT", token })
}

export async function listAuditLogs(token: string, params: Record<string, string> = {}): Promise<PaginatedResponse<AuditLogItem>> {
  const qs = new URLSearchParams(params).toString()
  return apiFetch<PaginatedResponse<AuditLogItem>>(`/api/v1/admin/audit-logs${qs ? `?${qs}` : ""}`, { method: "GET", token })
}

export async function getSettings(token: string): Promise<AppSettings> {
  return apiFetch<AppSettings>("/api/v1/admin/settings", { method: "GET", token })
}

export async function updateSettings(token: string, data: Record<string, unknown>): Promise<AppSettings> {
  return apiFetch<AppSettings>("/api/v1/admin/settings", { method: "PUT", token, body: JSON.stringify(data), headers: { "Content-Type": "application/json" } })
}
