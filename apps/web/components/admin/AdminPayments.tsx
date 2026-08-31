"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useAuthStore } from "@camermove/frontend"
import { listPayments } from "@/lib/api/admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR")
const fmtTime = (d: string) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
const fmtXaf = (amount: number) =>
  (amount / 100).toLocaleString("fr-FR", { style: "currency", currency: "XAF", maximumFractionDigits: 0 })
const fmtNum = (n: number) => n.toLocaleString("fr-FR")

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
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Recherche..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Statut</Label>
          <select
            className="h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          >
            <option value="">Tous</option>
            {["completed", "pending", "failed", "refunded"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Provider</Label>
          <select
            className="h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm"
            value={providerFilter}
            onChange={(e) => { setProviderFilter(e.target.value); setPage(1) }}
          >
            <option value="">Tous</option>
            {["notchpay", "cinetpay"].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Du</Label>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className="w-36" />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Au</Label>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className="w-36" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
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
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Aucun paiement trouvé.
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.items.map((payment, idx) => (
              <TableRow key={payment.id}>
                <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                <TableCell>
                  <Badge variant={providerVariant[payment.provider] ?? "outline"}>{payment.provider}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{payment.providerRef ?? "—"}</TableCell>
                <TableCell className="font-medium">{fmtXaf(payment.amount)}</TableCell>
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
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data ? `${fmtNum(data.total)} paiements` : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <span className="text-sm">Page {page} / {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
