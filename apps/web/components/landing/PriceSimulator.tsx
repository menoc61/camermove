"use client"

import Link from "next/link"
import { useState } from "react"
import { Loader2, Search } from "lucide-react"
import { fetchSearch } from "../../lib/api/search"

function todayPlus(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function PriceSimulator() {
  const [date, setDate] = useState(todayPlus(1))
  const [pax, setPax] = useState(1)
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
        pax,
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Date de départ</span>
          <input
            type="date"
            value={date}
            min={todayPlus(0)}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Passagers</span>
          <select
            value={pax}
            onChange={(e) => setPax(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 sm:w-32"
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        onClick={check}
        disabled={loading}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-px hover:bg-primary-dark active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Search className="h-4 w-4" strokeWidth={2} aria-hidden />
        )}
        {loading ? "Vérification…" : "Vérifier le prix"}
      </button>

      <div aria-live="polite" className="mt-4 min-h-10 text-sm">
        {error && <p className="text-red-700">{error}</p>}
        {result && !loading && (
          <p className="text-slate-700">
            Dès{" "}
            <span className="text-xl font-bold tracking-tight text-slate-900">
              {new Intl.NumberFormat("fr-CM").format(result.min)} XAF
            </span>{" "}
            par place · {result.total} départ{result.total > 1 ? "s" : ""} trouvé
            {result.total > 1 ? "s" : ""}.{" "}
            <Link href={resultsHref} className="font-semibold text-primary-dark underline-offset-4 hover:underline">
              Choisir mon départ →
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
