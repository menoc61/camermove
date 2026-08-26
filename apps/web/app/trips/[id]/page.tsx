"use client"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface TripDetail {
  id: string
  departureAt: string
  arrivalEstimateAt: string
  price: number
  totalSeats: number
  vehicleTypeInfo: string | null
  status: string
  route: { originCity: string; destinationCity: string } | null
  transport: { companyName: string } | null
  seatAvailability: { seatsAvailable: number; seatsHeld: number; seatsBooked: number } | null
}

async function fetchTrip(id: string): Promise<TripDetail> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
  const res = await fetch(`${base}/api/v1/trips/${id}`, { cache: "no-store" })
  if (!res.ok) throw new Error("Trajet introuvable")
  return res.json()
}

export default function TripDetailPage() {
  const { id } = useParams() as { id: string }
  const { data: trip, isLoading, error } = useQuery({ queryKey: ["trip", id], queryFn: () => fetchTrip(id) })

  if (isLoading)
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </main>
    )
  if (error || !trip)
    return (
      <main className="mx-auto max-w-2xl p-6">
        <Alert variant="destructive">
          <AlertTitle>Introuvable</AlertTitle>
          <AlertDescription>Ce trajet n&apos;existe plus ou a été annulé.</AlertDescription>
        </Alert>
        <Link href="/" className={cn(buttonVariants({ variant: "link" }), "mt-4")}>
          Retour à l&apos;accueil
        </Link>
      </main>
    )

  const seats = trip.seatAvailability?.seatsAvailable ?? trip.totalSeats
  const dep = new Date(trip.departureAt)
  const arr = new Date(trip.arrivalEstimateAt)

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              {trip.route?.originCity ?? "Yaoundé"} → {trip.route?.destinationCity ?? "Douala"}
            </span>
            <Badge variant={trip.status === "active" ? "default" : "secondary"}>{trip.status}</Badge>
          </CardTitle>
          <CardDescription>
            {trip.transport?.companyName ?? "Transporteur"} · {trip.vehicleTypeInfo ?? "Autocar"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-muted-foreground">Départ</p>
              <p className="font-medium">{dep.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Arrivée estimée</p>
              <p className="font-medium">{arr.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-muted-foreground">Prix</p>
              <p className="text-lg font-bold">{new Intl.NumberFormat("fr-CM").format(trip.price)} XAF</p>
            </div>
          </div>
          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-sm text-muted-foreground">{seats} places disponibles / {trip.totalSeats}</span>
            <Link
              href={`/book/${trip.id}`}
              className={cn(buttonVariants({ size: "lg" }), "rounded-full")}
            >
              Réserver
            </Link>
          </div>
        </CardContent>
      </Card>

      <Link href="/results" className={cn(buttonVariants({ variant: "ghost" }), "w-full justify-center")}>
        ← Retour aux résultats
      </Link>
    </main>
  )
}
