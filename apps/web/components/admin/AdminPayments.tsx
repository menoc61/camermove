"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useAuthStore } from "@camermove/frontend"
import { listPayments } from "@/lib/api/admin"
import { Button } from "@/components/ui/button"
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
import { Skeleton } from "@/components/ui/skeleton"
import {
  AdminDateRange,
  AdminEmptyRow,
  AdminFilterBar,
  AdminPagination,
  AdminSearch,
  AdminStatusSelect,
  AdminTableFrame,
  fmtDate,
} from "./shared"

/* Payment amounts are stored in minor units (cents) */
const fmtXafCents = (amount: number) =>
  (amount / 100).toLocaleString("fr-FR", { style: "currency", currency: "XAF", maximumFractionDigits: 0 })
const fmtTime = (d: string) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })

const providerVariant: Record<string, "default" | "secondary" | "outline"> = {
  notchpay: "default",
  cinetpay: "secondary",
}

const paymentStatusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  completed: "default",
  pending: "outline",
  failed: "destructive" as any,
  refunded: "secondary",
}

const STATUS_OPTIONS = ["completed", "pending", "failed", "refunded"].map((s) => ({ value: s, label: s }))
const PROVIDER_OPTIONS = ["notchpay", "cinetpay"].map((p) => ({ value: p, label: p }))

function PaymentRowSkeleton() {
  return (
    <TableRow>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableCell key={i}><Skeleton className="h-4 w-20" /></TableCell>
      ))}
    </TableRow>
  )
}

export function AdminPayments() {
  const token = useAuthStore((s) => s.accessToken)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [providerFilter, setProviderFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const limit = 20

  const params: Record<string, string> = {
    page: String(page),
    limit: String(limit),
  }
  if (search) params.q = search
  if (statusFilter) params.status = statusFilter
  if (providerFilter) params.provider = providerFilter
  if (dateFrom) params.dateFrom = dateFrom
  if (dateTo) params.dateTo = dateTo

  const { data, isLoading } = useQuery({
    queryKey: ["admin-payments", params],
    queryFn: () => listPayments(token!, params),
    enabled: !!token,
  })

  const totalPages = data?.totalPages ?? 1

  return (
    <div className="space-y-4">
      {/* Filters */}
      <AdminFilterBar>
        <AdminSearch
          placeholder="Recherche..."
          value={search}
          onChange={(v) => { setSearch(v); setPage(1) }}
        />
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Statut</Label>
          <AdminStatusSelect value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1) }} options={STATUS_OPTIONS} />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Provider</Label>
          <AdminStatusSelect value={providerFilter} onChange={(v) => { setProviderFilter(v); setPage(1) }} options={PROVIDER_OPTIONS} />
        </div>
        <AdminDateRange
          dateFrom={dateFrom}
          dateTo={dateTo}
          onFrom={(v) => { setDateFrom(v); setPage(1) }}
          onTo={(v) => { setDateTo(v); setPage(1) }}
        />
      </AdminFilterBar>

      {/* Table */}
      <AdminTableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Ref provider</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Méthode</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Réservation</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => <PaymentRowSkeleton key={i} />)}
            {!isLoading && data?.items.length === 0 && (
              <AdminEmptyRow colSpan={8}>Aucun paiement trouvé.</AdminEmptyRow>
            )}
            {!isLoading && data?.items.map((payment, idx) => (
              <TableRow key={payment.id}>
                <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                <TableCell>
                  <Badge variant={providerVariant[payment.provider] ?? "outline"}>{payment.provider}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{payment.providerRef ?? "—"}</TableCell>
                <TableCell className="font-medium">{fmtXafCents(payment.amount)}</TableCell>
                <TableCell>{payment.method ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={paymentStatusVariant[payment.status] ?? "outline"}>{payment.status}</Badge>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm">{payment.booking.reference}</span>
                  <div className="text-xs text-muted-foreground">{payment.booking.user.email}</div>
                </TableCell>
                <TableCell>
                  <div>{fmtDate(payment.createdAt)}</div>
                  <div className="text-xs text-muted-foreground">{fmtTime(payment.createdAt)}</div>
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
        totalLabel="paiements"
        onPage={setPage}
      />
    </div>
  )
}
