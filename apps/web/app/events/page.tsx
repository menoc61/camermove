"use client"
import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { fetchEvents } from "@/lib/api/events"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Search, Ticket, ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react"

export default function EventsPage() {
  const [filterCity, setFilterCity] = useState("")
  const [filterEventType, setFilterEventType] = useState("")
  const [filterQ, setFilterQ] = useState("")
  const [page, setPage] = useState(1)

  const params = {
    city: filterCity || undefined,
    eventType: filterEventType || undefined,
    q: filterQ || undefined,
    page,
    perPage: 12,
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["events", params],
    queryFn: () => fetchEvents(undefined, params),
  })

  const events = data?.items
  const totalPages = data?.totalPages ?? 1

  return (
    <main className="mx-auto max-w-6xl px-6 pb-6 pt-24 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Billetterie — Événements</h1>
        {data && <Badge variant="outline">{data.total} événements</Badge>}
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-40">
            <label className="text-xs text-muted-foreground">Ville</label>
            <Input
              placeholder="Yaoundé"
              value={filterCity}
              onChange={(e) => { setFilterCity(e.target.value); setPage(1) }}
            />
          </div>
          <div className="min-w-40">
            <label className="text-xs text-muted-foreground">Type</label>
            <Select value={filterEventType || "all"} onValueChange={(v) => { setFilterEventType(v === "all" || v == null ? "" : v); setPage(1) }}>
              <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="concert">Concert</SelectItem>
                <SelectItem value="sport">Sport</SelectItem>
                <SelectItem value="conference">Conférence</SelectItem>
                <SelectItem value="theatre">Théâtre</SelectItem>
                <SelectItem value="festival">Festival</SelectItem>
                <SelectItem value="other">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-40">
            <label className="text-xs text-muted-foreground">Recherche</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Nom, artiste, lieu..." value={filterQ} onChange={(e) => { setFilterQ(e.target.value); setPage(1) }} className="pl-9" />
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
        <Alert variant="destructive"><TriangleAlert /><AlertTitle>Erreur</AlertTitle><AlertDescription>Impossible de charger les événements.</AlertDescription></Alert>
      )}

      {events && events.length === 0 && (
        <Card><CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="rounded-full bg-muted p-3"><Calendar className="size-6 text-muted-foreground" /></div>
          <p className="text-sm text-muted-foreground">Aucun événement trouvé — essayez d&apos;autres filtres.</p>
        </CardContent></Card>
      )}

      {events && events.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((e) => {
            const categories = e.ticketCategories ?? []
            const minPrice = categories.length > 0 ? Math.min(...categories.map((c) => c.price)) : null
            return (
              <Link key={e.id} href={`/events/${e.id}`} className="group">
                <Card className="overflow-hidden hover:border-primary/30 transition-colors h-full">
                  <div className="h-40 bg-muted relative overflow-hidden">
                    {e.posterUrl ? (
                      <img
                        src={e.posterUrl}
                        alt={e.name}
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <Ticket className="size-8" />
                      </div>
                    )}
                    {e.eventType && (
                      <span className="absolute top-2 right-2 rounded-full bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
                        {e.eventType}
                      </span>
                    )}
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <h3 className="font-semibold line-clamp-1">{e.name}</h3>
                    <p className="text-xs text-muted-foreground">{e.venue}, {e.city}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(e.startDate).toLocaleDateString("fr-FR")}{e.endDate ? ` - ${new Date(e.endDate).toLocaleDateString("fr-FR")}` : ""}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {categories.slice(0, 3).map((c) => (
                        <Badge key={c.id} variant="secondary" className="text-[11px]">
                          {c.name}: {Math.max(0, c.quantity - c.sold)} places
                        </Badge>
                      ))}
                    </div>
                    {minPrice != null && (
                      <p className="text-sm font-bold">
                        {new Intl.NumberFormat("fr-CM").format(minPrice)} XAF min
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </main>
  )
}
