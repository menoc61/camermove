"use client"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { fetchSearch, type SearchParams } from "../../lib/api/search"
import { TripCard } from "../../components/search/trip-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TriangleAlert } from "lucide-react"

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

function ResultsInner() {
  const sp = useSearchParams()
  const params: SearchParams = {
    origin: sp.get("origin") ?? "Yaoundé",
    destination: sp.get("destination") ?? "Douala",
    date: sp.get("date") ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    pax: Number(sp.get("pax") ?? 1),
    sortBy: (sp.get("sortBy") as SearchParams["sortBy"]) ?? "price_asc",
  }
  const { data, isLoading, error } = useQuery({
    queryKey: ["search", params],
    queryFn: () => fetchSearch(params),
  })

  if (isLoading)
    return (
      <main className="mx-auto max-w-2xl p-6">
        <ResultsSkeleton />
      </main>
    )
  if (error)
    return (
      <main className="mx-auto max-w-2xl p-6">
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>Erreur de recherche — réessayez.</AlertDescription>
        </Alert>
      </main>
    )
  if (!data || data.items.length === 0)
    return (
      <main className="mx-auto max-w-2xl p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Aucun résultat pour {params.origin} → {params.destination}
            </p>
          </CardContent>
        </Card>
      </main>
    )
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-xl font-semibold tracking-tight">
        {data.items.length} trajets · {params.origin} → {params.destination}
      </h1>
      <div className="flex flex-col gap-3">
        {data.items.map((trip) => (
          <TripCard key={trip.id} trip={trip} />
        ))}
      </div>
    </main>
  )
}
export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-2xl p-6">
          <ResultsSkeleton />
        </main>
      }
    >
      <ResultsInner />
    </Suspense>
  )
}
