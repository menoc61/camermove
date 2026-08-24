"use client"
import { useRouter } from "next/navigation"
import { useSearchStore, t } from "@camermove/frontend"
export function SearchBar() {
  const router = useRouter()
  const { origin, destination, date, pax, setSearch } = useSearchStore()
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams({ origin, destination, date, pax: String(pax) })
    router.push(`/results?${params.toString()}`)
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
      <input className="rounded-lg border px-3 py-2 text-sm" placeholder={t("search.origin")} value={origin} onChange={(e) => setSearch({ origin: e.target.value })} required />
      <input className="rounded-lg border px-3 py-2 text-sm" placeholder={t("search.destination")} value={destination} onChange={(e) => setSearch({ destination: e.target.value })} required />
      <input type="date" className="rounded-lg border px-3 py-2 text-sm" value={date} onChange={(e) => setSearch({ date: e.target.value })} required />
      <input type="number" min={1} className="rounded-lg border px-3 py-2 text-sm" value={pax} onChange={(e) => setSearch({ pax: Number(e.target.value) })} />
      <button type="submit" className="rounded-lg bg-[#0e9f8f] px-3 py-2 text-sm font-medium text-white">{t("search.trip")}</button>
    </form>
  )
}
