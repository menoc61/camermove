import { request } from "./resource"

export interface Agency {
  id: string
  companyName: string
  city: string | null
  lat: number | null
  lon: number | null
  departurePointInfo: string | null
}

export async function fetchAgencies(city: string): Promise<Agency[]> {
  const data = await request<{ items?: Agency[]; agencies?: Agency[] }>("/api/v1/agencies", {
    cache: "no-store",
    params: { city },
  })
  return (data.items ?? data.agencies ?? []) as Agency[]
}
