"use client"
import { useParams } from "next/navigation"
import { useBookingStore } from "@camermove/frontend"
import { PassengerForm } from "../../../components/booking/passenger-form"
import { Recap } from "../../../components/booking/recap"
import { useEffect, useState } from "react"

export default function BookPage() {
  const { tripId } = useParams() as { tripId: string }
  const { setBooking, seatCount } = useBookingStore()
  const [trip, setTrip] = useState<{ price: number } | null>(null)

  useEffect(() => { setBooking({ tripId }) }, [tripId, setBooking])
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}/api/v1/trips/${tripId}`)
      .then((r) => r.json())
      .then((data) => setTrip({ price: data.price }))
      .catch(() => {})
  }, [tripId])

  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-xl font-semibold">Réserver</h1>
      <div className="flex items-center gap-2">
        <span className="text-sm">Places:</span>
        <input type="number" min={1} max={10} value={seatCount} onChange={(e) => {
          const n = Number(e.target.value)
          setBooking({ seatCount: n, passengers: Array.from({ length: n }, (_, i) => ({ fullName: "" })) })
        }} className="w-20 rounded border px-3 py-2 text-sm" />
      </div>
      <PassengerForm />
      {trip && <Recap price={trip.price} />}
    </main>
  )
}
