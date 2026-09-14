/**
 * Partner services API — typed wrapper around GET /api/v1/me/partner-services.
 * Tells the /partner hub which services the authenticated user actually
 * partners on (ownership-derived) plus per-service KPIs, so the UI only ever
 * shows dashboards for services the user is a partner on.
 */
import { apiFetch } from "./client"

export type PartnerServiceId = "transporter" | "hotels" | "rentals" | "parcels" | "events"

export interface PartnerServiceKpis {
  entities: number
  bookings?: number
  revenue?: number
  activeTrips?: number
  parcelsInTransit?: number
  parcelsDelivered?: number
}

export interface PartnerService {
  service: PartnerServiceId
  label: string
  href: string
  kpis: PartnerServiceKpis
}

export interface PartnerApplicationView {
  id: string
  status: string
  companyName: string
  createdAt: string
}

export interface PartnerServicesResponse {
  services: PartnerService[]
  application: PartnerApplicationView | null
}

export function getPartnerServices(token: string): Promise<PartnerServicesResponse> {
  return apiFetch<PartnerServicesResponse>("/api/v1/me/partner-services", { method: "GET", token })
}

/** Operator-scoped parcel list for the parcels partner page. */
export interface PartnerParcelItem {
  id: string
  trackingNumber: string
  senderName: string
  senderCity: string
  recipientName: string
  recipientCity: string
  parcelType: string
  weightKg: number | null
  shippingCost: number
  status: string
  currentLocation: string | null
  createdAt: string
}

export function getPartnerParcels(token: string, page = 1) {
  return apiFetch<{ items: PartnerParcelItem[]; total: number; page: number; perPage: number; totalPages: number; operators: Array<{ id: string; companyName: string; status: string; partnerStatus: string }> }>(
    `/api/v1/partner/parcels?page=${page}`,
    { method: "GET", token },
  )
}

/** Organizer-scoped event list for the events partner page. */
export interface PartnerEventItem {
  id: string
  name: string
  city: string
  venue: string
  eventType: string
  startDate: string
  endDate: string | null
  status: string
  partnerStatus: string
  kpis: { bookings: number; revenue: number }
  ticketCategories: Array<{ id: string; name: string; price: number; quantity: number; sold: number }>
}

export function getPartnerEvents(token: string, page = 1) {
  return apiFetch<{ items: PartnerEventItem[]; total: number; page: number; perPage: number; totalPages: number }>(
    `/api/v1/partner/events?page=${page}`,
    { method: "GET", token },
  )
}
