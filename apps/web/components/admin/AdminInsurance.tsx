"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useAuthStore } from "@camermove/frontend"
import { apiFetch } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
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
  SortableTh,
} from "./shared"

interface InsurancePolicyAdmin {
  id: string
  policyNumber: string | null
  destination: string
  coverageType: string
  travelers: number
  premium: number
  currency: string
  status: string
  startDate: string
  endDate: string
  createdAt: string
}

const COVERAGE_LABELS: Record<string, string> = {
  basic: "Basique",
  standard: "Standard",
  premium: "Premium",
  family: "Famille",
}

const COVERAGE_OPTIONS = Object.entries(COVERAGE_LABELS).map(([value, label]) => ({ value, label }))

function statusBadge(status: string): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  switch (status) {
    case "pending_payment":
      return { label: "En attente", variant: "secondary" }
    case "confirmed":
      return { label: "Active", variant: "default" }
    case "cancelled":
      return { label: "Annulée", variant: "destructive" }
    case "expired":
      return { label: "Expirée", variant: "outline" }
    case "refunded":
      return { label: "Remboursée", variant: "outline" }
    default:
      return { label: status, variant: "outline" }
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

export function AdminInsurance() {
  const token = useAuthStore((s) => s.accessToken)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState("")
  const [coverage, setCoverage] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sort, setSort] = useState("createdAt.desc")
  const onSort = (field: string) => { setSort((s) => (s === `${field}.asc` ? `${field}.desc` : `${field}.asc`)); setPage(1) }

  const params: Record<string, string> = { page: String(page), perPage: "20", sort }
  if (q) params.q = q
  if (coverage) params.coverageType = coverage
  if (dateFrom) params.dateFrom = dateFrom
  if (dateTo) params.dateTo = dateTo

  const { data, isLoading, error } = useQuery<{ items: InsurancePolicyAdmin[]; total: number; page: number; totalPages: number }>({
    queryKey: ["admin-insurance", params],
    // GET /admin/insurance/policies (admin-only list, same envelope)
    queryFn: () => apiFetch(`/api/v1/admin/insurance/policies?${new URLSearchParams(params).toString()}`, { method: "GET", token: token! }),
    enabled: !!token,
  })

  const handleExport = async (format: "csv" | "json") => {
    if (!token) return
    const exportParams = new URLSearchParams({
      format,
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(q ? { q } : {}),
      ...(coverage ? { coverageType: coverage } : {}),
    })
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/insurance/policies/export?${exportParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error("Export failed")
      const blob = await res.blob()
      const dlUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = dlUrl
      a.download = `export-insurance-${new Date().toISOString().slice(0, 10)}.${format}`
      a.click()
      URL.revokeObjectURL(dlUrl)
    } catch {
      toast.error("Erreur lors de l'export")
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Assurances</h1>

      <AdminFilterBar>
        <AdminSearch
          placeholder="Destination, police"
          value={q}
          onChange={(v) => { setQ(v); setPage(1) }}
        />
        <AdminStatusSelect value={coverage} onChange={(v) => { setCoverage(v); setPage(1) }} options={COVERAGE_OPTIONS} allLabel="Toutes couvertures" />
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
        <Alert variant="destructive"><TriangleAlert /><AlertTitle>Erreur</AlertTitle><AlertDescription>Impossible de charger les polices.</AlertDescription></Alert>
      )}

      {data && data.items.length === 0 && (
        <AdminTableFrame>
          <Table>
            <TableBody>
              <AdminEmptyRow colSpan={7}>Aucune police trouvée.</AdminEmptyRow>
            </TableBody>
          </Table>
        </AdminTableFrame>
      )}

      {data && data.items.length > 0 && (
        <AdminTableFrame>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Police</TableHead>
                <SortableTh label="Destination" field="destination" sort={sort} onSort={onSort} />
                <TableHead>Couverture</TableHead>
                <TableHead>Voyageurs</TableHead>
                <SortableTh label="Prime" field="premium" sort={sort} onSort={onSort} />
                <SortableTh label="Statut" field="status" sort={sort} onSort={onSort} />
                <SortableTh label="Période" field="startDate" sort={sort} onSort={onSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((p) => {
                const badge = statusBadge(p.status)
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.policyNumber ?? p.id}</TableCell>
                    <TableCell>{p.destination}</TableCell>
                    <TableCell>{COVERAGE_LABELS[p.coverageType] ?? p.coverageType}</TableCell>
                    <TableCell>{p.travelers}</TableCell>
                    <TableCell>{priceXaf(p.premium)}</TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(p.startDate).toLocaleDateString("fr-FR")} → {new Date(p.endDate).toLocaleDateString("fr-FR")}</TableCell>
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
          totalLabel="polices"
          onPage={setPage}
        />
      )}
    </div>
  )
}
