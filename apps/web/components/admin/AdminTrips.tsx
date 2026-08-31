"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuthStore } from "@camermove/frontend"
import { listTrips, updateTrip } from "@/lib/api/admin"
import type { TripItem } from "@/lib/api/admin"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR")
const fmtTime = (d: string) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
const fmtXaf = (amount: number) =>
  (amount / 100).toLocaleString("fr-FR", { style: "currency", currency: "XAF", maximumFractionDigits: 0 })
const fmtNum = (n: number) => n.toLocaleString("fr-FR")

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  inactive: "secondary",
  cancelled: "destructive" as any,
}

const STATUSES = ["active", "inactive", "cancelled"]

function TripRowSkeleton() {
  return (
    <TableRow>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableCell key={i}><Skeleton className="h-4 w-24" /></TableCell>
      ))}
    </TableRow>
  )
}

export function AdminTrips() {
  const token = useAuthStore((s) => s.accessToken)
  const qc = useQueryClient()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const [editingPrice, setEditingPrice] = useState<TripItem | null>(null)
  const [newPrice, setNewPrice] = useState("")
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
    queryKey: ["admin-trips", params],
    queryFn: () => listTrips(token!, params),
    enabled: !!token,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      updateTrip(token!, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-trips"] })
      toast.success("Trajet mis à jour")
      setEditingPrice(null)
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  })

  const handlePriceEdit = (trip: TripItem) => {
    setEditingPrice(trip)
    setNewPrice(String(trip.price / 100))
  }

  const handlePriceSave = () => {
    if (!editingPrice) return
    const priceInCents = Math.round(parseFloat(newPrice) * 100)
    if (isNaN(priceInCents) || priceInCents <= 0) {
      toast.error("Prix invalide")
      return
    }
    updateMutation.mutate({ id: editingPrice.id, data: { price: priceInCents } })
  }

  const totalPages = data?.totalPages ?? 1

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher trajet, transporteur..."
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
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
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
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Route</TableHead>
              <TableHead>Transporteur</TableHead>
              <TableHead>Départ</TableHead>
              <TableHead>Prix</TableHead>
              <TableHead>Places</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Réservations</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => <TripRowSkeleton key={i} />)}
            {!isLoading && data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Aucun trajet trouvé.
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.items.map((trip) => (
              <TableRow key={trip.id}>
                <TableCell className="font-medium">
                  {trip.route.originCity} → {trip.route.destinationCity}
                </TableCell>
                <TableCell>{trip.transport.companyName}</TableCell>
                <TableCell>
                  <div>{fmtDate(trip.departureAt)}</div>
                  <div className="text-xs text-muted-foreground">{fmtTime(trip.departureAt)}</div>
                </TableCell>
                <TableCell>
                  {editingPrice?.id === trip.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        className="w-24"
                        step="0.01"
                      />
                      <Button size="sm" variant="outline" onClick={handlePriceSave} disabled={updateMutation.isPending}>
                        OK
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingPrice(null)}>✕</Button>
                    </div>
                  ) : (
                    <button className="hover:underline text-left" onClick={() => handlePriceEdit(trip)}>
                      {fmtXaf(trip.price)}
                    </button>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground">
                    {trip.seatAvailability?.seatsBooked ?? 0}/{trip.totalSeats}
                  </span>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <span className="cursor-pointer rounded border border-transparent px-1.5 py-0.5 text-xs font-medium hover:bg-muted">
                        <Badge variant={statusVariant[trip.status] ?? "outline"}>{trip.status}</Badge>
                      </span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {STATUSES.map((s) => (
                        <DropdownMenuItem key={s} onClick={() => updateMutation.mutate({ id: trip.id, data: { status: s } })}>
                          {s}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
                <TableCell>{fmtNum(trip._count.bookings)}</TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">{trip.vehicleTypeInfo ?? ""}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data ? `${fmtNum(data.total)} trajets` : ""}
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
