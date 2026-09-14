"use client";

import { DataTable, Column } from "./DataTable";
import { ExportButton } from "../controls/ExportButton";
import { PaginationControls } from "../controls/PaginationControls";

interface EventsPanelProps {
  token: string;
  data: Record<string, unknown>[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const columns: Column[] = [
  { key: "ticketNumber", label: "Billet", render: (v) => <span className="font-mono text-xs">{String(v ?? "—")}</span> },
  {
    key: "event",
    label: "Evenement",
    render: (v) => {
      const name = v && typeof v === "object" && "name" in v ? String((v as { name: string }).name) : "—";
      return <span className="font-medium">{name}</span>;
    },
  },
  {
    key: "event",
    label: "Lieu",
    render: (v) => {
      const venue = v && typeof v === "object" && "venue" in v ? String((v as { venue: string }).venue) : "—";
      return <span className="text-muted-foreground">{venue}</span>;
    },
  },
  {
    key: "event",
    label: "Date",
    render: (v) => {
      const d = v && typeof v === "object" && "startDate" in v ? String((v as { startDate: string }).startDate) : null;
      return d ? new Date(d).toLocaleDateString("fr-FR") : "-";
    },
  },
  { key: "quantity", label: "Places" },
  { key: "totalAmount", label: "Montant", render: (v) => v ? `${Number(v).toLocaleString("fr-FR")} XAF` : "-" },
  { key: "status", label: "Statut" },
];

export function EventsPanel({ token, data, isLoading, page, totalPages, onPageChange }: EventsPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{isLoading ? "Chargement..." : `${data.length} reservation(s)`}</p>
        <ExportButton token={token} endpoint="/api/v1/events/bookings/export" resource="events" />
      </div>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        emptyMessage="Aucun evenement reserve. Decouvrez les evenements a venir."
        emptyActionLabel="Voir les evenements"
        emptyActionHref="/events"
      />
      <PaginationControls page={page} totalPages={totalPages} isFetching={isLoading} onPageChange={onPageChange} />
    </div>
  );
}

