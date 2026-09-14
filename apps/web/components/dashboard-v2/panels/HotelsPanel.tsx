"use client";

import { DataTable, Column } from "./DataTable";
import { ExportButton } from "../controls/ExportButton";
import { PaginationControls } from "../controls/PaginationControls";

interface HotelsPanelProps {
  token: string;
  data: Record<string, unknown>[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const columns: Column[] = [
  {
    key: "hotel",
    label: "Hotel",
    render: (v) => {
      const name = v && typeof v === "object" && "name" in v ? String((v as { name: string }).name) : "—";
      return <span className="font-medium">{name}</span>;
    },
  },
  {
    key: "hotel",
    label: "Ville",
    render: (v) => {
      const city = v && typeof v === "object" && "city" in v ? String((v as { city: string }).city) : "—";
      return <span className="text-muted-foreground">{city}</span>;
    },
  },
  {
    key: "roomType",
    label: "Chambre",
    render: (v) => {
      const name = v && typeof v === "object" && "name" in v ? String((v as { name: string }).name) : "—";
      return name;
    },
  },
  { key: "checkInDate", label: "Arrivee", render: (v) => v ? new Date(String(v)).toLocaleDateString("fr-FR") : "-" },
  { key: "checkOutDate", label: "Depart", render: (v) => v ? new Date(String(v)).toLocaleDateString("fr-FR") : "-" },
  { key: "guestCount", label: "Personnes", render: (v) => (typeof v === "number" ? String(v) : "—") },
  { key: "totalAmount", label: "Montant", render: (v) => `${Number(v).toLocaleString("fr-FR")} XAF` },
  { key: "status", label: "Statut" },
];

export function HotelsPanel({ token, data, isLoading, page, totalPages, onPageChange }: HotelsPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{isLoading ? "Chargement..." : `${data.length} reservation(s)`}</p>
        <ExportButton token={token} endpoint="/api/v1/hotels/bookings/export" resource="hotels" />
      </div>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        emptyMessage="Aucune reservation hoteliere. Trouvez votre hebergement ideal."
        emptyActionLabel="Rechercher un hotel"
        emptyActionHref="/hotels"
      />
      <PaginationControls page={page} totalPages={totalPages} isFetching={isLoading} onPageChange={onPageChange} />
    </div>
  );
}

