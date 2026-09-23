import { request } from "./resource";

export type BookingResponse = { booking: { id: string; reference: string; holdExpiresAt: string; totalAmount: number; status: string }; totalAmount: number; holdExpiresAt: string };

export interface MyBookingItem {
  id: string;
  reference: string;
  origin: string;
  destination: string;
  departureAt: string;
  totalAmount: number;
  status: string;
  ticketId: string | null;
}

export interface MyBookingsResponse {
  items: MyBookingItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface MyTicketItem {
  id: string;
  verificationCode: string;
  origin: string;
  destination: string;
  departureAt: string;
  status: string;
}

export interface MyTicketsResponse {
  items: MyTicketItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface MyBookingsParams {
  page?: number;
  perPage?: number;
  scope?: "upcoming" | "history" | "all";
}

export interface MyTicketsParams {
  page?: number;
  perPage?: number;
}

export function fetchMyBookings(token: string, params: MyBookingsParams = {}): Promise<MyBookingsResponse> {
  return request<MyBookingsResponse>("/api/v1/me/bookings", {
    token,
    params: { page: params.page, perPage: params.perPage, scope: params.scope },
  });
}

export function fetchMyTickets(token: string, params: MyTicketsParams = {}): Promise<MyTicketsResponse> {
  return request<MyTicketsResponse>("/api/v1/tickets/me", {
    token,
    params: { page: params.page, perPage: params.perPage },
  });
}

export function createBooking(input: { tripId: string; seatCount: number; passengers: Array<{ fullName: string; phone?: string }> }, token: string): Promise<BookingResponse> {
  return request<BookingResponse>("/api/v1/bookings", { method: "POST", token, body: input });
}

export type TripPaymentResult = {
  payment: { id: string };
  authorizationUrl: string | null;
  paymentUrl: string | null;
};

export function createTripPayment(
  token: string,
  bookingId: string,
  opts: { provider: "notchpay" | "cinetpay"; method?: string; phone?: string; email?: string },
): Promise<TripPaymentResult> {
  return request<TripPaymentResult>("/api/v1/payments", {
    method: "POST",
    token,
    body: { bookingId, provider: opts.provider, method: opts.method, phone: opts.phone, email: opts.email },
  });
}

export function getBooking(id: string, token: string): Promise<unknown> {
  return request(`/api/v1/bookings/${id}`, { token });
}

export function cancelBooking(id: string, token: string): Promise<unknown> {
  return request(`/api/v1/bookings/${id}/cancel`, { method: "POST", token });
}

export function bulkCancelBookings(ids: string[], token: string): Promise<{ affected: number }> {
  return request<{ affected: number }>("/api/v1/bookings/bulk/cancel", { method: "POST", token, body: { ids } });
}
