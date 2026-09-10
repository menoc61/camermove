"use client"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Suspense, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check } from "lucide-react"
import { useAuthStore } from "@camermove/frontend"
import { fetchRentalBooking } from "@/lib/api/rentals"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"

function RentalsConfirmationInner() {
  const sp = useSearchParams()
  const router = useRouter()
  const token = useAuthStore((s) => s.accessToken)
  const id = sp.get("id") ?? ""

  useEffect(() => {
    if (!token) {
      router.push("/login?next=" + encodeURIComponent(id ? `/rentals/confirmation?id=${id}` : "/rentals"))
    }
  }, [token, router, id])

  const { data: booking, isLoading, error } = useQuery({
    queryKey: ["rental-booking", id],
    queryFn: () => fetchRentalBooking(token!, id),
    enabled: !!token && !!id,
  })

  if (!id) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-muted-foreground">Référence manquante.</p>
        <Link href="/rentals" className="mt-4 inline-block text-sm font-semibold text-primary underline">Retour aux locations</Link>
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
        <h1 className="mt-3 text-lg font-bold" style={{ color: "#14213D" }}>Location créée</h1>
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
              <p><span className="font-semibold">Véhicule :</span> {booking.vehicle ? `${booking.vehicle.make} ${booking.vehicle.model}` : "—"} {booking.vehicle?.category ? `· ${booking.vehicle.category}` : ""}</p>
              <p><span className="font-semibold">Début :</span> {new Date(booking.startDate).toLocaleDateString("fr-FR")}</p>
              <p><span className="font-semibold">Fin :</span> {new Date(booking.endDate).toLocaleDateString("fr-FR")}</p>
              <p><span className="font-semibold">Retrait :</span> {booking.pickupCity}</p>
              <p className="text-lg font-bold">Total : {new Intl.NumberFormat("fr-CM").format(booking.totalAmount)} XAF</p>
              <p><span className="font-semibold">Statut :</span> {booking.status}</p>
            </div>
          )}
          {pendingPayment && booking?.vehicle && (
            <Button className="w-full rounded-full font-bold" style={{ background: "#E8A548", color: "#14213D" }} onClick={() => router.push(`/rentals/${booking.vehicle!.id}`)}>
              Procéder au paiement
            </Button>
          )}
          <Link href="/dashboard" className="block text-center text-xs font-semibold underline" style={{ color: "#14213D" }}>Aller au tableau de bord →</Link>
        </CardContent>
      </Card>
    </main>
  )
}

export default function RentalsConfirmationPage() {
  return <Suspense><RentalsConfirmationInner /></Suspense>
}
