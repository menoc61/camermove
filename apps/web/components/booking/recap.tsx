"use client"
import { useBookingStore, useAuthStore } from "@camermove/frontend"
import { createBooking, createTripPayment } from "../../lib/api/bookings"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PaymentStep } from "./PaymentStep"
import { priceXaf } from "@camermove/shared"

function formatCountdown(ms: number) {
  if (ms <= 0) return "expiré"
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function Recap({ price }: { price: number }) {
  const { tripId, seatCount, passengers } = useBookingStore()
  const token = useAuthStore((s) => s.accessToken)
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [holdExpiresAt, setHoldExpiresAt] = useState<Date | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [createdBooking, setCreatedBooking] = useState<{ id: string; reference: string } | null>(null)
  const total = price * seatCount

  useEffect(() => {
    if (!holdExpiresAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [holdExpiresAt])

  const invalidPassengers = passengers.some((p) => !p.fullName || p.fullName.trim().length < 2)
  const phoneInvalid = passengers.some((p) => p.phone && !/^\+?[1-9]\d{7,14}$/.test(p.phone.replace(/\s/g, "")))

  async function submit() {
    if (!tripId || !token) return
    setLoading(true)
    setError(null)
    try {
      const res = await createBooking({ tripId, seatCount, passengers }, token)
      if (res.holdExpiresAt) setHoldExpiresAt(new Date(res.holdExpiresAt))
      setCreatedBooking({ id: res.booking.id, reference: res.booking.reference })
    } catch (e: unknown) {
      const err = e as Error & { status?: number; message: string }
      if (err.status === 409) setError("Plus de places disponibles pour ce trajet. Veuillez choisir un autre horaire.")
      else if (err.status === 429) setError("Trop de requêtes. Patientez quelques secondes puis réessayez.")
      else setError(err.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  const countdown = holdExpiresAt ? Math.max(0, holdExpiresAt.getTime() - now) : null
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="text-lg font-bold">
            {priceXaf(total)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {seatCount} × {priceXaf(price)}
        </p>
        {countdown != null ? (
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="secondary" className="font-mono">
              Expire dans {formatCountdown(countdown)}
            </Badge>
            <span className="text-muted-foreground">avant libération des places</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Vos places seront réservées 15 minutes lors de la confirmation.
          </p>
        )}
        {/* Pay options — PaymentStep owns provider + method selection */}
        {createdBooking && token ? (
          <PaymentStep
            amount={total}
            createPayment={(provider, opts) =>
              createTripPayment(token, createdBooking.id, { provider, method: opts.method, phone: opts.phone })
            }
            onPaymentCreated={() => router.push(`/book/confirmation?ref=${createdBooking.reference}`)}
          />
        ) : null}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {(invalidPassengers || phoneInvalid) && (
          <p className="text-xs text-amber-600">Vérifiez les informations passagers (nom requis, téléphone E.164)</p>
        )}
        {!createdBooking && (
          <Button onClick={submit} disabled={loading || !token || invalidPassengers || phoneInvalid} className="w-full rounded-full">
            {loading ? "Réservation…" : "Confirmer la réservation"}
          </Button>
        )}
        {createdBooking && (
          <p className="text-xs text-muted-foreground">Places réservées — finalisez le paiement ci-dessus.</p>
        )}
        {!token && <p className="text-center text-xs text-amber-600">Connectez-vous pour réserver</p>}
      </CardContent>
    </Card>
  )
}
