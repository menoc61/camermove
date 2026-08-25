"use client"
import { useBookingStore } from "@camermove/frontend"
export function PassengerForm() {
  const { passengers, setBooking } = useBookingStore()
  function update(i: number, field: "fullName" | "phone", value: string) {
    const next = [...passengers]
    next[i] = { ...next[i]!, [field]: value }
    setBooking({ passengers: next })
  }
  return (
    <div className="space-y-3">
      {passengers.map((p, i) => (
        <div key={i} className="rounded-xl border p-3">
          <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Nom complet *" value={p.fullName} onChange={(e) => update(i, "fullName", e.target.value)} required />
          <input className="mt-2 w-full rounded border px-3 py-2 text-sm" placeholder="Téléphone (optionnel)" value={p.phone ?? ""} onChange={(e) => update(i, "phone", e.target.value)} />
        </div>
      ))}
    </div>
  )
}
