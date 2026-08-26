"use client"

import Link from "next/link"
import { useState } from "react"
import { Loader2, Search } from "lucide-react"
import { fetchSearch } from "../../lib/api/search"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"

function todayPlus(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function PriceSimulator() {
  const [date, setDate] = useState(todayPlus(1))
  const [pax, setPax] = useState("1")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ min: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function check() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchSearch({
        origin: "Yaoundé",
        destination: "Douala",
        date,
        pax: Number(pax),
        sortBy: "price_asc",
      })
      if (res.items.length === 0) {
        setResult(null)
        setError("Aucun départ trouvé pour cette date — essayez une autre journée.")
      } else {
        setResult({ min: res.items[0]!.price, total: res.pagination.total })
      }
    } catch {
      setError("Impossible de vérifier les prix pour le moment.")
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const resultsHref = `/results?origin=Yaound%C3%A9&destination=Douala&date=${encodeURIComponent(date)}&pax=${pax}`

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm sm:p-6">
      <FieldGroup>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
          <Field>
            <FieldLabel htmlFor="sim-date">Date de départ</FieldLabel>
            <Input
              id="sim-date"
              type="date"
              value={date}
              min={todayPlus(0)}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="sim-pax">Passagers</FieldLabel>
            <Select value={pax} onValueChange={setPax}>
              <SelectTrigger id="sim-pax" className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["1", "2", "3", "4", "5", "6"].map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Button
          onClick={check}
          disabled={loading}
          className="rounded-full font-bold"
        >
          {loading ? (
            <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : (
            <Search data-icon="inline-start" aria-hidden />
          )}
          {loading ? "Vérification…" : "Vérifier le prix"}
        </Button>

        <div aria-live="polite" className="min-h-10 text-sm">
          {error && <p className="text-destructive">{error}</p>}
          {result && !loading && (
            <p className="text-foreground">
              Dès{" "}
              <span className="text-xl font-bold tracking-tight">
                {new Intl.NumberFormat("fr-CM").format(result.min)} XAF
              </span>{" "}
              par place · {result.total} départ{result.total > 1 ? "s" : ""} trouvé
              {result.total > 1 ? "s" : ""}.{" "}
              <Link
                href={resultsHref}
                className="font-semibold text-primary-dark underline-offset-4 hover:underline"
              >
                Choisir mon départ →
              </Link>
            </p>
          )}
        </div>
      </FieldGroup>
    </div>
  )
}
