"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useAuthStore } from "@camermove/frontend"
import { listAuditLogs } from "@/lib/api/admin"
import type { AuditLogItem } from "@/lib/api/admin"
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
  SortableTh,
  fmtDate,
} from "./shared"

const fmtTime = (d: string) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })

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
  const [sort, setSort] = useState("createdAt.desc")
  const onSort = (field: string) => { setSort((s) => (s === `${field}.asc` ? `${field}.desc` : `${field}.asc`)); setPage(1) }
  const limit = 20

  const params: Record<string, string> = {
    page: String(page),
    limit: String(limit),
    sort,
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
      <AdminFilterBar>
        <AdminSearch
          placeholder="Rechercher acteur, action, entité..."
          value={search}
          onChange={(v) => { setSearch(v); setPage(1) }}
        />
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Action</Label>
          <AdminStatusSelect
            value={actionFilter}
            onChange={(v) => { setActionFilter(v); setPage(1) }}
            options={uniqueActions.map((a) => ({ value: a, label: a }))}
            allLabel="Toutes"
          />
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
              <TableHead>Acteur</TableHead>
              <SortableTh label="Action" field="action" sort={sort} onSort={onSort} />
              <TableHead>Entité</TableHead>
              <TableHead>ID Entité</TableHead>
              <TableHead>Métadonnées</TableHead>
              <SortableTh label="Date" field="createdAt" sort={sort} onSort={onSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => <AuditRowSkeleton key={i} />)}
            {!isLoading && data?.items.length === 0 && (
              <AdminEmptyRow colSpan={7}>Aucun journal d'audit trouvé.</AdminEmptyRow>
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
      </AdminTableFrame>

      {/* Pagination */}
      <AdminPagination
        page={page}
        totalPages={totalPages}
        total={data?.total}
        totalLabel="entrées"
        onPage={setPage}
      />
    </div>
  )
}
