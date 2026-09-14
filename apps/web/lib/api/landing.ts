function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
}

export interface LandingAgency {
  id: string
  companyName: string
  city: string | null
  lat: number | null
  lon: number | null
  departurePointInfo: string | null
}

export interface LandingStats {
  minPrice: number | null
  nextDepartureAt: string | null
  hotelsCount: number
  rentalsCount: number
  agencies: LandingAgency[]
}

export type LandingRailType = "transport" | "hotels" | "rentals" | "events" | "insurance"

export interface TransportRailItem {
  id: string
  departureAt: string
  price: number
  vehicleTypeInfo: string | null
  seatsAvailable: number
  origin: string
  destination: string
  companyName: string
}

export interface HotelRailItem {
  id: string
  name: string
  city: string
  starRating: number | null
  image: string
  fromPrice: number | null
}

export interface RentalRailItem {
  id: string
  title: string
  top: string
  bottom: string
  image: string
}

export interface EventRailItem {
  id: string
  name: string
  city: string
  startDate: string
  posterUrl: string | null
  minPrice: number | null
}

export type LandingRailPayload =
  | { type: "transport"; items: TransportRailItem[] }
  | { type: "hotels"; items: HotelRailItem[] }
  | { type: "rentals"; items: RentalRailItem[] }
  | { type: "events"; items: EventRailItem[] }
  | { type: "insurance"; pricing: Record<string, number> }

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, { next: { revalidate: 60 } })
  if (!res.ok) throw new Error(`landing fetch failed: ${path}`)
  return res.json() as Promise<T>
}

export async function fetchLandingStats(): Promise<LandingStats> {
  return getJson<LandingStats>("/api/v1/landing/stats")
}

export async function fetchLandingRail<T extends LandingRailType>(
  type: T,
): Promise<LandingRailPayload & { type: T }> {
  return getJson<LandingRailPayload & { type: T }>(
    `/api/v1/landing/rails?type=${encodeURIComponent(type)}`,
  )
}
