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

export function AdminHotels() {
  const token = useAuthStore((s) => s.accessToken)
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [q, setQ] = useState("")
  const [city, setCity] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const limit = 20

  const params: Record<string, string> = { page: String(page), limit: String(limit) }
  if (q) params.q = q
  if (city) params.city = city
  if (dateFrom) params.dateFrom = dateFrom
  if (dateTo) params.dateTo = dateTo

  const { data, isLoading } = useQuery<{ items: Array<{ id: string; name: string; city: string; status: string; partnerStatus: string; rooms: Array<unknown> }>; total: number; totalPages: number }>({
    queryKey: ["admin-hotels", params],
    queryFn: () => apiFetch(`/api/v1/admin/hotels?${new URLSearchParams(params).toString()}`, { method: "GET", token: token! }),
    enabled: !!token,
  })

  const update = useMutation({
    mutationFn: ({ id, partnerStatus }: { id: string; partnerStatus: string }) => apiFetch(`/api/v1/admin/hotels/${id}`, { method: "PUT", token: token!, body: JSON.stringify({ partnerStatus }), headers: { "Content-Type": "application/json" } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-hotels"] }); toast.success("Mis à jour") },
    onError: () => toast.error("Erreur"),
  })

  function exportCsv(format: "csv" | "json" = "csv") {
    if (!token) return
    const qs = new URLSearchParams({ format, ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}), ...(q ? { q } : {}) }).toString()
    window.open(`/api/v1/admin/hotels/export?${qs}`, "_blank")
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Recherche" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className="w-48" />
        <Input placeholder="Ville" value={city} onChange={(e) => { setCity(e.target.value); setPage(1) }} className="w-32" />
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
        <Button variant="outline" size="sm" onClick={() => exportCsv("csv")}>Export CSV</Button>
      </div>
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Hôtel</TableHead><TableHead>Ville</TableHead><TableHead>Chambres</TableHead><TableHead>Statut</TableHead><TableHead>Partner</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6}>Chargement…</TableCell></TableRow>}
            {data?.items.map((h) => (
              <TableRow key={h.id}>
                <TableCell className="font-medium">{h.name}</TableCell>
                <TableCell>{h.city}</TableCell>
                <TableCell>{h.rooms.length}</TableCell>
                <TableCell><Badge variant="outline">{h.status}</Badge></TableCell>
                <TableCell><Badge variant={h.partnerStatus === "approved" ? "default" : "secondary"}>{h.partnerStatus}</Badge></TableCell>
                <TableCell className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => update.mutate({ id: h.id, partnerStatus: "approved" })}>Approuver</Button>
                  <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: h.id, partnerStatus: "rejected" })}>Rejeter</Button>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && data?.items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Aucun hôtel.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{data?.total ?? 0} hôtels</span>
        <div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Préc</Button><span className="text-sm py-1">Page {page} / {data?.totalPages ?? 1}</span><Button size="sm" variant="outline" disabled={page >= (data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>Suiv</Button></div>
      </div>
    </div>
  )
}
