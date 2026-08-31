"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useAuthStore } from "@camermove/frontend"
import { listAuditLogs } from "@/lib/api/admin"
import type { AuditLogItem } from "@/lib/api/admin"
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
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"

const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR")
const fmtTime = (d: string) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
const fmtNum = (n: number) => n.toLocaleString("fr-FR")

const roleVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  super_admin: "destructive" as any,
  admin: "secondary",
  transporter_staff: "outline",
  traveler: "default",
}

function AuditRowSkeleton() {
  return (
    <TableRow>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableCell key={i}><Skeleton className="h-4 w-20" /></TableCell>
      ))}
    </TableRow>
  )
}

function MetadataDetail({ metadata }: { metadata: Record<string, unknown> | null }) {
  if (!metadata) return <span className="text-muted-foreground">—</span>
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        Voir détails
      </summary>
      <pre className="mt-1 whitespace-pre-wrap bg-muted p-2 rounded text-muted-foreground max-w-96">
        {JSON.stringify(metadata, null, 2)}
      </pre>
    </details>
  )
}

export function AdminAuditLog() {
  const token = useAuthStore((s) => s.accessToken)

  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const limit = 20

  const params: Record<string, string> = {
    page: String(page),
    limit: String(limit),
  }
  if (search) params.q = search
  if (actionFilter) params.action = actionFilter
  if (dateFrom) params.dateFrom = dateFrom
  if (dateTo) params.dateTo = dateTo

  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit-logs", params],
    queryFn: () => listAuditLogs(token!, params),
    enabled: !!token,
  })

  const totalPages = data?.totalPages ?? 1

  // Extract unique actions for filter
  const uniqueActions = [...new Set(data?.items.map((item) => item.action) ?? [])]

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher acteur, action, entité..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Action</Label>
          <select
            className="h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm"
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
          >
            <option value="">Toutes</option>
            {uniqueActions.map((a) => (
              <option key={a} value={a}>{a}</option>
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
              <TableHead>Acteur</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entité</TableHead>
              <TableHead>ID Entité</TableHead>
              <TableHead>Métadonnées</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => <AuditRowSkeleton key={i} />)}
            {!isLoading && data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Aucun journal d'audit trouvé.
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.items.map((log, idx) => (
              <TableRow key={log.id}>
                <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                <TableCell>
                  <div className="font-medium">{log.actor.email}</div>
                  <Badge variant={roleVariant[log.actor.role] ?? "outline"} className="text-xs mt-0.5">
                    {log.actor.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{log.action}</code>
                </TableCell>
                <TableCell className="text-muted-foreground">{log.entityType}</TableCell>
                <TableCell className="font-mono text-xs">{log.entityId}</TableCell>
                <TableCell>
                  <MetadataDetail metadata={log.metadata} />
                </TableCell>
                <TableCell>
                  <div>{fmtDate(log.createdAt)}</div>
                  <div className="text-xs text-muted-foreground">{fmtTime(log.createdAt)}</div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data ? `${fmtNum(data.total)} entrées` : ""}
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
