"use client";

import { DataTable, Column } from "./DataTable";
import { ExportButton } from "../controls/ExportButton";
import { PaginationControls } from "../controls/PaginationControls";

interface TripsPanelProps {
  token: string;
  data: Record<string, unknown>[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const columns: Column[] = [
  { key: "reference", label: "Reference" },
  { key: "origin", label: "Origine" },
  { key: "destination", label: "Destination" },
  { key: "departureAt", label: "Depart", render: (v) => new Date(String(v)).toLocaleDateString("fr-FR") },
  { key: "totalAmount", label: "Montant", render: (v) => `${Number(v).toLocaleString("fr-FR")} XAF` },
  { key: "status", label: "Statut" },
];

export function TripsPanel({ token, data, isLoading, page, totalPages, onPageChange }: TripsPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Chargement..." : `${data.length} voyage(s)`}
        </p>
        <ExportButton token={token} endpoint="/api/v1/bookings/export" resource="trips" />
      </div>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        emptyMessage="Aucun voyage reserve. Commencez par rechercher un trajet."
        emptyActionLabel="Rechercher un trajet"
        emptyActionHref="/results?origin=Yaound%C3%A9&destination=Douala&pax=1"
      />
      <PaginationControls page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}

