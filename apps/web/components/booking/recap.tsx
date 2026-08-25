"use client"
import { useBookingStore, useAuthStore } from "@camermove/frontend"
import { createBooking } from "../../lib/api/bookings"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

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
      router.push(`/book/confirmation?ref=${res.booking.reference}`)
    } catch (e: unknown) {
      const err = e as Error & { status?: number; message: string }
      if (err.status === 409) setError("Plus de places disponibles pour ce trajet (409). Veuillez choisir un autre horaire.")
      else if (err.status === 429) setError("Trop de requêtes (429). Patientez quelques secondes puis réessayez.")
      else setError(err.message || String(e))
    } finally { setLoading(false) }
  }

  const countdown = holdExpiresAt ? holdExpiresAt.getTime() - now : 15 * 60 * 1000
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="text-sm">Total: <span className="font-semibold">{total} XAF</span> ({seatCount} × {price} XAF)</div>
      <div className="mt-1 text-xs text-slate-500">Détail: {seatCount} × {price} XAF = {total} XAF — Hold 15 min</div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="rounded-full bg-amber-50 px-2 py-1 font-mono text-amber-700">Hold {formatCountdown(countdown)}</span>
        <span className="text-slate-500">expire libère les places</span>
      </div>
      {holdExpiresAt && <p className="mt-1 text-xs text-slate-400">Expire: {holdExpiresAt.toLocaleTimeString()}</p>}
      {error && <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      {(invalidPassengers || phoneInvalid) && <p className="mt-2 text-xs text-amber-600">Vérifiez les informations passagers (nom requis, téléphone E.164)</p>}
      <button onClick={submit} disabled={loading || !token || invalidPassengers || phoneInvalid} className="mt-3 w-full rounded-lg bg-[#0e9f8f] py-2 text-sm font-medium text-white disabled:opacity-50">
        {loading ? "Réservation…" : "Confirmer la réservation"}
      </button>
      {!token && <p className="mt-2 text-xs text-amber-600">Connectez-vous pour réserver</p>}
    </div>
  )
}
