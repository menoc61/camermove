"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useAuthStore } from "@camermove/frontend"
import { apiFetch } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Calendar, Download, TriangleAlert } from "lucide-react"

interface EventAdmin {
  id: string
  name: string
  venue: string
  city: string
  startDate: string
  endDate: string | null
  eventType: string
  status: string
  posterUrl: string | null
  ticketCategories: Array<{ id: string; quantity: number; sold: number }>
}

interface EventBookingAdmin {
  id: string
  ticketNumber: string
  event: { id: string; name: string; startDate: string }
  ticketCategory: { id: string; name: string } | null
  quantity: number
  totalAmount: number
  status: string
  createdAt: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

export function AdminEvents() {
  const token = useAuthStore((s) => s.accessToken)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState("")
  const [cityFilter, setCityFilter] = useState("")
  const [eventTypeFilter, setEventTypeFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const params: Record<string, string> = { page: String(page), perPage: "20" }
  if (q) params.q = q
  if (cityFilter) params.city = cityFilter
  if (eventTypeFilter) params.eventType = eventTypeFilter
  if (dateFrom) params.dateFrom = dateFrom
  if (dateTo) params.dateTo = dateTo

  const { data: events, isLoading, error } = useQuery<{ items: EventAdmin[]; total: number; page: number; totalPages: number }>({
    queryKey: ["admin-events", params],
    queryFn: () => apiFetch(`/api/v1/admin/events?${new URLSearchParams(params).toString()}`, { method: "GET", token: token! }),
    enabled: !!token,
  })

  const { data: bookings } = useQuery<{ items: EventBookingAdmin[]; total: number }>({
    queryKey: ["admin-event-bookings"],
    queryFn: () => apiFetch("/api/v1/admin/event-bookings?perPage=20", { method: "GET", token: token! }),
    enabled: !!token,
  })

  const handleExport = async (format: "csv" | "json") => {
    if (!token) return
    const exportParams = new URLSearchParams({
      format,
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(q ? { q } : {}),
    })
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/events/export?${exportParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error("Export failed")
      const blob = await res.blob()
      const dlUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = dlUrl
      a.download = `export-events-${new Date().toISOString().slice(0, 10)}.${format}`
      a.click()
      URL.revokeObjectURL(dlUrl)
    } catch {
      console.error("Export failed")
    }
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Gestion des événements</h1>

      <div className="rounded-xl border bg-card p-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-40">
          <label className="text-xs text-muted-foreground">Recherche</label>
          <Input placeholder="Nom, ville" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        </div>
        <div className="min-w-32">
          <label className="text-xs text-muted-foreground">Ville</label>
          <Input placeholder="Yaoundé" value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); setPage(1) }} />
        </div>
        <div className="min-w-36">
          <label className="text-xs text-muted-foreground">Type</label>
          <Select value={eventTypeFilter || "all"} onValueChange={(v) => { setEventTypeFilter(v === "all" || v == null ? "" : v); setPage(1) }}>
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
        <div>
          <label className="text-xs text-muted-foreground">Du</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Au</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
            <Download className="size-4" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("json")}>
            Export JSON
          </Button>
        </div>
      </div>

      <Separator />

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      )}

      {error && (
        <Alert variant="destructive"><TriangleAlert /><AlertTitle>Erreur</AlertTitle><AlertDescription>Impossible de charger les événements.</AlertDescription></Alert>
      )}

      {events && events.items.length === 0 && (
        <Card><CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="rounded-full bg-muted p-3"><Calendar className="size-6 text-muted-foreground" /></div>
          <p className="text-sm text-muted-foreground">Aucun événement trouvé.</p>
        </CardContent></Card>
      )}

      {events && events.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                <th className="px-3 py-2">Nom</th>
                <th className="px-3 py-2">Ville</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2">Billets</th>
              </tr>
            </thead>
            <tbody>
              {events.items.map((e) => {
                const sold = e.ticketCategories?.reduce((acc, c) => acc + c.sold, 0) ?? 0
                const quantity = e.ticketCategories?.reduce((acc, c) => acc + c.quantity, 0) ?? 0
                return (
                  <tr key={e.id} className="border-b">
                    <td className="px-3 py-2 font-medium line-clamp-1">{e.name}</td>
                    <td className="px-3 py-2">{e.city}</td>
                    <td className="px-3 py-2"><Badge variant="secondary" className="text-[11px]">{e.eventType}</Badge></td>
                    <td className="px-3 py-2 text-sm">{new Date(e.startDate).toLocaleDateString("fr-FR")}</td>
                    <td className="px-3 py-2"><Badge variant={e.status === "sold_out" || e.status === "cancelled" ? "destructive" : "outline"}>{e.status}</Badge></td>
                    <td className="px-3 py-2 text-xs">{sold}/{quantity}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {events && events.totalPages > 1 && (
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">{events.total} événements</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Préc</Button>
            <span className="text-sm py-1">Page {page} / {events.totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= events.totalPages} onClick={() => setPage((p) => p + 1)}>Suiv</Button>
          </div>
        </div>
      )}

      {/* Bookings section */}
      <Separator />
      <h2 className="text-xl font-bold tracking-tight">Réservations</h2>

      {bookings && bookings.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                <th className="px-3 py-2">Ticket #</th>
                <th className="px-3 py-2">Événement</th>
                <th className="px-3 py-2">Catégorie</th>
                <th className="px-3 py-2">Quantité</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {bookings.items.map((b) => (
                <tr key={b.id} className="border-b">
                  <td className="px-3 py-2 font-mono text-xs">{b.ticketNumber}</td>
                  <td className="px-3 py-2">{b.event.name}</td>
                  <td className="px-3 py-2"><Badge variant="secondary" className="text-[11px]">{b.ticketCategory?.name || ""}</Badge></td>
                  <td className="px-3 py-2">{b.quantity}</td>
                  <td className="px-3 py-2">{new Intl.NumberFormat("fr-CM").format(b.totalAmount)} XAF</td>
                  <td className="px-3 py-2"><Badge variant={b.status === "paid" || b.status === "confirmed" ? "default" : "outline"}>{b.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bookings && bookings.items.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucune réservation.</p>
      )}
    </main>
  )
}
