import { cacheKey, getCached, setCached } from "../lib/cache"

export interface Place {
  displayName: string
  city?: string
  lat: number
  lon: number
  osmId: string
}

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  address?: { city?: string; town?: string; village?: string }
}

export async function searchPlaces(query: {
  q: string
  countrycodes: string
  limit: number
}): Promise<{ places: Place[] }> {
  const key = cacheKey("places", { q: query.q, cc: query.countrycodes, l: query.limit })
  const cached = await getCached<{ places: Place[] }>(key)
  if (cached) return cached

  const params = new URLSearchParams({
    format: "json",
    q: query.q,
    countrycodes: query.countrycodes,
    limit: String(query.limit),
    addressdetails: "1",
    "accept-language": "fr",
  })

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": "CamerMove/1.0 (contact@camermove.cm)" },
  })

  if (!res.ok) {
    throw new Error(`Nominatim error: ${res.status}`)
  }

  const data = (await res.json()) as NominatimResult[]

  const places: Place[] = data.map((r) => ({
    displayName: r.display_name.split(",").slice(0, 2).join(",").trim(),
    city: r.address?.city ?? r.address?.town ?? r.address?.village,
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    osmId: String(r.place_id),
  }))

  const result = { places }
  await setCached(key, result, 86400)
  return result
}
