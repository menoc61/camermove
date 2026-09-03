export interface UrbanLine { origin: string; dest: string; price: number; transporterId: string; companyName: string; tripCountToday: number }
export interface UrbanTrip { id: string; origin: string; dest: string; departureAt: string; arrivalAt: string | null; price: number; seatsAvailable: number; totalSeats: number; line: string; vehicleTypeInfo: string | null; isUrban: boolean; validUntil: string }

export async function fetchUrbanLines(): Promise<UrbanLine[]> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
  const res = await fetch(`${base}/api/v1/intraurban/lines`, { cache: "no-store" })
  if (!res.ok) throw new Error("lines failed")
  return res.json()
}
export async function fetchUrbanSchedule(params: { origin?: string; dest?: string; date: string; pax?: number }): Promise<UrbanTrip[]> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
  const qs = new URLSearchParams({ date: params.date })
  if (params.origin) qs.set("origin", params.origin)
  if (params.dest) qs.set("dest", params.dest)
  if (params.pax) qs.set("pax", String(params.pax))
  const res = await fetch(`${base}/api/v1/intraurban/schedule?${qs.toString()}`, { cache: "no-store" })
  if (!res.ok) throw new Error("schedule failed")
  return res.json()
}
