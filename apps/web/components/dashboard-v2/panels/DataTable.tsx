"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText } from "lucide-react";
import Link from "next/link";

export interface Column {
  key: string;
  label: string;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

export interface DataTableProps {
  columns: Column[];
  data: Record<string, unknown>[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyActionLabel?: string;
  emptyActionHref?: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    confirmed: { label: "Confirmé", variant: "default" },
    pending_payment: { label: "En attente", variant: "secondary" },
    cancelled: { label: "Annulé", variant: "destructive" },
    used: { label: "Utilisé", variant: "default" },
    valid: { label: "Valide", variant: "default" },
    void: { label: "Annulé", variant: "destructive" },
    delivered: { label: "Livré", variant: "default" },
    in_transit: { label: "En transit", variant: "secondary" },
    picked_up: { label: "Récupéré", variant: "default" },
    registered: { label: "Enregistré", variant: "secondary" },
    active: { label: "Actif", variant: "default" },
    completed: { label: "Terminé", variant: "default" },
    paid: { label: "Payé", variant: "default" },
    failed: { label: "Échoué", variant: "destructive" },
    available_for_pickup: { label: "Disponible", variant: "secondary" },
    arrived: { label: "Arrivé", variant: "default" },
    queued: { label: "En file", variant: "secondary" },
    sent: { label: "Envoyé", variant: "default" },
  };
  const s = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={s.variant}>{s.label}</Badge>;
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

export function DataTable({
  columns,
  data,
  isLoading = false,
  emptyMessage = "Aucune donnee disponible",
  emptyActionLabel,
  emptyActionHref,
}: DataTableProps) {
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
            {columns.map((col) => (
              <TableHead key={col.key}>{col.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow key={row.id != null ? String(row.id) : `row-${i}`}>
              {columns.map((col, j) => {
                const value = row[col.key];
                const cellKey = `${col.key}-${j}`;
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
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                        </Link>
                      ) : null}
                    </TableCell>
                  );
                }
                return <TableCell key={cellKey}>{String(value ?? "")}</TableCell>;
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

