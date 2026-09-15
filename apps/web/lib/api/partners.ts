import { request, resourceClient } from "./resource"

const partner = resourceClient<PartnerServicesResponse>("/api/v1/partner")

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
  return request<PartnerServicesResponse>("/api/v1/me/partner-services", { token })
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
  return partner.get<{ items: PartnerParcelItem[]; total: number; page: number; perPage: number; totalPages: number; operators: Array<{ id: string; companyName: string; status: string; partnerStatus: string }> }>(
    "/parcels",
    { token, params: { page } },
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
  return partner.get<{ items: PartnerEventItem[]; total: number; page: number; perPage: number; totalPages: number }>(
    "/events",
    { token, params: { page } },
  )
}
