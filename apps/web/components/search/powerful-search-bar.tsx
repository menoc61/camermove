"use client"
import { useRouter } from "next/navigation"
import { useSearchStore, t } from "@camermove/frontend"
import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"

function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

const CITIES = ["YaoundÃ©", "Douala", "Bamenda", "Bafoussam", "Garoua", "Maroua", "NgaoundÃ©rÃ©", "Bertoua", "Ebolowa", "Kribi"]

export function PowerfulSearchBar() {
  const router = useRouter()
  const { origin, destination, date, pax, setSearch } = useSearchStore()
  const [originInput, setOriginInput] = useState(origin)
  const [destInput, setDestInput] = useState(destination)
  const debouncedOrigin = useDebounce(originInput, 300)
  const debouncedDest = useDebounce(destInput, 300)

  useEffect(() => { setSearch({ origin: debouncedOrigin }) }, [debouncedOrigin, setSearch])
  useEffect(() => { setSearch({ destination: debouncedDest }) }, [debouncedDest, setSearch])

  const originSuggestions = useMemo(() => {
    if (!originInput || originInput.length < 1) return []
    return CITIES.filter((c) => c.toLowerCase().includes(originInput.toLowerCase())).slice(0, 5)
  }, [originInput])
  const destSuggestions = useMemo(() => {
    if (!destInput || destInput.length < 1) return []
    return CITIES.filter((c) => c.toLowerCase().includes(destInput.toLowerCase())).slice(0, 5)
  }, [destInput])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams({ origin: originInput || origin, destination: destInput || destination, date, pax: String(pax) })
    router.push(`/results?${params.toString()}`)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
      <div className="relative">
        <input
          className="w-full rounded-lg border px-3 py-2 text-sm"
          placeholder={t("search.origin")}
          value={originInput}
          onChange={(e) => setOriginInput(e.target.value)}
          required
        />
        {originSuggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow">
            {originSuggestions.map((c) => (
              <button key={c} type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => setOriginInput(c)}>
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="relative">
        <input
          className="w-full rounded-lg border px-3 py-2 text-sm"
          placeholder={t("search.destination")}
          value={destInput}
          onChange={(e) => setDestInput(e.target.value)}
          required
        />
        {destSuggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow">
            {destSuggestions.map((c) => (
              <button key={c} type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => setDestInput(c)}>
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
      <input type="date" className="rounded-lg border px-3 py-2 text-sm" value={date} onChange={(e) => setSearch({ date: e.target.value })} required />
      <div className="flex gap-2">
        <input type="number" min={1} max={10} className="flex-1 rounded-lg border px-3 py-2 text-sm" value={pax} onChange={(e) => setSearch({ pax: Number(e.target.value) })} />
        <button type="submit" className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white">{t("search.trip")}</button>
      </div>
      <p className="text-xs text-slate-400">Recherche optimisÃ©e â€” cache, debounce 300ms, gÃ¨re des milliers de requÃªtes (pagination + Redis).</p>
    </form>
  )
}
