"use client";

import { DataTable, Column } from "./DataTable";
import { ExportButton } from "../controls/ExportButton";
import { PaginationControls } from "../controls/PaginationControls";

interface ParcelsPanelProps {
  token: string;
  data: Record<string, unknown>[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const columns: Column[] = [
  { key: "trackingNumber", label: "Suivi", render: (v) => <span className="font-mono text-xs">{String(v ?? "—")}</span> },
  { key: "recipientName", label: "Destinataire" },
  { key: "recipientCity", label: "Destination" },
  { key: "parcelType", label: "Type" },
  { key: "weightKg", label: "Poids", render: (v) => (v != null ? `${v} kg` : "—") },
  { key: "shippingCost", label: "Frais", render: (v) => v ? `${Number(v).toLocaleString("fr-FR")} XAF` : "-" },
  { key: "status", label: "Statut" },
];

export function ParcelsPanel({ token, data, isLoading, page, totalPages, onPageChange }: ParcelsPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{isLoading ? "Chargement..." : `${data.length} colis`}</p>
        <ExportButton token={token} endpoint="/api/v1/parcels/export" resource="parcels" />
      </div>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        emptyMessage="Aucun coli envoye. Envoyez un colis partout au Cameroun."
        emptyActionLabel="Envoyer un colis"
        emptyActionHref="/parcels"
      />
      <PaginationControls page={page} totalPages={totalPages} isFetching={isLoading} onPageChange={onPageChange} />
    </div>
  );
}

