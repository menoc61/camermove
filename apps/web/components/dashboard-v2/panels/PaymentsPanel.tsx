"use client";

import { DataTable, Column } from "./DataTable";
import { ExportButton } from "../controls/ExportButton";
import { PaginationControls } from "../controls/PaginationControls";

interface PaymentsPanelProps {
  token: string;
  data: Record<string, unknown>[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const columns: Column[] = [
  { key: "providerRef", label: "Reference", render: (v) => v ? <span className="font-mono text-xs">{String(v)}</span> : "—" },
  { key: "provider", label: "Operateur" },
  { key: "method", label: "Methode", render: (v) => v ? String(v).replace(/_/g, " ") : "—" },
  { key: "amount", label: "Montant", render: (v) => v ? `${Number(v).toLocaleString("fr-FR")} XAF` : "-" },
  { key: "createdAt", label: "Date", render: (v) => v ? new Date(String(v)).toLocaleDateString("fr-FR") : "-" },
  { key: "status", label: "Statut" },
];

export function PaymentsPanel({ token, data, isLoading, page, totalPages, onPageChange }: PaymentsPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{isLoading ? "Chargement..." : `${data.length} paiement(s)`}</p>
        <ExportButton token={token} endpoint="/api/v1/payments/export" resource="payments" />
      </div>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        emptyMessage="Aucun paiement effectue."
      />
      <PaginationControls page={page} totalPages={totalPages} isFetching={isLoading} onPageChange={onPageChange} />
    </div>
  );
}

