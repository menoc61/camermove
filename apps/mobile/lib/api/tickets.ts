import { request } from "./resource";

export interface TicketDetailResponse {
  id: string;
  reference: string;
  verificationCode: string;
  qrDataUrl: string;
  status: string;
  trip: {
    origin: string;
    destination: string;
    departureAt: string;
    arrivalAt: string | null;
    vehiclePlate: string | null;
    seatCount: number;
    vehicleTypeInfo: string | null;
  };
  passengers: Array<{ firstName: string; lastName: string; seatNumber: string }>;
  agency: {
    companyName: string;
    brandColor: string;
    accentIcon: string;
    phone: string | null;
    tagline: string | null;
  };
  boardingStop: { name: string; offsetMinutes: number } | null;
  dropOffStop: { name: string; offsetMinutes: number } | null;
  seatLabels: string[];
  ratingContext: {
    tripId: string;
    transporterId: string;
    bookingId: string;
  };
}

export function getTicketDetail(token: string, id: string): Promise<TicketDetailResponse> {
  return request<TicketDetailResponse>(`/api/v1/me/tickets/${id}`, { token });
}

export function verifyTicket(token: string, code: string): Promise<unknown> {
  return request("/api/v1/tickets/verify", { method: "POST", token, body: { code } });
}

export function lookupTicket(ref: string): Promise<unknown> {
  return request("/api/v1/tickets/lookup", { params: { ref } });
}
