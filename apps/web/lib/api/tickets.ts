/**
 * Ticket API helpers — typed wrapper around GET /api/v1/me/tickets/:id.
 * Response shape mirrors the server-side TicketDetailResponse from
 * apps/api/src/routes/me/tickets.ts. Defined locally to avoid pulling
 * the API workspace types into the web bundle.
 */
import { apiFetch } from "./client"

export interface TicketDetailResponse {
  id: string
  reference: string
  verificationCode: string
  qrDataUrl: string
  status: string
  trip: {
    origin: string
    destination: string
    departureAt: string
    arrivalAt: string | null
    vehiclePlate: string | null
    seatCount: number
  }
  passengers: Array<{ firstName: string; lastName: string; seatNumber: number }>
}

export function getTicket(id: string, token: string): Promise<TicketDetailResponse> {
  return apiFetch<TicketDetailResponse>(`/api/v1/me/tickets/${id}`, { method: "GET", token })
}
