import { request } from "./resource"

export interface Place {
  displayName: string
  city?: string
  lat: number
  lon: number
  osmId: string
}

export async function fetchPlaces(q: string): Promise<Place[]> {
  if (!q || q.length < 2) return []
  const data = await request<{ places: Place[] }>("/api/v1/places/autocomplete", {
    cache: "no-store",
    errorLabel: "places failed",
    params: { q, countrycodes: "cm", limit: 5 },
  })
  return data.places
}
