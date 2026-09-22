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
  SortableTh,
} from "./shared"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

async function downloadExport(token: string, path: string, format: string) {
  const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error("Export failed")
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `export-rentals-${new Date().toISOString().slice(0, 10)}.${format}`
  a.click()
  URL.revokeObjectURL(url)
}

export function AdminRentals() {
  const token = useAuthStore((s) => s.accessToken)
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [q, setQ] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sort, setSort] = useState("createdAt.desc")
  const onSort = (field: string) => { setSort((s) => (s === `${field}.asc` ? `${field}.desc` : `${field}.asc`)); setPage(1) }
  const limit = 20
  const params: Record<string, string> = { page: String(page), limit: String(limit), sort }
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
      <AdminFilterBar>
        <AdminSearch placeholder="Recherche" value={q} onChange={(v) => { setQ(v); setPage(1) }} className="w-48" />
        <AdminDateRange
          dateFrom={dateFrom}
          dateTo={dateTo}
          onFrom={(v) => { setDateFrom(v); setPage(1) }}
          onTo={(v) => { setDateTo(v); setPage(1) }}
        />
        <Button variant="outline" size="sm" onClick={() => { if (!token) return; const qs = new URLSearchParams({ format: "csv", ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}), ...(q ? { q } : {}) }).toString(); downloadExport(token, `/api/v1/admin/rentals/export?${qs}`, "csv").catch(() => toast.error("Erreur lors de l'export")) }}>Export CSV</Button>
      </AdminFilterBar>
      <AdminTableFrame>
        <Table>
          <TableHeader><TableRow><SortableTh label="Véhicule" field="make" sort={sort} onSort={onSort} /><TableHead>Catégorie</TableHead><SortableTh label="Ville" field="pickupCity" sort={sort} onSort={onSort} /><SortableTh label="Statut" field="status" sort={sort} onSort={onSort} /><TableHead>Partner</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 6 }).map((__, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                ))}
              </TableRow>
            ))}
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
            {!isLoading && data?.items.length === 0 && <AdminEmptyRow colSpan={6}>Aucun véhicule.</AdminEmptyRow>}
          </TableBody>
        </Table>
      </AdminTableFrame>
      <AdminPagination
        page={page}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        totalLabel="véhicules"
        onPage={setPage}
      />
    </div>
  )
}
