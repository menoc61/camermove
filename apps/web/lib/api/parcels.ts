import { request } from "./resource"

export interface Parcel {
  id: string
  trackingNumber: string
  senderName: string
  senderPhone: string
  senderCity: string
  recipientName: string
  recipientPhone: string
  recipientCity: string
  parcelType: string
  weightKg: number | null
  dimensionsCm: string | null
  description: string | null
  shippingCost: number
  status: string
  currentLocation: string | null
  statusHistory: Array<{ status: string; location: string; note: string; createdAt: string }>
  createdAt: string
}

export interface ParcelSearchQuery {
  q?: string
  status?: string
  recipientCity?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  perPage?: number
  limit?: number
  offset?: number
  orderBy?: keyof Parcel
  groupBy?: string[]
}

export interface CreateParcelBody {
  senderName: string
  senderPhone: string
  recipientName: string
  recipientPhone: string
  senderCity: string
  recipientCity: string
  parcelType: string
  weightKg?: number
  dimensionsCm?: string
  description?: string
  declaredValue?: number
}

export interface TrackParcelResponse {
  id: string
  trackingNumber: string
  senderName: string
  senderPhoneMasked: string
  recipientName: string
  recipientPhoneMasked: string
  senderCity: string
  recipientCity: string
  parcelType: string
  weightKg: number | null
  dimensionsCm: string | null
  description: string | null
  shippingCost: number
  status: string
  currentLocation: string | null
  statusHistory: Array<{ status: string; location: string; note: string; createdAt: string }>
}

export function fetchParcels(
  token: string,
  params: ParcelSearchQuery = {}
): Promise<{ items: Parcel[]; total: number; page: number; perPage: number; totalPages: number }> {
  const { groupBy, ...rest } = params
  return request("/api/v1/parcels", {
    token,
    params: { ...rest, ...(groupBy ? { groupBy: JSON.stringify(groupBy) } : {}) },
  })
}

export function createParcel(
  token: string,
  body: CreateParcelBody,
  idempotencyKey?: string
): Promise<{ trackingNumber: string; id: string }> {
  return request<{ trackingNumber: string; id: string }>("/api/v1/parcels", { method: "POST", token, body, idempotencyKey })
}

export function trackParcel(trackingNumber: string): Promise<TrackParcelResponse> {
  return request<TrackParcelResponse>(`/api/v1/parcels/track/${trackingNumber}`)
}

export function fetchParcel(id: string, token: string): Promise<Parcel> {
  return request<Parcel>(`/api/v1/parcels/${id}`, { token })
}

export function cancelParcel(token: string, id: string): Promise<{ id: string; status: string }> {
  return request<{ id: string; status: string }>(`/api/v1/parcels/${id}/cancel`, { method: "POST", token })
}

export function createParcelPayment(
  parcelId: string,
  token: string,
  provider?: string
): Promise<{ paymentUrl: string; authorizationUrl: string }> {
  return request(`/api/v1/parcels/${parcelId}/pay`, {
    method: "POST",
    token,
    body: { provider: provider ?? "notchpay" },
  })
}
