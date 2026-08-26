"use client"
import { useParams } from "next/navigation"
import { useBookingStore } from "@camermove/frontend"
import { PassengerForm } from "../../../components/booking/passenger-form"
import { Recap } from "../../../components/booking/recap"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"

export default function BookPage() {
  const { tripId } = useParams() as { tripId: string }
  const { setBooking, seatCount, passengers } = useBookingStore()
  const [trip, setTrip] = useState<{ price: number } | null>(null)

  useEffect(() => {
    setBooking({ tripId })
  }, [tripId, setBooking])

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}/api/v1/trips/${tripId}`)
      .then((r) => r.json())
      .then((data) => setTrip({ price: data.price }))
      .catch(() => {})
  }, [tripId])

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-bold tracking-tight">Réserver</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nombre de places</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Field className="w-24">
              <FieldLabel htmlFor="seatCount" className="sr-only">
                Nombre de places
              </FieldLabel>
              <Input
                id="seatCount"
                type="number"
                min={1}
                max={10}
                value={seatCount}
                onChange={(e) => {
                  let n = Number(e.target.value)
                  if (!Number.isFinite(n) || n < 1) n = 1
                  if (n > 10) n = 10
                  setBooking({
                    seatCount: n,
                    passengers: Array.from({ length: n }, (_, i) => passengers[i] ?? { fullName: "" }),
                  })
                }}
                aria-label="Nombre de places"
              />
            </Field>
            <span className="text-xs text-muted-foreground">max 10 par réservation</span>
          </div>
        </CardContent>
      </Card>

      <PassengerForm />
      {trip ? <Recap price={trip.price} /> : <Skeleton className="h-32 w-full" />}
    </main>
  )
}
