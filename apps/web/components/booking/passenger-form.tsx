"use client"
import { useBookingStore } from "@camermove/frontend"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"

const E164 = /^\+?[1-9]\d{7,14}$/

function validatePassenger(p: { fullName: string; phone?: string }): { fullName?: string; phone?: string } {
  const e: { fullName?: string; phone?: string } = {}
  if (!p.fullName || p.fullName.trim().length < 2) e.fullName = "Nom complet requis (min 2 caractères)"
  if (p.phone && p.phone.trim() !== "" && !E164.test(p.phone.replace(/\s/g, "")))
    e.phone = "Téléphone invalide (E.164, ex: +2376XXXXXXXX)"
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
    <FieldGroup>
      {passengers.map((p, i) => {
        const err = validatePassenger(p as never)
        return (
          <div key={i} className="rounded-lg border bg-card p-4">
            <p className="mb-3 text-xs font-semibold text-muted-foreground">Passager {i + 1}</p>
            <div className="flex flex-col gap-3">
              <Field data-invalid={!!err.fullName}>
                <FieldLabel htmlFor={`fullName-${i}`}>Nom complet *</FieldLabel>
                <Input
                  id={`fullName-${i}`}
                  placeholder="Nom complet"
                  value={p.fullName}
                  onChange={(e) => update(i, "fullName", e.target.value)}
                  required
                  aria-invalid={!!err.fullName}
                />
                {err.fullName && <p className="text-xs text-destructive">{err.fullName}</p>}
              </Field>
              <Field data-invalid={!!err.phone}>
                <FieldLabel htmlFor={`phone-${i}`}>Téléphone</FieldLabel>
                <Input
                  id={`phone-${i}`}
                  placeholder="Téléphone (optionnel, E.164)"
                  value={p.phone ?? ""}
                  onChange={(e) => update(i, "phone", e.target.value)}
                  aria-invalid={!!err.phone}
                />
                {err.phone && <p className="text-xs text-destructive">{err.phone}</p>}
              </Field>
            </div>
          </div>
        )
      })}
    </FieldGroup>
  )
}

export { validatePassenger }
