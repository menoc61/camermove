"use client"
import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { fetchRentals, type RentalsParams } from "@/lib/api/rentals"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Car, Search, ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react"

export default function RentalsPage() {
  const [pickupCity, setPickupCity] = useState("")
  const [category, setCategory] = useState<string>("")
  const [hasDriver, setHasDriver] = useState<string>("all")
  const [q, setQ] = useState("")
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [page, setPage] = useState(1)

  const params: RentalsParams = {
    pickupCity: pickupCity || undefined,
    category: category || undefined,
    hasDriver: hasDriver === "all" ? undefined : hasDriver === "true",
    q: q || undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    page,
    perPage: 12,
  }

  const { data, isLoading, error } = useQuery({ queryKey: ["rentals", params], queryFn: () => fetchRentals(params) })
  const totalPages = data?.totalPages ?? 1

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Location véhicules</h1>
        {data && <Badge variant="outline">{data.total} véhicules</Badge>}
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-36">
            <label className="text-xs text-muted-foreground">Ville retrait</label>
            <Input placeholder="Douala" value={pickupCity} onChange={(e) => { setPickupCity(e.target.value); setPage(1) }} />
          </div>
          <div className="min-w-36">
            <label className="text-xs text-muted-foreground">Catégorie</label>
            <Select value={category || "all"} onValueChange={(v) => { setCategory((v as string) === "all" ? "" : (v as string)); setPage(1) }}>
              <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="sedan">Berline</SelectItem>
                <SelectItem value="suv">SUV</SelectItem>
                <SelectItem value="minibus">Minibus</SelectItem>
                <SelectItem value="van">Van</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-36">
            <label className="text-xs text-muted-foreground">Chauffeur</label>
            <Select value={hasDriver} onValueChange={(v) => { setHasDriver(v as string); setPage(1) }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="true">Avec chauffeur</SelectItem>
                <SelectItem value="false">Sans chauffeur</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Prix min</label>
            <Input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="w-28" placeholder="XAF" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Prix max</label>
            <Input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-28" placeholder="XAF" />
          </div>
          <div className="flex-1 min-w-40">
            <label className="text-xs text-muted-foreground">Recherche</label>
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input placeholder="Marque, modèle..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className="pl-9" /></div>
          </div>
        </div>
      </div>

      <Separator />
      {isLoading && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>}
      {error && <Alert variant="destructive"><TriangleAlert /><AlertTitle>Erreur</AlertTitle><AlertDescription>Impossible de charger les véhicules.</AlertDescription></Alert>}
      {data && data.items.length === 0 && (
        <Card><CardContent className="flex flex-col items-center gap-3 p-8 text-center"><div className="rounded-full bg-muted p-3"><Car className="size-6 text-muted-foreground" /></div><p className="text-sm text-muted-foreground">Aucun véhicule disponible — essayez d&apos;autres filtres.</p></CardContent></Card>
      )}
      {data && data.items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.items.map((v) => (
            <Link key={v.id} href={`/rentals/${v.id}`} className="group">
              <Card className="overflow-hidden hover:border-primary/30 transition-colors h-full">
                <div className="h-40 bg-muted relative overflow-hidden">
                  {v.photos?.[0] ? <img src={v.photos[0]} alt={`${v.make} ${v.model}`} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300" /> : <div className="flex items-center justify-center h-full text-muted-foreground"><Car className="size-8" /></div>}
                  {v.hasDriver && <span className="absolute top-2 left-2 rounded-full bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">Avec chauffeur</span>}
                </div>
                <CardContent className="p-4 space-y-2">
                  <h3 className="font-semibold">{v.make} {v.model} {v.year ? `· ${v.year}` : ""}</h3>
                  <p className="text-xs text-muted-foreground">{v.category} · {v.capacity} places · {v.pickupCity}{v.transmission ? ` · ${v.transmission}` : ""}</p>
                  <p className="text-sm font-bold">{new Intl.NumberFormat("fr-CM").format(v.pricePerUnit)} XAF / {v.durationUnit}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
      {data && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">Page {page} / {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="size-4" /></Button>
            <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="size-4" /></Button>
          </div>
        </div>
      )}
    </main>
  )
}
