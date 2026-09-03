"use client"

import { useState, useEffect, useCallback } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Calendar, Search, Ticket, Piano, Guitar, Sport, Festival,} from "lucide-react"
import { useSearchParams } from "next/navigation"

interface EventAdmin {
  id: string
  name: string
  venue: string
  city: string
  startDate: string
  endDate: string | null
  eventType: string
  status: string
  sold: number
  quantity: number
  posterUrl: string | null
}

interface EventStatusUpdate {
  status: string
}

interface EventBookingAdmin {
  id: string
  ticketNumber: string
  event: EventAdmin
  ticketCategory: any
  quantity: number
  totalAmount: number
  status: string
  createdAt: string
}

export function AdminEvents() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [q, setQ] = useState("")
  const [cityFilter, setCityFilter] = useState("")
  const [eventTypeFilter, setEventTypeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv")

  const { data: events, isLoading, error, pagination } = useQuery({
    queryKey: ["admin-events", page, limit, q, cityFilter, eventTypeFilter, statusFilter],
    queryFn: async () => {
      const query: URLSearchParams = new URLSearchParams()
      if (q) query.append("q", q)
      if (cityFilter) query.append("city", cityFilter)
      if (eventTypeFilter) query.append("eventType", eventTypeFilter)
      if (statusFilter) query.append("status", statusFilter)
      query.append("page", String(page))
      query.append("limit", String(limit))
      query.append("format", exportFormat)

      const res = await apiFetch<{ items: EventAdmin[]; total: number; page: number; totalPages: number }>(
        `/api/v1/admin/events?${query.toString()}`,
        { method: "GET" }
      )
      return res
    },
    keepPreviousData: true,
  })

  const { mutate: updateEventStatus, isPending } = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiFetch(`/api/v1/admin/events/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      })
    },
  })

  const handleExport = () => {
    const params = new URLSearchParams()
    params.append("dateFrom", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
    params.append("dateTo", new Date().toISOString().split("T")[0])
    params.append("format", exportFormat)
    window.location.href = `/api/v1/admin/events/export?${params.toString()}`
  }

  const { data: bookings, isLoading: bLoading } = useQuery({
    queryKey: ["admin-event-bookings", page, limit],
    queryFn: async () => {
      const res = await apiFetch<{ items: EventBookingAdmin[]; total: number }>(
        `/api/v1/admin/event-bookings?page=1&limit=${limit}`,
        { method: "GET" }
      )
      return res
    },
    keepPreviousData: true,
  })

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Gestion des événements</h1>

      <Separator />

      {/* Filters and Export */}
      <div className="rounded-xl border bg-card p-4 flex flex-wrap gap-4 items-end">
        <div className="min-w-40">
          <label className="text-xs text-muted-foreground">Recherche</label>
          <Input
            placeholder="Nom, ville, type"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Ville</label>
          <Input
            placeholder="Yaoundé"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Type</label>
          <Select value={eventTypeFilter} onValueChange={(v) => setEventTypeFilter(v as string)}>
            <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tous</SelectItem>
              <SelectItem value="concert">Concert</SelectItem>
              <SelectItem value="sport">Sport</SelectItem>
              <SelectItem value="conference">Conférence</SelectItem>
              <SelectItem value="theatre">Théâtre</SelectItem>
              <SelectItem value="festival">Festival</SelectItem>
              <SelectItem value="other">Autre</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Statut</label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as string)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tous</SelectItem>
              <SelectItem value="on_sale">En vente</SelectItem>
              <SelectItem value="limited">Limité</SelectItem>
              <SelectItem value="sold_out">Sold-out</SelectItem>
              <SelectItem value="cancelled">Annulé</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleExport}>
            <XMark className="size-4" /> Exporter
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setLimit((l) => l === 20 ? 50 : 20)}>
            {limit === 20 ? "50" : "20"}
          </Button>
        </div>
      </div>

      <Separator />

      {/* Events Table */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      )}

      {error && (
        <Alert variant="destructive"><TriangleAlert /><AlertTitle>Erreur</AlertTitle><AlertDescription>Impossible de charger les événements.</AlertDescription></Alert>
      )}

      {events && events.length > 0 && (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Headers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 bg-muted/30 py-2 text-xs font-medium text-slate-400">
              <div>Nom</div>
              <div>Ville</div>
              <div>Type</div>
              <div>Date</div>
              <div>Statut</div>
              <div>Billets</div>
            </div>

            {/* Rows */}
            {events.map((e) => (
              <div
                key={e.id}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 py-2 border-b border-slate-200"
              >
                <div>
                  <p className="font-medium line-clamp-1">{e.name}</p>
                </div>
                <div>{e.city}</div>
                <div>
                  <Badge variant="secondary" className="text-[11px]">
                    {e.eventType}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm">
                    {e.startDate}{e.endDate ? ` - ${e.endDate}` : ""}
                  </p>
                </div>
                <div>
                  <Badge variant={getEventStatusVariant(e.status)} className="text-xs">
                    {e.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-xs">
                    {e.sold}/{e.quantity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {events && events.length === 0 && (
        <Card><CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="rounded-full bg-muted p-3"><Calendar className="size-6 text-muted-foreground" /></div>
          <p className="text-sm text-muted-foreground">Aucun événement trouvé.</p>
        </CardContent></Card>
      )}

      {/* Bookings section */}
      <Separator />
      <h2 className="text-font-bold tracking-tight">Réservations</h2>

      {bookings && bookings.items.length > 0 && (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Headers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 bg-muted/30 py-2 text-xs font-medium text-slate-400">
              <div>Ticket #</div>
              <div>Événement</div>
              <div>Catégorie</div>
              <div>Quantité</div>
              <div>Total</div>
              <div>Date</div>
            </div>

            {/* Rows */}
            {bookings.items.map((b) => (
              <div
                key={b.id}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 py-2 border-b border-slate-200"
              >
                <div>
                  <p className="font-mono text-sm">{b.ticketNumber}</p>
                </div>
                <div>{b.event.name}</div>
                <div>
                  <Badge variant="secondary" className="text-[11px]">
                    {b.ticketCategory?.name || ""}
                  </Badge>
                </div>
                <div>
                  <span className="font-mono text-sm">{b.quantity}</span>
                </div>
                <div>{b.totalAmount} XAF</div>
                <div>
                  <p className="text-sm">{b.event.startDate}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {bookings && bookings.items.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucune réservation.</p>
      )}
    </main>
  )
}

function getEventStatusVariant(status: string) {
  const map: Record<string, "default" | "destructive" | "primary" | "secondary" | "success"> = {
    on_sale: "default",
    limited: "secondary",
    sold_out: "destructive",
    cancelled: "default",
  }
  return map[status] || "default"
}