export interface Place {
  displayName: string
  city?: string
  lat: number
  lon: number
  osmId: string
}

export async function fetchPlaces(q: string): Promise<Place[]> {
  if (!q || q.length < 2) return []
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
  const res = await fetch(
    `${base}/api/v1/places/autocomplete?q=${encodeURIComponent(q)}&countrycodes=cm&limit=5`,
    { cache: "no-store" }
  )
  if (!res.ok) throw new Error("places failed")
  const data = await res.json()
  return data.places
}
