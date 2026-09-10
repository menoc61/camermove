import { cacheKey, getCached, setCached } from "../lib/cache"
import { findApprovedTransportersByCity } from "./repository"

export interface Agency {
  id: string
  companyName: string
  city: string | null
  lat: number | null
  lon: number | null
  departurePointInfo: string | null
}

const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  "yaoundé": { lat: 3.848, lon: 11.498 },
  "douala": { lat: 4.051, lon: 9.767 },
  "bafoussam": { lat: 5.476, lon: 10.418 },
  "bamenda": { lat: 5.963, lon: 10.159 },
  "garoua": { lat: 9.301, lon: 13.397 },
  "maroua": { lat: 10.591, lon: 14.315 },
  "bertoua": { lat: 4.577, lon: 13.684 },
  "ebolowa": { lat: 2.900, lon: 11.150 },
  "kribi": { lat: 2.933, lon: 9.983 },
  "limbe": { lat: 4.023, lon: 9.206 },
}

function cityFallback(city: string): { lat: number; lon: number } | null {
  return CITY_COORDS[city.toLowerCase()] ?? null
}

export async function listAgencies(query: { city: string }): Promise<{ items: Agency[]; total: number }> {
  const key = cacheKey("agencies", { city: query.city })
  const cached = await getCached<{ items: Agency[]; total: number }>(key)
  if (cached) return cached

  const rows = await findApprovedTransportersByCity(query.city)

  const fallback = cityFallback(query.city)

  const agencies: Agency[] = rows.map((r) => ({
    id: r.id,
    companyName: r.companyName,
    city: r.city,
    lat: fallback?.lat ?? null,
    lon: fallback?.lon ?? null,
    departurePointInfo: r.trips[0]?.departurePointInfo ?? null,
  }))

  const result = { items: agencies, total: agencies.length }
  await setCached(key, result, 300)
  return result
}
