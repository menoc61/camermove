"use client"
import { useBookingStore } from "@camermove/frontend"

const E164 = /^\+?[1-9]\d{7,14}$/

function validatePassenger(p: { fullName: string; phone?: string }): { fullName?: string; phone?: string } {
  const e: { fullName?: string; phone?: string } = {}
  if (!p.fullName || p.fullName.trim().length < 2) e.fullName = "Nom complet requis (min 2 caractères)"
  if (p.phone && p.phone.trim() !== "" && !E164.test(p.phone.replace(/\s/g, ""))) e.phone = "Téléphone invalide (E.164, ex: +2376XXXXXXXX)"
  return e
}

export function PassengerForm() {
  const { passengers, setBooking } = useBookingStore()
  function update(i: number, field: "fullName" | "phone", value: string) {
    const next = [...passengers]
    next[i] = { ...next[i]!, [field]: value }
    setBooking({ passengers: next })
  }
  return (
    <div className="space-y-3">
      {passengers.map((p, i) => {
        const err = validatePassenger(p as never)
        return (
          <div key={i} className="rounded-xl border p-3">
            <label className="text-xs font-medium text-slate-600">Passager {i + 1}</label>
            <input className={`mt-1 w-full rounded border px-3 py-2 text-sm ${err.fullName ? "border-red-400" : ""}`} placeholder="Nom complet *" value={p.fullName} onChange={(e) => update(i, "fullName", e.target.value)} required aria-invalid={!!err.fullName} />
            {err.fullName && <p className="mt-1 text-xs text-red-600">{err.fullName}</p>}
            <input className={`mt-2 w-full rounded border px-3 py-2 text-sm ${err.phone ? "border-red-400" : ""}`} placeholder="Téléphone (optionnel, E.164)" value={p.phone ?? ""} onChange={(e) => update(i, "phone", e.target.value)} aria-invalid={!!err.phone} />
            {err.phone && <p className="mt-1 text-xs text-red-600">{err.phone}</p>}
          </div>
        )
      })}
    </div>
  )
}

export { validatePassenger }
