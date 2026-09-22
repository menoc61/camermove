"use client"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Suspense, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check } from "lucide-react"
import { useAuthStore } from "@camermove/frontend"
import { fetchHotelBooking } from "@/lib/api/hotels"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { priceXaf } from "@camermove/shared"

function HotelsConfirmationInner() {
  const sp = useSearchParams()
  const router = useRouter()
  const token = useAuthStore((s) => s.accessToken)
  const id = sp.get("id") ?? ""

  useEffect(() => {
    if (!token) {
      router.push("/login?next=" + encodeURIComponent(id ? `/hotels/confirmation?id=${id}` : "/hotels"))
    }
  }, [token, router, id])

  const { data: booking, isLoading, error } = useQuery({
    queryKey: ["hotel-booking", id],
    queryFn: () => fetchHotelBooking(token!, id),
    enabled: !!token && !!id,
  })

  if (!id) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-muted-foreground">Référence manquante.</p>
        <Link href="/hotels" className="mt-4 inline-block text-sm font-semibold text-primary underline">Retour aux hôtels</Link>
      </main>
    )
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-muted-foreground">Redirection vers la connexion…</p>
      </main>
    )
  }

  const pendingPayment = booking && (booking.status === "pending_payment" || booking.status === "pending")

  return (
    <main className="mx-auto max-w-md space-y-4 p-4" style={{ background: "#F7F5F0", minHeight: "100vh" }}>
      <div className="text-center py-6">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full" style={{ background: "#2E7D5B" }}><Check className="size-6 text-white" /></div>
        <h1 className="mt-3 text-lg font-bold" style={{ color: "#14213D" }}>Réservation d&apos;hôtel créée</h1>
        <p className="text-xs font-mono" style={{ color: "#5A6474" }}>Réf. {id}</p>
      </div>
      <Card>
        <CardContent className="p-4 space-y-3">
          {isLoading && <Skeleton className="h-40 w-full" />}
          {error && (
            <Alert variant="destructive"><AlertDescription>Impossible de charger la réservation.</AlertDescription></Alert>
          )}
          {booking && (
            <div className="space-y-2 text-sm" style={{ color: "#14213D" }}>
              <p><span className="font-semibold">Hôtel :</span> {booking.hotel?.name ?? "—"} {booking.hotel?.city ? `· ${booking.hotel.city}` : ""}</p>
              <p><span className="font-semibold">Chambre :</span> {booking.roomType?.name ?? "—"}</p>
              <p><span className="font-semibold">Arrivée :</span> {new Date(booking.checkIn).toLocaleDateString("fr-FR")}</p>
              <p><span className="font-semibold">Départ :</span> {new Date(booking.checkOut).toLocaleDateString("fr-FR")}</p>
              <p><span className="font-semibold">Voyageurs :</span> {booking.guests}</p>
              <p className="text-lg font-bold">Total : {priceXaf(booking.totalAmount)}</p>
              <p><span className="font-semibold">Statut :</span> {booking.status}</p>
            </div>
          )}
          {pendingPayment && booking?.hotel && (
            <Button className="w-full rounded-full font-bold" style={{ background: "#E8A548", color: "#14213D" }} onClick={() => router.push(`/hotels/${booking.hotel!.id}`)}>
              Procéder au paiement
            </Button>
          )}
          <Link href="/dashboard" className="block text-center text-xs font-semibold underline" style={{ color: "#14213D" }}>Aller au tableau de bord →</Link>
        </CardContent>
      </Card>
    </main>
  )
}

export default function HotelsConfirmationPage() {
  return <Suspense><HotelsConfirmationInner /></Suspense>
}
