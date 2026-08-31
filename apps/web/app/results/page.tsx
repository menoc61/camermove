"use client"
import { Suspense, useCallback } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { fetchSearch, type SearchParams, type SearchResultItem } from "../../lib/api/search"
import { TripCard } from "../../components/search/trip-card"

type SearchResult = { items: SearchResultItem[]; pagination: { page: number; perPage: number; total: number; totalPages: number } }

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { TriangleAlert, SlidersHorizontal, ChevronLeft, ChevronRight, Bus } from "lucide-react"
import { cn } from "@/lib/utils"

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

type SortBy = "price_asc" | "price_desc" | "departure_asc"

const SORT_LABELS: Record<SortBy, string> = {
  price_asc: "Prix croissant",
  price_desc: "Prix décroissant",
  departure_asc: "Départ le plus tôt",
}

function FilterBar({
  sortBy,
  minPrice,
  maxPrice,
  vehicleType,
}: {
  sortBy: SortBy
  minPrice?: number
  maxPrice?: number
  vehicleType?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const updateParam = useCallback(
    (key: string, value: string | undefined) => {
      const next = new URLSearchParams(sp.toString())
      if (value === undefined || value === "") {
        next.delete(key)
      } else {
        next.set(key, value)
      }
      next.delete("page") // reset to page 1 on filter change
      router.push(`${pathname}?${next.toString()}`, { scroll: false })
    },
    [sp, router, pathname]
  )

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <SlidersHorizontal className="size-4" />
        Filtres
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {/* Sort */}
        <Field className="min-w-44">
          <FieldLabel className="sr-only">Trier par</FieldLabel>
          <Select
            value={sortBy}
            onValueChange={(v) => updateParam("sortBy", v as SortBy)}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(SORT_LABELS) as [SortBy, string][]).map(
                ([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </Field>

        {/* Min price */}
        <Field className="min-w-32">
          <FieldLabel className="sr-only">Prix min</FieldLabel>
          <Input
            type="number"
            placeholder="Prix min (XAF)"
            value={minPrice != null ? String(minPrice) : ""}
            onChange={(e) =>
              updateParam(
                "minPrice",
                e.target.value ? String(Number(e.target.value)) : undefined
              )
            }
          />
        </Field>

        {/* Max price */}
        <Field className="min-w-32">
          <FieldLabel className="sr-only">Prix max</FieldLabel>
          <Input
            type="number"
            placeholder="Prix max (XAF)"
            value={maxPrice != null ? String(maxPrice) : ""}
            onChange={(e) =>
              updateParam(
                "maxPrice",
                e.target.value ? String(Number(e.target.value)) : undefined
              )
            }
          />
        </Field>

        {/* Clear filters */}
        {(sortBy !== "price_asc" || minPrice !== undefined || maxPrice !== undefined) && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              const next = new URLSearchParams(sp.toString())
              next.delete("sortBy")
              next.delete("minPrice")
              next.delete("maxPrice")
              next.delete("page")
              router.push(`${pathname}?${next.toString()}`, { scroll: false })
            }}
          >
            Réinitialiser
          </Button>
        )}
      </div>
    </div>
  )
}

function PaginationControls({
  page,
  totalPages,
}: {
  page: number
  totalPages: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  function goTo(p: number) {
    const next = new URLSearchParams(sp.toString())
    next.set("page", String(p))
    router.push(`${pathname}?${next.toString()}`, { scroll: false })
  }

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between pt-2">
      <span className="text-sm text-muted-foreground">
        Page {page} / {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          disabled={page <= 1}
          onClick={() => goTo(page - 1)}
          aria-label="Page précédente"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          disabled={page >= totalPages}
          onClick={() => goTo(page + 1)}
          aria-label="Page suivante"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function ResultsInner() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const params: SearchParams = {
    origin: sp.get("origin") ?? "Yaoundé",
    destination: sp.get("destination") ?? "Douala",
    date: sp.get("date") ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    pax: Number(sp.get("pax") ?? 1),
    sortBy: (sp.get("sortBy") as SearchParams["sortBy"]) ?? "price_asc",
    minPrice: sp.get("minPrice") ? Number(sp.get("minPrice")) : undefined,
    maxPrice: sp.get("maxPrice") ? Number(sp.get("maxPrice")) : undefined,
    page: Number(sp.get("page") ?? 1),
  }

  const { data, isLoading, error } = useQuery<SearchResult>({
    queryKey: ["search", params],
    queryFn: () => fetchSearch(params),
  })

  if (isLoading)
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-6">
        <Skeleton className="h-6 w-48" />
        <FilterBar sortBy="price_asc" />
        <ResultsSkeleton />
      </main>
    )

  if (error)
    return (
      <main className="mx-auto max-w-2xl p-6">
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>
            Erreur de recherche —{" "}
            <button
              className={cn(buttonVariants({ variant: "link" }), "h-auto p-0 text-inherit underline")}
              onClick={() => router.refresh()}
            >
              réessayez
            </button>
            .
          </AlertDescription>
        </Alert>
      </main>
    )

  const currentPage = params.page ?? 1
  const hasResults = data != null && data.items.length > 0

  // Safe refs — only accessed when hasResults is true
  const tripData = hasResults ? data! : null
  const totalPages = tripData?.pagination.totalPages ?? 1

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">
          {hasResults && tripData!.items.length > 0
            ? `${tripData!.items.length} trajet${tripData!.items.length > 1 ? "s" : ""} · ${params.origin} → ${params.destination}`
            : `Résultats · ${params.origin} → ${params.destination}`}
        </h1>
        {hasResults && tripData!.pagination.total > 0 && (
          <Badge variant="outline" className="font-normal">
            {tripData!.pagination.total} total
          </Badge>
        )}
      </div>

      {/* Filter bar */}
      <FilterBar
        sortBy={params.sortBy ?? "price_asc"}
        minPrice={params.minPrice}
        maxPrice={params.maxPrice}
      />

      <Separator />

      {/* Empty state */}
      {(!data || data.items.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="rounded-full bg-muted p-3">
              <Bus className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Aucun résultat pour{" "}
              <span className="font-medium text-foreground">{params.origin}</span> →{" "}
              <span className="font-medium text-foreground">{params.destination}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Essayez une autre date ou modifiez vos filtres.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results list */}
      {hasResults && (
        <div className="flex flex-col gap-3">
          {tripData!.items.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {hasResults && (
        <PaginationControls page={currentPage} totalPages={totalPages} />
      )}
    </main>
  )}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-2xl space-y-4 p-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <ResultsSkeleton />
        </main>
      }
    >
      <ResultsInner />
    </Suspense>
  )
}
