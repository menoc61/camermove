import { request } from "./resource"

export interface SearchResultItem {
  id: string
  departureAt: string
  price: number
  totalSeats: number
  seatsAvailable: number
  transporterId: string
  companyName: string
  vehicleTypeInfo: string | null
}
export interface SearchParams {
  origin: string
  destination: string
  date: string
  pax: number
  sortBy?: "price_asc" | "price_desc" | "departure_asc"
  minPrice?: number
  maxPrice?: number
  page?: number
  perPage?: number
  vehicleType?: string
}
export function fetchSearch(params: SearchParams): Promise<{ items: SearchResultItem[]; total: number; page: number; perPage: number; totalPages: number; meta?: Record<string, unknown> }> {
  return request("/api/v1/search", {
    cache: "no-store",
    errorLabel: "search failed",
    params: {
      origin: params.origin,
      destination: params.destination,
      date: params.date,
      pax: params.pax,
      sortBy: params.sortBy ?? "price_asc",
      page: params.page ?? 1,
      perPage: params.perPage ?? 20,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      vehicleType: params.vehicleType,
    },
  })
}
