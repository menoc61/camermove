"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuthStore } from "@camermove/frontend"
import { apiFetch } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"

export function AdminRentals() {
  const token = useAuthStore((s) => s.accessToken)
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [q, setQ] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const limit = 20
  const params: Record<string, string> = { page: String(page), limit: String(limit) }
  if (q) params.q = q
  if (dateFrom) params.dateFrom = dateFrom
  if (dateTo) params.dateTo = dateTo

  const { data, isLoading } = useQuery<{ items: Array<{ id: string; make: string; model: string; category: string; pickupCity: string; status: string; partnerStatus: string }>; total: number; totalPages: number }>({
    queryKey: ["admin-rentals", params],
    queryFn: () => apiFetch(`/api/v1/admin/rentals?${new URLSearchParams(params).toString()}`, { method: "GET", token: token! }),
    enabled: !!token,
  })

  const update = useMutation({
    mutationFn: ({ id, partnerStatus }: { id: string; partnerStatus: string }) => apiFetch(`/api/v1/admin/rentals/${id}`, { method: "PUT", token: token!, body: JSON.stringify({ partnerStatus }), headers: { "Content-Type": "application/json" } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-rentals"] }); toast.success("Mis à jour") },
    onError: () => toast.error("Erreur"),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Recherche" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className="w-48" />
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
        <Button variant="outline" size="sm" onClick={() => { if (!token) return; const qs = new URLSearchParams({ format: "csv", ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}), ...(q ? { q } : {}) }).toString(); window.open(`/api/v1/admin/rentals/export?${qs}`, "_blank") }}>Export CSV</Button>
      </div>
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Véhicule</TableHead><TableHead>Catégorie</TableHead><TableHead>Ville</TableHead><TableHead>Statut</TableHead><TableHead>Partner</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6}>Chargement…</TableCell></TableRow>}
            {data?.items.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.make} {v.model}</TableCell>
                <TableCell>{v.category}</TableCell>
                <TableCell>{v.pickupCity}</TableCell>
                <TableCell><Badge variant="outline">{v.status}</Badge></TableCell>
                <TableCell><Badge variant={v.partnerStatus === "approved" ? "default" : "secondary"}>{v.partnerStatus}</Badge></TableCell>
                <TableCell className="flex gap-1"><Button size="sm" variant="outline" onClick={() => update.mutate({ id: v.id, partnerStatus: "approved" })}>Approuver</Button><Button size="sm" variant="ghost" onClick={() => update.mutate({ id: v.id, partnerStatus: "rejected" })}>Rejeter</Button></TableCell>
              </TableRow>
            ))}
            {!isLoading && data?.items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Aucun véhicule.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{data?.total ?? 0} véhicules</span>
        <div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Préc</Button><span className="text-sm py-1">Page {page} / {data?.totalPages ?? 1}</span><Button size="sm" variant="outline" disabled={page >= (data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>Suiv</Button></div>
      </div>
    </div>
  )
}
