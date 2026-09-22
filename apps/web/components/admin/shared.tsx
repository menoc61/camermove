"use client"

import type { ReactNode } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table"

/* ---------------------------------------------------------------------------
 * Shared admin chrome — one implementation for every Admin* table section.
 * Previously the search field, date-range pair, status select, table frame,
 * empty row, skeleton rows and pagination block were copy-pasted across all
 * eleven Admin* components (drift caused inconsistent styling/behaviour).
 * ------------------------------------------------------------------------- */

/* Shared formatters (were re-defined with slight drift in every file) */
export const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR")

export const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })

export const fmtNum = (n: number) => n.toLocaleString("fr-FR")

export const fmtXaf = (amount: number) =>
  `${amount.toLocaleString("fr-FR")} FCFA`

export function AdminFilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>
}

export function AdminSearch({
  placeholder,
  value,
  onChange,
  className = "min-w-48 flex-1",
}: {
  placeholder: string
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9"
      />
    </div>
  )
}

export function AdminTextField({
  placeholder,
  value,
  onChange,
  className = "w-36",
}: {
  placeholder: string
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <Input
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    />
  )
}

export function AdminDateRange({
  dateFrom,
  dateTo,
  onFrom,
  onTo,
}: {
  dateFrom: string
  dateTo: string
  onFrom: (v: string) => void
  onTo: (v: string) => void
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Du</Label>
        <Input type="date" value={dateFrom} onChange={(e) => onFrom(e.target.value)} className="w-36" />
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Au</Label>
        <Input type="date" value={dateTo} onChange={(e) => onTo(e.target.value)} className="w-36" />
      </div>
    </>
  )
}

export function AdminStatusSelect({
  value,
  onChange,
  options,
  allLabel = "Tous",
  className = "w-44",
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  allLabel?: string
  className?: string
}) {
  return (
    <Select
      value={value || "all"}
      onValueChange={(v) => onChange(v === "all" || v == null ? "" : v)}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function AdminTableFrame({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border overflow-hidden">{children}</div>
}

export function AdminEmptyRow({
  colSpan,
  children,
}: {
  colSpan: number
  children: ReactNode
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  )
}

export function AdminSkeletonRows({
  rows = 5,
  render,
}: {
  rows?: number
  render: () => ReactNode
}) {
  return <>{Array.from({ length: rows }).map((_, i) => <TableRow key={i}>{render()}</TableRow>)}</>
}

export function SortableTh({ label, field, sort, onSort }: { label: string; field: string; sort: string; onSort: (field: string) => void }) {
  const active = sort.startsWith(`${field}.`);
  const desc = sort === `${field}.desc`;
  return (
    <TableHead aria-sort={active ? (desc ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => onSort(field)} title={`Trier par ${label}`} className="inline-flex items-center gap-1 font-medium hover:text-foreground">
        {label}
        {active ? (desc ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />) : <ArrowUpDown className="size-3.5 opacity-40" />}
      </button>
    </TableHead>
  );
}

export function AdminPagination({
  page,
  totalPages,
  total,
  totalLabel,
  onPage,
}: {
  page: number
  totalPages: number
  total?: number
  totalLabel: string
  onPage: (next: number) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        {typeof total === "number" ? `${fmtNum(total)} ${totalLabel}` : ""}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1}>
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span className="text-sm">Page {page} / {totalPages}</span>
        <Button variant="outline" size="sm" onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}
