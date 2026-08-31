"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useAuthStore } from "@camermove/frontend"
import { listBookings } from "@/lib/api/admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from "lucide-react"

const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR")
const fmtTime = (d: string) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
const fmtXaf = (amount: number) =>
  (amount / 100).toLocaleString("fr-FR", { style: "currency", currency: "XAF", maximumFractionDigits: 0 })
const fmtNum = (n: number) => n.toLocaleString("fr-FR")

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  confirmed: "default",
  pending_payment: "outline",
  cancelled: "destructive" as any,
  refunded: "secondary",
  completed: "default",
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

function BookingRowSkeleton() {
  return (
    <TableRow>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableCell key={i}><Skeleton className="h-4 w-20" /></TableCell>
      ))}
    </TableRow>
  )
}

export function AdminBookings() {
  const token = useAuthStore((s) => s.accessToken)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const limit = 20

  const params: Record<string, string> = {
    page: String(page),
    limit: String(limit),
  }
  if (search) params.q = search
  if (statusFilter) params.status = statusFilter
  if (dateFrom) params.dateFrom = dateFrom
  if (dateTo) params.dateTo = dateTo

  const { data, isLoading } = useQuery({
    queryKey: ["admin-bookings", params],
    queryFn: () => listBookings(token!, params),
    enabled: !!token,
  })

  const handleExport = async (format: "csv" | "json") => {
    const exportParams = new URLSearchParams({
      dateFrom: dateFrom || "",
      dateTo: dateTo || "",
      format,
      ...(statusFilter ? { status: statusFilter } : {}),
    })
    const url = `${API_URL}/api/v1/admin/bookings/export?${exportParams.toString()}`
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error("Export failed")
      const blob = await res.blob()
      const dlUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = dlUrl
      a.download = `export-bookings-${new Date().toISOString().slice(0, 10)}.${format}`
      a.click()
      URL.revokeObjectURL(dlUrl)
    } catch {
      console.error("Export failed")
    }
  }

  const totalPages = data?.totalPages ?? 1

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Référence, client..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Statut</Label>
          <select
            className="h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          >
            <option value="">Tous</option>
            {["confirmed", "pending_payment", "cancelled", "refunded", "completed"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Du</Label>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className="w-36" />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Au</Label>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className="w-36" />
        </div>
        <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
          <DownloadIcon className="size-4 mr-1" /> Exporter CSV
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Trajet</TableHead>
              <TableHead>Départ</TableHead>
              <TableHead>Places</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Créé le</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => <BookingRowSkeleton key={i} />)}
            {!isLoading && data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Aucune réservation trouvée.
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.items.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell className="font-mono text-sm font-medium">{booking.reference}</TableCell>
                <TableCell>
                  <div>{booking.user.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {booking.passengers.map((p) => p.fullName).join(", ")}
                  </div>
                </TableCell>
                <TableCell>
                  {booking.trip.route.originCity} → {booking.trip.route.destinationCity}
                  <div className="text-xs text-muted-foreground">{booking.trip.transport.companyName}</div>
                </TableCell>
                <TableCell>
                  <div>{fmtDate(booking.trip.departureAt)}</div>
                  <div className="text-xs text-muted-foreground">{fmtTime(booking.trip.departureAt)}</div>
                </TableCell>
                <TableCell>{booking.seatCount}</TableCell>
                <TableCell className="font-medium">{fmtXaf(booking.totalAmount)}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[booking.status] ?? "outline"}>{booking.status}</Badge>
                </TableCell>
                <TableCell>{fmtDate(booking.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data ? `${fmtNum(data.total)} réservations` : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <span className="text-sm">Page {page} / {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
