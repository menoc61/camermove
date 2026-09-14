"use client";

import { DataTable, Column } from "./DataTable";
import { PaginationControls } from "../controls/PaginationControls";

interface NotificationsPanelProps {
  token: string;
  data: Record<string, unknown>[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const columns: Column[] = [
  { key: "type", label: "Type", render: (v) => <span className="font-medium">{String(v ?? "—").replace(/_/g, " ")}</span> },
  { key: "channel", label: "Canal", render: (v) => String(v ?? "—").toUpperCase() },
  { key: "status", label: "Statut" },
  { key: "createdAt", label: "Date", render: (v) => v ? new Date(String(v)).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-" },
];

export function NotificationsPanel({ token, data, isLoading, page, totalPages, onPageChange }: NotificationsPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{isLoading ? "Chargement..." : `${data.length} notification(s)`}</p>
      </div>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        emptyMessage="Aucune notification."
      />
      <PaginationControls page={page} totalPages={totalPages} isFetching={isLoading} onPageChange={onPageChange} />
    </div>
  );
}

