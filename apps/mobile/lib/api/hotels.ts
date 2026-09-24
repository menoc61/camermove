import { request, resourceClient } from "./resource";

// 1:1 port of apps/web/lib/api/hotels.ts — Next-only `cache` option dropped.
// All writes send Idempotency-Key automatically via resource.ts.

export interface HotelRoom {
  id: string;
  hotelId: string;
  name: string;
  capacity: number;
  bedType: string | null;
  amenities: string[];
  photos: string[];
  pricePerNight: number;
  quantity: number;
  status: string;
}

export interface HotelItem {
  id: string;
  name: string;
  city: string;
  region: string | null;
  starRating: number | null;
  amenities: string[];
  photos: string[];
  status: string;
  partnerStatus: string;
  rooms: HotelRoom[];
  description: string | null;
}

export interface HotelsParams {
  city?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  minPrice?: number;
  maxPrice?: number;
  q?: string;
  page?: number;
  limit?: number;
  perPage?: number;
  orderBy?: string;
}

export interface HotelsResponse {
  items: HotelItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  meta?: { cached: boolean };
}

const hotels = resourceClient<HotelItem>("/api/v1/hotels");

export function fetchHotels(params: HotelsParams): Promise<HotelsResponse> {
  return request<HotelsResponse>("/api/v1/hotels", {
    params: {
      city: params.city,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      guests: params.guests,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      q: params.q,
      page: params.page ?? 1,
      perPage: params.perPage ?? params.limit ?? 20,
      orderBy: params.orderBy,
    },
  });
}

export function fetchHotel(id: string): Promise<HotelItem> {
  return hotels.get<HotelItem>(`/${encodeURIComponent(id)}`);
}

export interface CreateHotelBookingBody {
  hotelId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  guestNames?: string[];
  specialRequests?: string;
}

export interface HotelBookingResult {
  id: string;
  totalAmount: number;
  status: string;
}

export function createHotelBooking(
  token: string,
  body: CreateHotelBookingBody,
): Promise<HotelBookingResult> {
  return hotels.create<HotelBookingResult>("/bookings", body, { token });
}

export interface HotelBookingDetail {
  id: string;
  status: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalAmount: number;
  hotel?: { id: string; name: string; city: string } | null;
  roomType?: { id: string; name: string } | null;
  payment?: { status: string } | null;
}

export function getHotelBooking(token: string, id: string): Promise<HotelBookingDetail> {
  return hotels.get<HotelBookingDetail>(`/bookings/${encodeURIComponent(id)}`, { token });
}

export function cancelHotelBooking(token: string, id: string): Promise<{ id: string; status: string }> {
  return hotels.request<{ id: string; status: string }>(
    `/api/v1/hotels/bookings/${encodeURIComponent(id)}/cancel`,
    { method: "POST", token },
  );
}
