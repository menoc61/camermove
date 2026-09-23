import { resourceClient } from "./resource";

const rentals = resourceClient<RentalVehicle>("/api/v1/rentals");

export interface RentalVehicle {
  id: string;
  make: string;
  model: string;
  category: string;
  capacity: number;
  transmission: string | null;
  hasDriver: boolean;
  pricePerUnit: number;
  durationUnit: string;
  pickupCity: string;
  photos: string[];
  amenities: string[];
  status: string;
  partnerStatus: string;
  fuelType: string | null;
  year: number | null;
}

export interface RentalsParams {
  city?: string;
  pickupCity?: string;
  category?: string;
  hasDriver?: boolean;
  minPrice?: number;
  maxPrice?: number;
  q?: string;
  page?: number;
  perPage?: number;
  limit?: number;
}

export interface RentalsResponse {
  items: RentalVehicle[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  meta?: { cached: boolean };
}

export function fetchRentals(params: RentalsParams = {}): Promise<RentalsResponse> {
  return rentals.request<RentalsResponse>("/api/v1/rentals", {
    errorLabel: "rentals search failed",
    params: {
      pickupCity: params.pickupCity ?? params.city,
      category: params.category,
      hasDriver: params.hasDriver,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      q: params.q,
      page: params.page ?? 1,
      perPage: params.perPage ?? params.limit ?? 20,
    },
  });
}

export function fetchRental(id: string): Promise<RentalVehicle> {
  return rentals.get<RentalVehicle>(`/${id}`, { errorLabel: "rental not found" });
}

export interface CreateRentalBookingBody {
  rentalVehicleId: string;
  startDate: string;
  endDate: string;
  pickupCity: string;
  pickupAddress?: string;
  dropoffCity?: string;
  dropoffAddress?: string;
  driverName?: string;
  driverPhone?: string;
}

export function createRentalBooking(token: string, body: CreateRentalBookingBody) {
  return rentals.create<{ id: string; totalAmount: number; status: string }>("/bookings", body, { token });
}

export function fetchRentalBooking(token: string, id: string) {
  return rentals.get<{
    id: string;
    status: string;
    startDate: string;
    endDate: string;
    pickupCity: string;
    totalAmount: number;
    vehicle?: { id: string; make: string; model: string; category: string } | null;
    payment?: { status: string } | null;
  }>(`/bookings/${id}`, { token });
}

export interface MyRentalBookingsParams {
  page?: number;
  perPage?: number;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface MyRentalBookingItem {
  id: string;
  vehicle: { make: string; model: string; pickupCity: string };
  startDate: string;
  endDate: string;
  totalAmount: number;
  status: string;
  pickupCity: string;
  dropoffCity: string | null;
}

export interface MyRentalBookingsResponse {
  items: MyRentalBookingItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export function fetchMyRentalBookings(
  token: string,
  params: MyRentalBookingsParams = {},
): Promise<MyRentalBookingsResponse> {
  return rentals.request<MyRentalBookingsResponse>("/api/v1/rentals/bookings/me", {
    token,
    params: { ...params },
  });
}

export function cancelRentalBooking(token: string, id: string) {
  return rentals.request<{ id: string; status: string }>(`/api/v1/rentals/bookings/${id}/cancel`, {
    method: "POST",
    token,
  });
}

export interface RentalPaymentOpts {
  provider: "notchpay" | "cinetpay";
  method?: string;
  phone?: string;
  email?: string;
}

export interface RentalPaymentResult {
  payment: { id: string };
  authorizationUrl: string | null;
  paymentUrl: string | null;
}

export async function createRentalPayment(
  token: string,
  bookingId: string,
  opts: RentalPaymentOpts,
): Promise<RentalPaymentResult> {
  const res = await rentals.request<{
    payment: { id: string };
    authorizationUrl: string | null;
    paymentUrl?: string | null;
  }>(`/api/v1/rentals/bookings/${bookingId}/pay`, {
    method: "POST",
    token,
    body: { provider: opts.provider, method: opts.method, phone: opts.phone, email: opts.email },
  });
  return {
    payment: res.payment,
    authorizationUrl: res.authorizationUrl,
    paymentUrl: res.paymentUrl ?? res.authorizationUrl,
  };
}
