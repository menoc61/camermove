import { request, resourceClient } from "./resource"

const hotels = resourceClient<HotelItem>("/api/v1/hotels")

export interface HotelRoom {
  id: string
  hotelId: string
  name: string
  capacity: number
  bedType: string | null
  amenities: string[]
  photos: string[]
  pricePerNight: number
  quantity: number
  status: string
}

export interface HotelItem {
  id: string
  name: string
  city: string
  region: string | null
  starRating: number | null
  amenities: string[]
  photos: string[]
  status: string
  partnerStatus: string
  rooms: HotelRoom[]
  description: string | null
}

export interface HotelsParams {
  city?: string
  checkIn?: string
  checkOut?: string
  guests?: number
  minPrice?: number
  maxPrice?: number
  q?: string
  page?: number
  limit?: number
  perPage?: number
  orderBy?: string
}

export interface HotelsResponse {
  items: HotelItem[]
  total: number
  page: number
  perPage: number
  totalPages: number
  meta?: { cached: boolean }
}

export async function fetchHotels(params: HotelsParams): Promise<HotelsResponse> {
  return hotels.request<HotelsResponse>("/api/v1/hotels", {
    cache: "no-store",
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
  })
}

export async function fetchHotel(id: string): Promise<HotelItem> {
  return hotels.get<HotelItem>(`/${id}`, { cache: "no-store" })
}

export interface CreateHotelBookingBody {
  hotelId: string
  roomTypeId: string
  checkIn: string
  checkOut: string
  guests: number
  guestNames?: string[]
  specialRequests?: string
}

export function createHotelBooking(token: string, body: CreateHotelBookingBody) {
  return hotels.create<{ id: string; totalAmount: number; status: string }>("/bookings", body, { token })
}

export function fetchHotelBooking(token: string, id: string) {
  return hotels.get<{
    id: string
    status: string
    checkIn: string
    checkOut: string
    guests: number
    totalAmount: number
    hotel?: { id: string; name: string; city: string } | null
    roomType?: { id: string; name: string } | null
    payment?: { status: string } | null
  }>(`/bookings/${id}`, { token })
}

export interface MyHotelBookingsParams {
  page?: number
  perPage?: number
  q?: string
  dateFrom?: string
  dateTo?: string
}

export interface MyHotelBookingItem {
  id: string
  hotel: { name: string; city: string }
  roomType: { name: string; pricePerNight: number }
  checkInDate: string
  checkOutDate: string
  guestCount: number
  totalAmount: number
  status: string
}

export interface MyHotelBookingsResponse {
  items: MyHotelBookingItem[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export function fetchMyHotelBookings(token: string, params: MyHotelBookingsParams = {}): Promise<MyHotelBookingsResponse> {
  return hotels.request<MyHotelBookingsResponse>(`/api/v1/hotels/bookings/me`, { token, params })
}

export function cancelHotelBooking(token: string, id: string) {
  return hotels.request<{ id: string; status: string }>(`/api/v1/hotels/bookings/${id}/cancel`, { method: "POST", token })
}

export interface HotelPaymentOpts {
  provider: "notchpay" | "cinetpay"
  method?: string
  phone?: string
  email?: string
}

export interface HotelPaymentResult {
  payment: { id: string }
  authorizationUrl: string | null
  paymentUrl: string | null
}

export async function createHotelPayment(
  token: string,
  bookingId: string,
  opts: HotelPaymentOpts
): Promise<HotelPaymentResult> {
  const res = await hotels.request<{ payment: { id: string }; authorizationUrl: string | null; paymentUrl?: string | null }>(
    `/api/v1/hotels/bookings/${bookingId}/pay`,
    {
      method: "POST",
      token,
      body: { provider: opts.provider, method: opts.method, phone: opts.phone, email: opts.email },
    }
  )
  return { payment: res.payment, authorizationUrl: res.authorizationUrl, paymentUrl: res.paymentUrl ?? res.authorizationUrl }
}
