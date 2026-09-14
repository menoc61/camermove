"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuthStore } from "@camermove/frontend"
import { listCommissions, markCommissionPaid } from "@/lib/api/admin"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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
import { DownloadIcon, CheckCircleIcon, ClockIcon } from "lucide-react"
import {
  AdminDateRange,
  AdminEmptyRow,
  AdminFilterBar,
  AdminPagination,
  AdminStatusSelect,
  AdminTableFrame,
  fmtDate,
} from "./shared"

/* Commission amounts are stored in minor units (cents) */
const fmtXafCents = (amount: number) =>
  (amount / 100).toLocaleString("fr-FR", { style: "currency", currency: "XAF", maximumFractionDigits: 0 })

const payoutStatusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  paid: "default",
  pending: "outline",
}

const PAYOUT_OPTIONS = ["paid", "pending"].map((s) => ({ value: s, label: s }))

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

function CommissionRowSkeleton() {
  return (
    <TableRow>
      {Array.from({ length: 7 }).map((_, i) => (
        <TableCell key={i}><Skeleton className="h-4 w-20" /></TableCell>
      ))}
    </TableRow>
  )
}

export function AdminCommissions() {
  const token = useAuthStore((s) => s.accessToken)
  const qc = useQueryClient()

  const [payoutFilter, setPayoutFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const limit = 20

  const params: Record<string, string> = {
    page: String(page),
    limit: String(limit),
  }
  if (payoutFilter) params.payoutStatus = payoutFilter
  if (dateFrom) params.dateFrom = dateFrom
  if (dateTo) params.dateTo = dateTo

  const { data, isLoading } = useQuery({
    queryKey: ["admin-commissions", params],
    queryFn: () => listCommissions(token!, params),
    enabled: !!token,
  })

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => markCommissionPaid(token!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-commissions"] })
      toast.success("Commission marquée comme payée")
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  })

  const handleExport = async (format: "csv" | "json") => {
    const exportParams = new URLSearchParams({
      dateFrom: dateFrom || "",
      dateTo: dateTo || "",
      format,
      ...(payoutFilter ? { payoutStatus: payoutFilter } : {}),
    })
    const url = `${API_URL}/api/v1/admin/commissions/export?${exportParams.toString()}`
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error("Export failed")
      const blob = await res.blob()
      const dlUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = dlUrl
      a.download = `export-commissions-${new Date().toISOString().slice(0, 10)}.${format}`
      a.click()
      URL.revokeObjectURL(dlUrl)
    } catch {
      toast.error("Erreur lors de l'export")
    }
  }

  const totalPages = data?.totalPages ?? 1
  const totals = data?.totals

  // Totals are computed server-side across all matching rows (not just this page).
  const paidCount = totals?.paid ?? 0
  const pendingCount = totals?.pending ?? 0

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      {totals && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Commission totale</p>
              <p className="text-xl font-semibold">{fmtXafCents(totals.commission)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Net total</p>
              <p className="text-xl font-semibold text-emerald-600">{fmtXafCents(totals.net)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircleIcon className="size-8 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Payées</p>
                <p className="text-xl font-semibold">{paidCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ClockIcon className="size-8 text-amber-600" />
              <div>
                <p className="text-xs text-muted-foreground">En attente</p>
                <p className="text-xl font-semibold">{pendingCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <AdminFilterBar>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Statut payout</Label>
          <AdminStatusSelect value={payoutFilter} onChange={(v) => { setPayoutFilter(v); setPage(1) }} options={PAYOUT_OPTIONS} />
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
              <TableHead>Transporteur</TableHead>
              <TableHead>Montant brut</TableHead>
              <TableHead>Commission</TableHead>
              <TableHead>Net</TableHead>
              <TableHead>%</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Date réservation</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => <CommissionRowSkeleton key={i} />)}
            {!isLoading && data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Aucune commission trouvée.
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.items.map((commission) => (
              <TableRow key={commission.id}>
                <TableCell className="font-medium">
                  {commission.booking.trip.transport.companyName}
                </TableCell>
                <TableCell>{fmtXafCents(commission.grossAmount)}</TableCell>
                <TableCell className="text-destructive">{fmtXafCents(commission.commissionAmount)}</TableCell>
                <TableCell className="text-emerald-600 font-medium">{fmtXafCents(commission.netAmount)}</TableCell>
                <TableCell>{commission.percentApplied}%</TableCell>
                <TableCell>
                  <Badge variant={payoutStatusVariant[commission.payoutStatus] ?? "outline"}>
                    {commission.payoutStatus}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div>{fmtDate(commission.booking.createdAt)}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(commission.booking.trip.departureAt).toLocaleDateString("fr-FR")}
                  </div>
                </TableCell>
                <TableCell>
                  {commission.payoutStatus === "pending" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markPaidMutation.mutate(commission.id)}
                      disabled={markPaidMutation.isPending}
                    >
                      Marquer payé
                    </Button>
                  )}
                </TableCell>
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
        totalLabel="commissions"
        onPage={setPage}
      />
    </div>
  )
}
