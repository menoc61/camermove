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
}
export async function fetchSearch(params: SearchParams): Promise<{ items: SearchResultItem[]; pagination: { page: number; perPage: number; total: number; totalPages: number } }> {
  const qs = new URLSearchParams({ origin: params.origin, destination: params.destination, date: params.date, pax: String(params.pax), sortBy: params.sortBy ?? "price_asc", page: String(params.page ?? 1), perPage: String(params.perPage ?? 20) })
  if (params.minPrice != null) qs.set("minPrice", String(params.minPrice))
  if (params.maxPrice != null) qs.set("maxPrice", String(params.maxPrice))
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
  const res = await fetch(`${base}/api/v1/search?${qs.toString()}`, { cache: "no-store" })
  if (!res.ok) throw new Error("search failed")
  return res.json()
}
