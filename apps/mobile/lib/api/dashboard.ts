import { request } from "./resource";

export interface DashboardItem {
  id: string;
  reference: string;
  origin: string;
  destination: string;
  departureAt: string;
  totalAmount: number;
  status: string;
  ticketId: string | null;
}

export interface DashboardTicketItem {
  id: string;
  verificationCode: string;
  origin: string;
  destination: string;
  departureAt: string;
  status: string;
}

export interface DashboardTotals {
  trips: number;
  hotels: number;
  rentals: number;
  parcels: number;
  insurance: number;
  events: number;
}

export interface DashboardResponse {
  upcoming: DashboardItem[];
  history: DashboardItem[];
  tickets: DashboardTicketItem[];
  totals?: DashboardTotals;
}

export function getDashboard(token: string): Promise<DashboardResponse> {
  return request<DashboardResponse>("/api/v1/me/dashboard", { method: "GET", token });
}
