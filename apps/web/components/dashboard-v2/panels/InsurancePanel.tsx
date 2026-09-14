"use client";

import { DataTable, Column } from "./DataTable";
import { ExportButton } from "../controls/ExportButton";
import { PaginationControls } from "../controls/PaginationControls";

interface InsurancePanelProps {
  token: string;
  data: Record<string, unknown>[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const columns: Column[] = [
  { key: "policyNumber", label: "Police", render: (v) => <span className="font-mono text-xs">{String(v ?? "—")}</span> },
  { key: "destination", label: "Destination" },
  { key: "coverageType", label: "Formule" },
  { key: "startDate", label: "Debut", render: (v) => v ? new Date(String(v)).toLocaleDateString("fr-FR") : "-" },
  { key: "endDate", label: "Fin", render: (v) => v ? new Date(String(v)).toLocaleDateString("fr-FR") : "-" },
  { key: "premium", label: "Prime", render: (v) => v ? `${Number(v).toLocaleString("fr-FR")} XAF` : "-" },
  { key: "status", label: "Statut" },
];

export function InsurancePanel({ token, data, isLoading, page, totalPages, onPageChange }: InsurancePanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{isLoading ? "Chargement..." : `${data.length} police(s)`}</p>
        <ExportButton token={token} endpoint="/api/v1/insurance/policies/export" resource="insurance" />
      </div>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        emptyMessage="Aucune assurance souscrite. Protegez vos voyages."
        emptyActionLabel="Souscrire une assurance"
        emptyActionHref="/insurance"
      />
      <PaginationControls page={page} totalPages={totalPages} isFetching={isLoading} onPageChange={onPageChange} />
    </div>
  );
}

