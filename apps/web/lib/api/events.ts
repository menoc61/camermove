import { request } from "./resource"

export interface Event {
  id: string
  name: string
  venue: string
  city: string
  startDate: string
  endDate: string | null
  eventType: string
  status: string
  posterUrl: string | null
  description?: string | null
  ticketCategories?: TicketCategory[]
}

export interface TicketCategory {
  id: string
  name: string
  description: string | null
  price: number
  quantity: number
  sold: number
  status: string
  available: number
}

export interface EventBooking {
  id: string
  ticketNumber: string
  qrCode: string | null
  event: Event
  ticketCategory: TicketCategory
  quantity: number
  totalAmount: number
  status: string
  createdAt: string
}

export interface EventSearchQuery {
  search?: string
  city?: string
  eventType?: string
  dateFrom?: string
  dateTo?: string
  q?: string
  page?: number
  perPage?: number
  limit?: number
  offset?: number
  orderBy?: string
  groupBy?: string[]
}

export interface CreateEventBookingBody {
  eventId: string
  ticketCategoryId: string
  quantity: number
}

export interface EventBookingParams {
  id: string
}

export function fetchEvents(
  token?: string,
  params: EventSearchQuery = {}
): Promise<{ items: Event[]; total: number; page: number; totalPages: number }> {
  const { groupBy, ...rest } = params
  return request("/api/v1/events", {
    token,
    params: { ...rest, ...(groupBy ? { groupBy: JSON.stringify(groupBy) } : {}) },
  })
}

export function fetchEvent(id: string, token?: string): Promise<Event> {
  return request<Event>(`/api/v1/events/${id}`, { token })
}

export function createEventBooking(
  token: string,
  body: CreateEventBookingBody,
  idempotencyKey?: string
): Promise<EventBooking> {
  return request<EventBooking>("/api/v1/events/bookings", { method: "POST", token, body, idempotencyKey })
}

export function fetchMyEventBookings(
  token: string,
  params?: { dateFrom?: string; dateTo?: string; q?: string; page?: number; perPage?: number }
): Promise<{ items: EventBooking[]; total: number; page: number; perPage: number; totalPages: number }> {
  return request("/api/v1/events/bookings/me", { token, params })
}

export function fetchEventBooking(id: string, token: string): Promise<EventBooking> {
  return request<EventBooking>(`/api/v1/events/bookings/${id}`, { token })
}

export function cancelEventBooking(token: string, id: string): Promise<{ id: string; status: string }> {
  return request<{ id: string; status: string }>(`/api/v1/events/bookings/${id}/cancel`, { method: "POST", token })
}

export function createEventBookingPayment(
  eventBookingId: string,
  token: string,
  provider?: string
): Promise<{ paymentUrl: string; authorizationUrl: string }> {
  return request(`/api/v1/events/bookings/${eventBookingId}/pay`, {
    method: "POST",
    token,
    body: { provider: provider ?? "notchpay" },
  })
}

export interface TicketVerifyResult {
  kind: "event" | "trip"
  valid: boolean
  status: string
  label: string
  detail: string | null
  holder: string
  quantity: number
  category: string | null
}

export function verifyTicket(token: string, code: string): Promise<TicketVerifyResult> {
  return request<TicketVerifyResult>("/api/v1/tickets/verify", { method: "POST", token, body: { code } })
}
