export interface Agency {
  id: string
  companyName: string
  city: string | null
  lat: number | null
  lon: number | null
  departurePointInfo: string | null
}

export async function fetchAgencies(city: string): Promise<Agency[]> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
  const res = await fetch(
    `${base}/api/v1/agencies?city=${encodeURIComponent(city)}`,
    { cache: "no-store" }
  )
  if (!res.ok) throw new Error("agencies failed")
  const data = await res.json()
  return data.agencies
}
