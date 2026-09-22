"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useAuthStore } from "@camermove/frontend"
import { listBookings } from "@/lib/api/admin"
import { Button } from "@/components/ui/button"
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
import { toast } from "sonner"
import { DownloadIcon } from "lucide-react"
import {
  AdminDateRange,
  AdminEmptyRow,
  AdminFilterBar,
  AdminPagination,
  AdminSearch,
  AdminStatusSelect,
  AdminTableFrame,
  SortableTh,
  fmtDate,
} from "./shared"

const fmtTime = (d: string) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
/* Booking amounts are stored in minor units (cents) */
const fmtXafCents = (amount: number) =>
  (amount / 100).toLocaleString("fr-FR", { style: "currency", currency: "XAF", maximumFractionDigits: 0 })

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  confirmed: "default",
  pending_payment: "outline",
  cancelled: "destructive" as any,
  refunded: "secondary",
  completed: "default",
}

const STATUS_OPTIONS = ["confirmed", "pending_payment", "cancelled", "refunded", "completed"].map((s) => ({ value: s, label: s }))

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
  const [sort, setSort] = useState("createdAt.desc")
  const onSort = (field: string) => { setSort((s) => (s === `${field}.asc` ? `${field}.desc` : `${field}.asc`)); setPage(1) }
  const limit = 20

  const params: Record<string, string> = {
    page: String(page),
    limit: String(limit),
    sort,
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
      toast.error("Erreur lors de l'export")
    }
  }

  const totalPages = data?.totalPages ?? 1

  return (
    <div className="space-y-4">
      {/* Filters */}
      <AdminFilterBar>
        <AdminSearch
          placeholder="Référence, client..."
          value={search}
          onChange={(v) => { setSearch(v); setPage(1) }}
        />
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Statut</Label>
          <AdminStatusSelect value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1) }} options={STATUS_OPTIONS} />
        </div>
        <AdminDateRange
          dateFrom={dateFrom}
          dateTo={dateTo}
          onFrom={(v) => { setDateFrom(v); setPage(1) }}
          onTo={(v) => { setDateTo(v); setPage(1) }}
        />
        <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
          <DownloadIcon className="size-4 mr-1" /> Exporter CSV
        </Button>
      </AdminFilterBar>

      {/* Table */}
      <AdminTableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Trajet</TableHead>
              <TableHead>Départ</TableHead>
              <TableHead>Places</TableHead>
              <SortableTh label="Montant" field="totalAmount" sort={sort} onSort={onSort} />
              <SortableTh label="Statut" field="status" sort={sort} onSort={onSort} />
              <SortableTh label="Créé le" field="createdAt" sort={sort} onSort={onSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => <BookingRowSkeleton key={i} />)}
            {!isLoading && data?.items.length === 0 && (
              <AdminEmptyRow colSpan={8}>Aucune réservation trouvée.</AdminEmptyRow>
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
                <TableCell className="font-medium">{fmtXafCents(booking.totalAmount)}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[booking.status] ?? "outline"}>{booking.status}</Badge>
                </TableCell>
                <TableCell>{fmtDate(booking.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminTableFrame>

      {/* Pagination */}
      <AdminPagination
        page={page}
        totalPages={totalPages}
        total={data?.total}
        totalLabel="réservations"
        onPage={setPage}
      />
    </div>
  )
}
