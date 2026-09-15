import { resourceClient } from "./resource"

const admin = resourceClient<AdminStats>("/api/v1/admin")

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
  totalHotelBookings: number
  totalRentalBookings: number
  totalParcels: number
  totalInsurancePolicies: number
  totalEventBookings: number
  totalPartners: number
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

export function getAdminStats(token: string): Promise<AdminStats> {
  return admin.get<AdminStats>("/stats", { token })
}

export function listUsers(token: string, params: Record<string, string> = {}): Promise<PaginatedResponse<UserItem>> {
  return admin.list<UserItem>("/users", { token, params })
}

export function updateUser(token: string, id: string, data: Record<string, unknown>): Promise<UserItem> {
  return admin.update<UserItem>(`/users/${id}`, data, { token })
}

export async function deleteUser(token: string, id: string): Promise<void> {
  await admin.remove(`/users/${id}`, { token })
}

export function listTransporters(token: string, params: Record<string, string> = {}): Promise<PaginatedResponse<TransporterItem>> {
  return admin.list<TransporterItem>("/transporters", { token, params })
}

export function reviewPartnerApplication(token: string, id: string, data: { status: string; message?: string }): Promise<PartnerApplicationItem> {
  return admin.create<PartnerApplicationItem>(`/partner-applications/${id}/review`, data, { token })
}

export function listPartnerApplications(token: string, params: Record<string, string> = {}): Promise<PaginatedResponse<PartnerApplicationItem>> {
  return admin.list<PartnerApplicationItem>("/partner-applications", { token, params })
}

export function listTrips(token: string, params: Record<string, string> = {}): Promise<PaginatedResponse<TripItem>> {
  return admin.list<TripItem>("/trips", { token, params })
}

export function updateTrip(token: string, id: string, data: Record<string, unknown>): Promise<TripItem> {
  return admin.update<TripItem>(`/trips/${id}`, data, { token })
}

export function listBookings(token: string, params: Record<string, string> = {}): Promise<PaginatedResponse<BookingItem>> {
  return admin.list<BookingItem>("/bookings", { token, params })
}

export function listPayments(token: string, params: Record<string, string> = {}): Promise<PaginatedResponse<PaymentItem>> {
  return admin.list<PaymentItem>("/payments", { token, params })
}

export function listCommissions(token: string, params: Record<string, string> = {}): Promise<PaginatedResponse<CommissionItem> & { totals: { commission: number; net: number; paid: number; pending: number } }> {
  return admin.get(`/commissions`, { token, params })
}

export function markCommissionPaid(token: string, id: string): Promise<CommissionItem> {
  return admin.create<CommissionItem>(`/commissions/${id}/mark-paid`, undefined, { token })
}

export function listAuditLogs(token: string, params: Record<string, string> = {}): Promise<PaginatedResponse<AuditLogItem>> {
  return admin.list<AuditLogItem>("/audit-logs", { token, params })
}

export function getSettings(token: string): Promise<AppSettings> {
  return admin.get<AppSettings>("/settings", { token })
}

export function updateSettings(token: string, data: Record<string, unknown>): Promise<AppSettings> {
  return admin.update<AppSettings>("/settings", data, { token })
}
