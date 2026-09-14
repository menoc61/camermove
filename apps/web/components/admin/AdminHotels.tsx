"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuthStore } from "@camermove/frontend"
import { apiFetch } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import {
  AdminDateRange,
  AdminEmptyRow,
  AdminFilterBar,
  AdminPagination,
  AdminSearch,
  AdminTableFrame,
  AdminTextField,
} from "./shared"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

async function downloadExport(token: string, path: string, format: string) {
  const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error("Export failed")
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `export-hotels-${new Date().toISOString().slice(0, 10)}.${format}`
  a.click()
  URL.revokeObjectURL(url)
}

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
    downloadExport(token, `/api/v1/admin/hotels/export?${qs}`, format).catch(() => toast.error("Erreur lors de l'export"))
  }

  return (
    <div className="space-y-4">
      <AdminFilterBar>
        <AdminSearch placeholder="Recherche" value={q} onChange={(v) => { setQ(v); setPage(1) }} className="w-48" />
        <AdminTextField placeholder="Ville" value={city} onChange={(v) => { setCity(v); setPage(1) }} />
        <AdminDateRange
          dateFrom={dateFrom}
          dateTo={dateTo}
          onFrom={(v) => { setDateFrom(v); setPage(1) }}
          onTo={(v) => { setDateTo(v); setPage(1) }}
        />
        <Button variant="outline" size="sm" onClick={() => exportCsv("csv")}>Export CSV</Button>
      </AdminFilterBar>
      <AdminTableFrame>
        <Table>
          <TableHeader><TableRow><TableHead>Hôtel</TableHead><TableHead>Ville</TableHead><TableHead>Chambres</TableHead><TableHead>Statut</TableHead><TableHead>Partner</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 6 }).map((__, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                ))}
              </TableRow>
            ))}
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
            {!isLoading && data?.items.length === 0 && <AdminEmptyRow colSpan={6}>Aucun hôtel.</AdminEmptyRow>}
          </TableBody>
        </Table>
      </AdminTableFrame>
      <AdminPagination
        page={page}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        totalLabel="hôtels"
        onPage={setPage}
      />
    </div>
  )
}
