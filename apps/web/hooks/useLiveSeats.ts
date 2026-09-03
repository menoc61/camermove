"use client"
import { useEffect, useState } from "react"

export function useLiveSeats(tripId: string | null, intervalMs = 10000) {
  const [seats, setSeats] = useState<{ seatsAvailable: number; totalSeats: number } | null>(null)

  useEffect(() => {
    if (!tripId) return
    let alive = true
    let timer: ReturnType<typeof setInterval> | null = null

    async function fetchSeats() {
      if (document.hidden) return
      try {
        const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
        const res = await fetch(`${base}/api/v1/trips/${tripId}`, { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as { seatAvailability?: { seatsAvailable: number }; totalSeats: number }
        if (!alive) return
        setSeats({ seatsAvailable: data.seatAvailability?.seatsAvailable ?? data.totalSeats, totalSeats: data.totalSeats })
      } catch {}
    }
    fetchSeats()
    timer = setInterval(fetchSeats, intervalMs)
    const onVis = () => { if (!document.hidden) fetchSeats() }
    document.addEventListener("visibilitychange", onVis)
    return () => {
      alive = false
      if (timer) clearInterval(timer)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [tripId, intervalMs])

  return seats
}
