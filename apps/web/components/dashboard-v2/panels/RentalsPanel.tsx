"use client";

import { DataTable, Column } from "./DataTable";
import { ExportButton } from "../controls/ExportButton";
import { PaginationControls } from "../controls/PaginationControls";

interface RentalsPanelProps {
  token: string;
  data: Record<string, unknown>[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const columns: Column[] = [
  {
    key: "vehicle",
    label: "Vehicule",
    render: (v) => {
      if (v && typeof v === "object") {
        const vehicle = v as { make?: string; model?: string };
        return <span className="font-medium">{`${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim() || "—"}</span>;
      }
      return "—";
    },
  },
  { key: "pickupCity", label: "Prise en charge" },
  { key: "startDate", label: "Debut", render: (v) => v ? new Date(String(v)).toLocaleDateString("fr-FR") : "-" },
  { key: "endDate", label: "Retour", render: (v) => v ? new Date(String(v)).toLocaleDateString("fr-FR") : "-" },
  { key: "totalAmount", label: "Montant", render: (v) => `${Number(v).toLocaleString("fr-FR")} XAF` },
  { key: "status", label: "Statut" },
];

export function RentalsPanel({ token, data, isLoading, page, totalPages, onPageChange }: RentalsPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{isLoading ? "Chargement..." : `${data.length} location(s)`}</p>
        <ExportButton token={token} endpoint="/api/v1/rentals/bookings/export" resource="rentals" />
      </div>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        emptyMessage="Aucune location de vehicule. Louez un vehicule pour vos deplacements."
        emptyActionLabel="Louer un vehicule"
        emptyActionHref="/rentals"
      />
      <PaginationControls page={page} totalPages={totalPages} isFetching={isLoading} onPageChange={onPageChange} />
    </div>
  );
}

