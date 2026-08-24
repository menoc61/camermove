"use client"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { fetchSearch, type SearchParams } from "../../lib/api/search"
import { TripCard } from "../../components/search/trip-card"
function ResultsInner() {
  const sp = useSearchParams()
  const params: SearchParams = {
    origin: sp.get("origin") ?? "Yaoundé",
    destination: sp.get("destination") ?? "Douala",
    date: sp.get("date") ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    pax: Number(sp.get("pax") ?? 1),
    sortBy: (sp.get("sortBy") as SearchParams["sortBy"]) ?? "price_asc",
  }
  const { data, isLoading, error } = useQuery({ queryKey: ["search", params], queryFn: () => fetchSearch(params) })
  if (isLoading) return <p className="p-6">Chargement…</p>
  if (error) return <p className="p-6 text-red-500">Erreur de recherche</p>
  if (!data || data.items.length === 0) return <p className="p-6">Aucun résultat pour {params.origin} → {params.destination}</p>
  return (
    <main className="mx-auto max-w-md space-y-3 p-6">
      <h1 className="text-xl font-semibold">{data.items.length} trajets · {params.origin} → {params.destination}</h1>
      {data.items.map((trip) => <TripCard key={trip.id} trip={trip} />)}
    </main>
  )
}
export default function ResultsPage() {
  return <Suspense fallback={<p>Chargement…</p>}><ResultsInner /></Suspense>
}
