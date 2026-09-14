"use client"
import { useParams, useRouter } from "next/navigation"
import { useBookingStore, useAuthStore } from "@camermove/frontend"
import { PassengerForm } from "../../../components/booking/passenger-form"
import { Recap } from "../../../components/booking/recap"
import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"

export default function BookPage() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const token = useAuthStore((s) => s.accessToken)
  const { setBooking, seatCount, passengers } = useBookingStore()
  const [trip, setTrip] = useState<{ price: number } | null>(null)
  const prevTripId = useRef<string | null>(null)
  const initialized = useRef(false)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!token && !initialized.current) {
      initialized.current = true
      router.push(`/login?next=/book/${tripId}`)
    }
  }, [token, router, tripId])

  const bookingTripId = useBookingStore((s) => s.tripId)
  useEffect(() => {
    // Only init if store is empty or points to a different trip — preserve
    // passenger name prefilled from trips/[id] seat map
    if (prevTripId.current === tripId) return
    prevTripId.current = tripId
    if (bookingTripId !== tripId) {
      setBooking({ tripId, seatCount: 1, passengers: [{ fullName: "" }] })
    }
  }, [tripId, setBooking, bookingTripId])

  useEffect(() => {
    let alive = true
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}/api/v1/trips/${tripId}`)
      .then((r) => r.json())
      .then((data) => {
        if (alive) setTrip({ price: data.price })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [tripId])

  // Show loading state while redirecting unauthenticated users
  if (!token) {
    return (
      <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Skeleton className="h-8 w-48 mb-4" />
          <p className="text-sm text-muted-foreground mb-4">Connexion requise pour réserver</p>
          <Link href={`/login?next=/book/${tripId}`} className="text-sm text-primary hover:underline">
            Se connecter →
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Réserver</h1>

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
