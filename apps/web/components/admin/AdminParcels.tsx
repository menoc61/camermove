"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuthStore } from "@camermove/frontend"
import { apiFetch } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "sonner"
import { Download, TriangleAlert } from "lucide-react"
import { priceXaf } from "@camermove/shared"
import {
  AdminDateRange,
  AdminEmptyRow,
  AdminFilterBar,
  AdminPagination,
  AdminSearch,
  AdminStatusSelect,
  AdminTableFrame,
  AdminTextField,
  SortableTh,
} from "./shared"

interface ParcelAdmin {
  id: string
  trackingNumber: string
  senderName: string
  senderCity: string
  recipientName: string
  recipientCity: string
  status: string
  currentLocation: string | null
  shippingCost: number
  createdAt: string
}

const NEXT_STATUSES: Record<string, string[]> = {
  registered: ["picked_up"],
  picked_up: ["in_transit"],
  in_transit: ["arrived"],
  arrived: ["available_for_pickup"],
  available_for_pickup: ["delivered"],
  delivered: [],
}

const STATUS_LABELS: Record<string, string> = {
  registered: "Enregistré",
  picked_up: "Pris en charge",
  in_transit: "En transit",
  arrived: "Arrivé",
  available_for_pickup: "Disponible",
  delivered: "Livré",
}

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

export function AdminParcels() {
  const token = useAuthStore((s) => s.accessToken)
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [q, setQ] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [recipientCity, setRecipientCity] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sort, setSort] = useState("createdAt.desc")
  const onSort = (field: string) => { setSort((s) => (s === `${field}.asc` ? `${field}.desc` : `${field}.asc`)); setPage(1) }

  const params: Record<string, string> = { page: String(page), perPage: "20", sort }
  if (q) params.q = q
  if (statusFilter) params.status = statusFilter
  if (recipientCity) params.recipientCity = recipientCity
  if (dateFrom) params.dateFrom = dateFrom
  if (dateTo) params.dateTo = dateTo

  const { data, isLoading, error } = useQuery<{ items: ParcelAdmin[]; total: number; page: number; totalPages: number }>({
    queryKey: ["admin-parcels", params],
    // GET /admin/parcels (admin-only list, same envelope)
    queryFn: () => apiFetch(`/api/v1/admin/parcels?${new URLSearchParams(params).toString()}`, { method: "GET", token: token! }),
    enabled: !!token,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: string }) =>
      apiFetch(`/api/v1/admin/parcels/${id}/status`, {
        method: "PATCH",
        token: token!,
        body: JSON.stringify({ status: nextStatus }),
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-parcels"] })
      toast.success("Statut mis à jour")
    },
    onError: () => toast.error("Transition de statut refusée"),
  })

  const handleExport = async (format: "csv" | "json") => {
    if (!token) return
    const exportParams = new URLSearchParams({
      format,
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(q ? { q } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(recipientCity ? { recipientCity } : {}),
    })
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/parcels/export?${exportParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error("Export failed")
      const blob = await res.blob()
      const dlUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = dlUrl
      a.download = `export-parcels-${new Date().toISOString().slice(0, 10)}.${format}`
      a.click()
      URL.revokeObjectURL(dlUrl)
    } catch {
      toast.error("Erreur lors de l'export")
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Gestion des colis</h1>

      <AdminFilterBar>
        <AdminSearch
          placeholder="Tracking, nom expéditeur/destinataire"
          value={q}
          onChange={(v) => { setQ(v); setPage(1) }}
        />
        <AdminStatusSelect value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1) }} options={STATUS_OPTIONS} />
        <AdminTextField placeholder="Douala" value={recipientCity} onChange={(v) => { setRecipientCity(v); setPage(1) }} />
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
        <Alert variant="destructive"><TriangleAlert /><AlertTitle>Erreur</AlertTitle><AlertDescription>Impossible de charger les colis.</AlertDescription></Alert>
      )}

      {data && data.items.length === 0 && (
        <AdminTableFrame>
          <Table>
            <TableBody>
              <AdminEmptyRow colSpan={7}>Aucun colis trouvé.</AdminEmptyRow>
            </TableBody>
          </Table>
        </AdminTableFrame>
      )}

      {data && data.items.length > 0 && (
        <AdminTableFrame>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTh label="Tracking" field="trackingNumber" sort={sort} onSort={onSort} />
                <TableHead>Expéditeur</TableHead>
                <TableHead>Destinataire</TableHead>
                <SortableTh label="Trajet" field="recipientCity" sort={sort} onSort={onSort} />
                <SortableTh label="Statut" field="status" sort={sort} onSort={onSort} />
                <SortableTh label="Coût" field="shippingCost" sort={sort} onSort={onSort} />
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((p) => {
                const next = NEXT_STATUSES[p.status]?.[0]
                return (
                  <TableRow key={p.id}>
                    <TableCell><Link href={`/parcels/track/${p.trackingNumber}`} className="font-mono text-xs underline underline-offset-4">{p.trackingNumber}</Link></TableCell>
                    <TableCell>{p.senderName}</TableCell>
                    <TableCell>{p.recipientName}</TableCell>
                    <TableCell>{p.senderCity} → {p.recipientCity}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "delivered" ? "default" : "outline"}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{priceXaf(p.shippingCost)}</TableCell>
                    <TableCell>
                      {next && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ id: p.id, nextStatus: next })}
                        >
                          → {STATUS_LABELS[next] ?? next}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </AdminTableFrame>
      )}

      {data && (
        <AdminPagination
          page={page}
          totalPages={data.totalPages}
          total={data.total}
          totalLabel="colis"
          onPage={setPage}
        />
      )}
    </div>
  )
}
