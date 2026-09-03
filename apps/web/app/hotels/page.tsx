"use client"
import { useState, useCallback } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { fetchHotels, type HotelsParams } from "@/lib/api/hotels"
import { Stepper } from "@/components/ui/stepper"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Bed, Search, ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react"

export default function HotelsPage() {
  const [city, setCity] = useState("")
  const [checkIn, setCheckIn] = useState("")
  const [checkOut, setCheckOut] = useState("")
  const [guests, setGuests] = useState(2)
  const [minPrice, setMinPrice] = useState<string>("")
  const [maxPrice, setMaxPrice] = useState<string>("")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)

  const params: HotelsParams = {
    city: city || undefined,
    checkIn: checkIn || undefined,
    checkOut: checkOut || undefined,
    guests,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    q: q || undefined,
    page,
    perPage: 12,
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["hotels", params],
    queryFn: () => fetchHotels(params),
  })

  const totalPages = data?.totalPages ?? 1

  const onQChange = useCallback((v: string) => {
    setQ(v)
    setPage(1)
  }, [])

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Hôtels & apparts</h1>
        {data && <Badge variant="outline">{data.total} résultats</Badge>}
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-40">
            <label className="text-xs text-muted-foreground">Ville</label>
            <Input placeholder="Yaoundé" value={city} onChange={(e) => { setCity(e.target.value); setPage(1) }} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Arrivée</label>
            <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Départ</label>
            <Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Voyageurs</label>
            <Stepper value={guests} min={1} max={10} onChange={(n) => setGuests(n)} label="voyageurs" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Prix min</label>
            <Input type="number" placeholder="XAF" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="w-28" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Prix max</label>
            <Input type="number" placeholder="XAF" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-28" />
          </div>
          <div className="flex-1 min-w-40">
            <label className="text-xs text-muted-foreground">Recherche</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Nom, équipements..." value={q} onChange={(e) => onQChange(e.target.value)} className="pl-9" />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      )}

      {error && (
        <Alert variant="destructive"><TriangleAlert /><AlertTitle>Erreur</AlertTitle><AlertDescription>Impossible de charger les hôtels.</AlertDescription></Alert>
      )}

      {data && data.items.length === 0 && (
        <Card><CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="rounded-full bg-muted p-3"><Bed className="size-6 text-muted-foreground" /></div>
          <p className="text-sm text-muted-foreground">Aucun hôtel trouvé — essayez une autre ville ou prix.</p>
        </CardContent></Card>
      )}

      {data && data.items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.items.map((h) => (
            <Link key={h.id} href={`/hotels/${h.id}`} className="group">
              <Card className="overflow-hidden hover:border-primary/30 transition-colors h-full">
                <div className="h-40 bg-muted relative overflow-hidden">
                  {h.photos?.[0] ? <img src={h.photos[0]} alt={h.name} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300" /> : <div className="flex items-center justify-center h-full text-muted-foreground"><Bed className="size-8" /></div>}
                  {h.starRating && <span className="absolute top-2 right-2 rounded-full bg-white px-2 py-1 text-xs font-semibold shadow">★ {h.starRating}</span>}
                </div>
                <CardContent className="p-4 space-y-2">
                  <h3 className="font-semibold line-clamp-1">{h.name}</h3>
                  <p className="text-xs text-muted-foreground">{h.city}{h.region ? ` · ${h.region}` : ""}</p>
                  <div className="flex flex-wrap gap-1">
                    {h.amenities.slice(0, 3).map((a) => <Badge key={a} variant="secondary" className="text-[11px]">{a}</Badge>)}
                  </div>
                  <p className="text-sm font-bold">{h.rooms?.[0] ? `${new Intl.NumberFormat("fr-CM").format(h.rooms[0].pricePerNight)} XAF / nuit` : "Voir disponibilités"}</p>
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
