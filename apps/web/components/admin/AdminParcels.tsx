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
import { XMark, Truck, CheckCircle, Calendar, Mail,} from "lucide-react"
import { useSearchParams } from "next/navigation"

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
  statusHistory: Array<{ status: string; location: string; note: string; createdAt: string }>
}

interface ParcelStatusUpdate {
  status: string
  location?: string
  note?: string
}

export function AdminParcels() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [q, setQ] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [recipientCity, setRecipientCity] = useState("")
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv")

  const { data: parcels, isLoading, error, pagination } = useQuery({
    queryKey: ["admin-parcels", page, limit, q, statusFilter, recipientCity],
    queryFn: async () => {
      const query: URLSearchParams = new URLSearchParams()
      if (q) query.append("q", q)
      if (statusFilter) query.append("status", statusFilter)
      if (recipientCity) query.append("recipientCity", recipientCity)
      query.append("page", String(page))
      query.append("limit", String(limit))
      query.append("format", exportFormat)

      const res = await apiFetch<{ items: ParcelAdmin[]; total: number; page: number; totalPages: number }>(
        `/api/v1/admin/parcels?${query.toString()}`,
        { method: "GET" }
      )
      return res
    },
    keepPreviousData: true,
  })

  const { mutate: updateStatus, isPending } = useMutation({
    mutationFn: async ({ id, nextStatus, location, note }: { id: string; nextStatus: string; location?: string; note?: string }) => {
      return await apiFetch(`/api/v1/admin/parcels/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus, location, note }),
      })
    },
  })

  const handleExport = () => {
    const params = new URLSearchParams()
    params.append("dateFrom", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
    params.append("dateTo", new Date().toISOString().split("T")[0])
    params.append("format", exportFormat)
    window.location.href = `/api/v1/admin/parcels/export?${params.toString()}`
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Gestion des colis</h1>

      <Separator />

      {/* Filters and Export */}
      <div className="rounded-xl border bg-card p-4 flex flex-wrap gap-4 items-end">
        <div className="min-w-40">
          <label className="text-xs text-muted-foreground">Recherche</label>
          <Input
            placeholder="Tracking, nom expéditeur/destinataire"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Statut</label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as string)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tous</SelectItem>
              <SelectItem value="registered">Enregistré</SelectItem>
              <SelectItem value="picked_up">Pris en charge</SelectItem>
              <SelectItem value="in_transit">En transit</SelectItem>
              <SelectItem value="arrived">Arrivé</SelectItem>
              <SelectItem value="available_for_pickup">Disponible</SelectItem>
              <SelectItem value="delivered">Livré</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Ville destinataire</label>
          <Input
            placeholder="Douala"
            value={recipientCity}
            onChange={(e) => setRecipientCity(e.target.value)}
          />
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

      {/* Parcels Table */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      )}

      {error && (
        <Alert variant="destructive"><TriangleAlert /><AlertTitle>Erreur</AlertTitle><AlertDescription>Impossible de charger les colis.</AlertDescription></Alert>
      )}

      {parcels && parcels.length > 0 && (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Headers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 bg-muted/30 py-2 text-xs font-medium text-slate-400">
              <div>Tracking</div>
              <div>Expéditeur</div>
              <div>Destinataire</div>
              <div>Ville</div>
              <div>Statut</div>
              <div>Coût</div>
            </div>

            {/* Rows */}
            {parcels.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 py-2 border-b border-slate-200"
              >
                <div>
                  <p className="font-mono text-sm">{p.trackingNumber}</p>
                </div>
                <div>{p.senderName}</div>
                <div>{p.recipientName}</div>
                <div>{p.senderCity} → {p.recipientCity}</div>
                <div>
                  <Badge variant={getStatusBadgeVariant(p.status)} className="text-xs">
                    {p.status}
                  </Badge>
                </div>
                <div>{p.shippingCost} XAF</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {parcels && parcels.length === 0 && (
        <Card><CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="rounded-full bg-muted p-3"><Truck className="size-6 text-muted-foreground" /></div>
          <p className="text-sm text-muted-foreground">Aucun colis trouvé.</p>
        </CardContent></Card>
      )}
    </main>
  )
}

function getStatusBadgeVariant(status: string) {
  const map: Record<string, "default" | "destructive" | "primary" | "secondary" | "success"> = {
    registered: "default",
    picked_up: "primary",
    in_transit: "primary",
    arrived: "success",
    available_for_pickup: "secondary",
    delivered: "success",
  }
  return map[status] || "default"
}