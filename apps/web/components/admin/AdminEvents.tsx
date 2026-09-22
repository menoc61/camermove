"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useAuthStore } from "@camermove/frontend"
import { apiFetch } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "sonner"
import { Download, TriangleAlert } from "lucide-react"
import { priceXaf } from "@camermove/shared"
import {
  AdminDateRange,
  AdminFilterBar,
  AdminPagination,
  AdminSearch,
  AdminStatusSelect,
  AdminTableFrame,
  AdminTextField,
  SortableTh,
} from "./shared"

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

const EVENT_TYPE_OPTIONS = [
  { value: "concert", label: "Concert" },
  { value: "sport", label: "Sport" },
  { value: "conference", label: "Conférence" },
  { value: "theatre", label: "Théâtre" },
  { value: "festival", label: "Festival" },
  { value: "other", label: "Autre" },
]

export function AdminEvents() {
  const token = useAuthStore((s) => s.accessToken)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState("")
  const [cityFilter, setCityFilter] = useState("")
  const [eventTypeFilter, setEventTypeFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sort, setSort] = useState("startDate.asc")
  const onSort = (field: string) => { setSort((s) => (s === `${field}.asc` ? `${field}.desc` : `${field}.asc`)); setPage(1) }

  const params: Record<string, string> = { page: String(page), perPage: "20", sort }
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

  const { data: bookings, isLoading: bookingsLoading } = useQuery<{ items: EventBookingAdmin[]; total: number }>({
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
      toast.error("Erreur lors de l'export")
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Gestion des événements</h1>

      <AdminFilterBar>
        <AdminSearch placeholder="Nom, ville" value={q} onChange={(v) => { setQ(v); setPage(1) }} />
        <AdminTextField placeholder="Yaoundé" value={cityFilter} onChange={(v) => { setCityFilter(v); setPage(1) }} />
        <AdminStatusSelect value={eventTypeFilter} onChange={(v) => { setEventTypeFilter(v); setPage(1) }} options={EVENT_TYPE_OPTIONS} />
        <AdminDateRange
          dateFrom={dateFrom}
          dateTo={dateTo}
          onFrom={(v) => { setDateFrom(v); setPage(1) }}
          onTo={(v) => { setDateTo(v); setPage(1) }}
        />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
            <Download className="size-4" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("json")}>
            Export JSON
          </Button>
        </div>
      </AdminFilterBar>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      )}

      {error && (
        <Alert variant="destructive"><TriangleAlert /><AlertTitle>Erreur</AlertTitle><AlertDescription>Impossible de charger les événements.</AlertDescription></Alert>
      )}

      {events && events.items.length > 0 && (
        <AdminTableFrame>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTh label="Nom" field="name" sort={sort} onSort={onSort} />
                <SortableTh label="Ville" field="city" sort={sort} onSort={onSort} />
                <TableHead>Type</TableHead>
                <SortableTh label="Date" field="startDate" sort={sort} onSort={onSort} />
                <SortableTh label="Statut" field="status" sort={sort} onSort={onSort} />
                <TableHead>Billets</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.items.map((e) => {
                const sold = e.ticketCategories?.reduce((acc, c) => acc + c.sold, 0) ?? 0
                const quantity = e.ticketCategories?.reduce((acc, c) => acc + c.quantity, 0) ?? 0
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium line-clamp-1">{e.name}</TableCell>
                    <TableCell>{e.city}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[11px]">{e.eventType}</Badge></TableCell>
                    <TableCell className="text-sm">{new Date(e.startDate).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell><Badge variant={e.status === "sold_out" || e.status === "cancelled" ? "destructive" : "outline"}>{e.status}</Badge></TableCell>
                    <TableCell className="text-xs">{sold}/{quantity}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </AdminTableFrame>
      )}

      {events && (
        <AdminPagination
          page={page}
          totalPages={events.totalPages}
          total={events.total}
          totalLabel="événements"
          onPage={setPage}
        />
      )}

      {/* Bookings section */}
      <h2 className="pt-4 text-xl font-bold tracking-tight">Réservations</h2>

      {bookingsLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-md" />)}
        </div>
      )}

      {bookings && bookings.items.length > 0 && (
        <AdminTableFrame>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket #</TableHead>
                <TableHead>Événement</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Quantité</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.items.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">{b.ticketNumber}</TableCell>
                  <TableCell>{b.event.name}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[11px]">{b.ticketCategory?.name || ""}</Badge></TableCell>
                  <TableCell>{b.quantity}</TableCell>
                  <TableCell>{priceXaf(b.totalAmount)}</TableCell>
                  <TableCell><Badge variant={b.status === "paid" || b.status === "confirmed" ? "default" : "outline"}>{b.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminTableFrame>
      )}

      {bookings && bookings.items.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucune réservation.</p>
      )}
    </div>
  )
}
