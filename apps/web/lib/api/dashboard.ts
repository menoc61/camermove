/**
 * Dashboard API helpers — typed wrappers around GET /api/v1/me/dashboard.
 * Token comes from the zustand auth store; cookie sync in providers.tsx
 * mirrors it for middleware.
 */
import { apiFetch } from "./client"

export interface DashboardItem {
  id: string
  reference: string
  origin: string
  destination: string
  departureAt: string
  totalAmount: number
  status: string
  ticketId: string | null
}

export interface DashboardTicketItem {
  id: string
  verificationCode: string
  origin: string
  destination: string
  departureAt: string
  status: string
}

export interface DashboardResponse {
  upcoming: DashboardItem[]
  history: DashboardItem[]
  tickets: DashboardTicketItem[]
}

export function getDashboard(token: string): Promise<DashboardResponse> {
  return apiFetch<DashboardResponse>("/api/v1/me/dashboard", { method: "GET", token })
}
