"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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
import { toast } from "sonner"
import { Download, Truck, TriangleAlert } from "lucide-react"

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

  const params: Record<string, string> = { page: String(page), perPage: "20" }
  if (q) params.q = q
  if (statusFilter) params.status = statusFilter
  if (recipientCity) params.recipientCity = recipientCity
  if (dateFrom) params.dateFrom = dateFrom
  if (dateTo) params.dateTo = dateTo

  const { data, isLoading, error } = useQuery<{ items: ParcelAdmin[]; total: number; page: number; totalPages: number }>({
    queryKey: ["admin-parcels", params],
    // GET /parcels returns all parcels for admin/super_admin roles
    queryFn: () => apiFetch(`/api/v1/parcels?${new URLSearchParams(params).toString()}`, { method: "GET", token: token! }),
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
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Gestion des colis</h1>

      <div className="rounded-xl border bg-card p-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-48">
          <label className="text-xs text-muted-foreground">Recherche</label>
          <Input placeholder="Tracking, nom expéditeur/destinataire" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        </div>
        <div className="min-w-40">
          <label className="text-xs text-muted-foreground">Statut</label>
          <Select value={statusFilter || "all"} onValueChange={(v) => { setStatusFilter(v === "all" || v == null ? "" : v); setPage(1) }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="registered">Enregistré</SelectItem>
              <SelectItem value="picked_up">Pris en charge</SelectItem>
              <SelectItem value="in_transit">En transit</SelectItem>
              <SelectItem value="arrived">Arrivé</SelectItem>
              <SelectItem value="available_for_pickup">Disponible</SelectItem>
              <SelectItem value="delivered">Livré</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-32">
          <label className="text-xs text-muted-foreground">Ville destinataire</label>
          <Input placeholder="Douala" value={recipientCity} onChange={(e) => { setRecipientCity(e.target.value); setPage(1) }} />
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
        <Alert variant="destructive"><TriangleAlert /><AlertTitle>Erreur</AlertTitle><AlertDescription>Impossible de charger les colis.</AlertDescription></Alert>
      )}

      {data && data.items.length === 0 && (
        <Card><CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="rounded-full bg-muted p-3"><Truck className="size-6 text-muted-foreground" /></div>
          <p className="text-sm text-muted-foreground">Aucun colis trouvé.</p>
        </CardContent></Card>
      )}

      {data && data.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                <th className="px-3 py-2">Tracking</th>
                <th className="px-3 py-2">Expéditeur</th>
                <th className="px-3 py-2">Destinataire</th>
                <th className="px-3 py-2">Trajet</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2">Coût</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => {
                const next = NEXT_STATUSES[p.status]?.[0]
                return (
                  <tr key={p.id} className="border-b">
                    <td className="px-3 py-2 font-mono text-xs">{p.trackingNumber}</td>
                    <td className="px-3 py-2">{p.senderName}</td>
                    <td className="px-3 py-2">{p.recipientName}</td>
                    <td className="px-3 py-2">{p.senderCity} → {p.recipientCity}</td>
                    <td className="px-3 py-2">
                      <Badge variant={p.status === "delivered" ? "default" : "outline"}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{new Intl.NumberFormat("fr-CM").format(p.shippingCost)} XAF</td>
                    <td className="px-3 py-2">
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
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">{data.total} colis</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Préc</Button>
            <span className="text-sm py-1">Page {page} / {data.totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Suiv</Button>
          </div>
        </div>
      )}
    </main>
  )
}
