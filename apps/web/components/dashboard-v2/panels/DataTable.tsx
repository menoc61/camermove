"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { StatusBadge } from "../cards/StatusPill";

export interface Column {
  key: string;
  label: string;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
  /** Set false to disable sorting on this column (default: sortable). */
  sortable?: boolean;
  /** Raw value used for sorting (defaults to row[key]). */
  sortValue?: (row: Record<string, unknown>) => string | number | null | undefined;
}

export interface DataTableProps {
  columns: Column[];
  data: Record<string, unknown>[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyActionLabel?: string;
  emptyActionHref?: string;
}

function compareCellValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "fr", { numeric: true });
}

function LoadingRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

function renderCell(col: Column, row: Record<string, unknown>, j: number) {
  const cellKey = `${col.key}-${j}`;
  const value = row[col.key];
  if (col.render) {
    const rendered = col.render(value, row);
    return <TableCell key={cellKey}>{rendered as React.ReactNode}</TableCell>;
  }
  if (col.key === "status") {
    return (
      <TableCell key={cellKey}>
        <StatusBadge status={String(value)} />
      </TableCell>
    );
  }
  if (col.key === "actions") {
    const id = row.id != null ? String(row.id) : null;
    return (
      <TableCell key={cellKey}>
        {id ? (
          <Link href={`/trips/${id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent" aria-label={`Voir le détail ${id}`}>
            <Eye className="size-4" aria-hidden />
          </Link>
        ) : null}
      </TableCell>
    );
  }
  return <TableCell key={cellKey}>{String(value ?? "")}</TableCell>;
}

export function DataTable({
  columns,
  data,
  isLoading = false,
  emptyMessage = "Aucune donnée disponible",
  emptyActionLabel,
  emptyActionHref,
}: DataTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    const get = col?.sortValue ?? ((row: Record<string, unknown>) => row[sortKey] as string | number | null | undefined);
    return [...data].sort((a, b) => {
      const cmp = compareCellValues(get(a), get(b));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, columns, sortKey, sortDir]);

  function toggleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
      setSortDir("asc");
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <LoadingRows cols={columns.length} />
          </TableBody>
        </Table>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
        <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground mb-3">{emptyMessage}</p>
        {emptyActionLabel && emptyActionHref && (
          <Link href={emptyActionHref} className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
            {emptyActionLabel}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => {
              const sortable = col.sortable !== false;
              const sortedState = sortKey === col.key ? sortDir : null;
              return (
                <TableHead key={col.key} aria-sort={sortedState === "asc" ? "ascending" : sortedState === "desc" ? "descending" : "none"}>
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      title={`Trier par ${col.label}`}
                      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                    >
                      {col.label}
                      {sortedState === "asc" ? (
                        <ArrowUp className="size-3.5" aria-hidden />
                      ) : sortedState === "desc" ? (
                        <ArrowDown className="size-3.5" aria-hidden />
                      ) : (
                        <ArrowUpDown className="size-3.5 opacity-40" aria-hidden />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row, i) => (
            <TableRow key={row.id != null ? String(row.id) : `row-${i}`}>
              {columns.map((col, j) => renderCell(col, row, j))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
