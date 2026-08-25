"use client"
import { useBookingStore, useAuthStore } from "@camermove/frontend"
import { createBooking } from "../../lib/api/bookings"
import { useState } from "react"
import { useRouter } from "next/navigation"
export function Recap({ price }: { price: number }) {
  const { tripId, seatCount, passengers } = useBookingStore()
  const token = useAuthStore((s) => s.accessToken)
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const total = price * seatCount
  async function submit() {
    if (!tripId || !token) return
    setLoading(true)
    try {
      const res = await createBooking({ tripId, seatCount, passengers }, token)
      router.push(`/book/confirmation?ref=${res.booking.reference}`)
    } catch (e) {
      alert(String(e))
    } finally { setLoading(false) }
  }
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="text-sm">Total: <span className="font-semibold">{total} XAF</span> ({seatCount} × {price} XAF)</div>
      <div className="mt-2 text-xs text-slate-500">Hold 15 min — expire libère les places</div>
      <button onClick={submit} disabled={loading || !token} className="mt-3 w-full rounded-lg bg-[#0e9f8f] py-2 text-sm font-medium text-white disabled:opacity-50">
        {loading ? "Réservation…" : "Confirmer la réservation"}
      </button>
      {!token && <p className="mt-2 text-xs text-amber-600">Connectez-vous pour réserver</p>}
    </div>
  )
}
