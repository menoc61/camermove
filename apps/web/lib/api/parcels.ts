function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
}

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

export async function fetchParcels(
  token: string,
  params: ParcelSearchQuery = {}
): Promise<{ items: Parcel[]; total: number; page: number; perPage: number; totalPages: number }> {
  const url = new URL(`${apiBase()}/api/v1/parcels`)
  const searchParams = new URLSearchParams()
  if (params.q) searchParams.append("q", params.q)
  if (params.status) searchParams.append("status", params.status)
  if (params.recipientCity) searchParams.append("recipientCity", params.recipientCity)
  if (params.dateFrom) searchParams.append("dateFrom", params.dateFrom)
  if (params.dateTo) searchParams.append("dateTo", params.dateTo)
  if (params.page) searchParams.append("page", String(params.page))
  if (params.perPage) searchParams.append("perPage", String(params.perPage))
  if (params.limit) searchParams.append("limit", String(params.limit))
  if (params.offset) searchParams.append("offset", String(params.offset))
  if (params.orderBy) searchParams.append("orderBy", params.orderBy)
  if (params.groupBy) searchParams.append("groupBy", JSON.stringify(params.groupBy))
  url.search = searchParams.toString()

  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function createParcel(
  token: string,
  body: CreateParcelBody,
  idempotencyKey?: string
): Promise<{ trackingNumber: string; id: string }> {
  const res = await fetch(`${apiBase()}/api/v1/parcels`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey || crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function trackParcel(
  trackingNumber: string
): Promise<TrackParcelResponse> {
  const res = await fetch(`${apiBase()}/api/v1/parcels/track/${trackingNumber}`, {
    method: "GET",
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchParcel(id: string, token: string): Promise<Parcel> {
  const res = await fetch(`${apiBase()}/api/v1/parcels/${id}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function cancelParcel(token: string, id: string): Promise<{ id: string; status: string }> {
  const res = await fetch(`${apiBase()}/api/v1/parcels/${id}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": crypto.randomUUID() },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function createParcelPayment(
  parcelId: string,
  token: string,
  provider?: string
): Promise<{ paymentUrl: string; authorizationUrl: string }> {
  const res = await fetch(`${apiBase()}/api/v1/parcels/${parcelId}/pay`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({ provider: provider ?? "notchpay" }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}