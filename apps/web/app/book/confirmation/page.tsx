"use client"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Suspense, useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check } from "lucide-react"
import { useAuthStore } from "@camermove/frontend"
import { getBooking } from "@/lib/api/bookings"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

interface BookingDetail {
  id: string
  reference: string
  seatCount?: number
  totalAmount: number
  status: string
  holdExpiresAt?: string
  passengers?: unknown[]
}

function ConfirmationInner() {
  const sp = useSearchParams()
  const router = useRouter()
  const token = useAuthStore((s) => s.accessToken)
  const ref = sp.get("ref") ?? ""
  const [countdown, setCountdown] = useState(600)
  useEffect(() => {
    const id = setInterval(() => setCountdown((v) => (v > 0 ? v - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [])
  const m = Math.floor(countdown / 60), s = String(countdown % 60).padStart(2, "0")

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", ref],
    queryFn: () => getBooking(ref, token!) as Promise<BookingDetail>,
    enabled: !!token && !!ref,
    retry: false,
  })

  if (!ref) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-muted-foreground">Référence manquante.</p>
        <Link href="/results" className="mt-4 inline-block text-sm font-semibold text-primary underline">Retour aux résultats</Link>
      </main>
    )
  }

  const seats = booking?.seatCount ?? booking?.passengers?.length ?? null

  return (
    <main className="mx-auto max-w-md space-y-4 p-4" style={{ background: "#F7F5F0", minHeight: "100vh" }}>
      <div className="text-center py-6">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full" style={{ background: "#2E7D5B" }}><Check className="size-6 text-white" /></div>
        <h1 className="mt-3 text-lg font-bold" style={{ color: "#14213D" }}>Réservation créée</h1>
        <p className="text-xs font-mono" style={{ color: "#5A6474" }}>Réf. {booking?.reference ?? ref}</p>
        <p className="mt-2 text-xs" style={{ color: "#5A6474" }}>Expire dans {m}:{s} — procédez au paiement.</p>
      </div>
      <Card>
        <CardContent className="p-4 text-center space-y-3">
          {isLoading && <Skeleton className="h-24 w-full" />}
          {booking && (
            <div className="space-y-1 text-sm" style={{ color: "#14213D" }}>
              {seats != null && <p><span className="font-semibold">Sièges :</span> {seats}</p>}
              <p className="text-base font-bold">Total : {new Intl.NumberFormat("fr-CM").format(booking.totalAmount)} XAF</p>
              <p><span className="font-semibold">Statut :</span> {booking.status}</p>
            </div>
          )}
          <p className="text-sm" style={{ color: "#5A6474" }}>Votre siège est bloqué 15 minutes. Payez via MTN Money, Orange Money ou carte pour obtenir votre billet QR.</p>
          <Button className="mt-4 w-full rounded-full font-bold" style={{ background: "#E8A548", color: "#14213D" }} onClick={() => router.push(`/tickets/lookup?code=${booking?.reference ?? ref}`)}>Voir mon billet</Button>
          <Link href="/dashboard" className="mt-3 block text-xs font-semibold underline" style={{ color: "#14213D" }}>Aller au tableau de bord →</Link>
        </CardContent>
      </Card>
    </main>
  )
}

export default function ConfirmationPage() {
  return <Suspense><ConfirmationInner /></Suspense>
}
