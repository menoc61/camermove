"use client";
import { Badge } from "@/components/ui/badge";

export type StatusKind = "confirmed" | "pending" | "cancelled" | "completed" | "expired";

const LABELS: Record<StatusKind, string> = {
  confirmed: "Confirmé",
  pending: "En attente",
  cancelled: "Annulé",
  completed: "Terminé",
  expired: "Expiré",
};

const VARIANTS = {
  confirmed: "default",
  pending: "secondary",
  cancelled: "destructive",
  completed: "outline",
  expired: "ghost",
} as const;

export function mapBookingStatus(status: string): StatusKind {
  switch (status) {
    case "confirmed":
      return "confirmed";
    case "pending_payment":
      return "pending";
    case "cancelled":
    case "refunded":
      return "cancelled";
    case "expired":
      return "expired";
    default:
      return "pending";
  }
}

export function mapTicketStatus(status: string): StatusKind {
  switch (status) {
    case "valid":
      return "confirmed";
    case "used":
      return "completed";
    case "void":
      return "cancelled";
    default:
      return "pending";
  }
}

export function StatusPill({ status, kind }: { status?: string; kind?: StatusKind }) {
  const resolved: StatusKind = kind ?? (status ? mapBookingStatus(status) : "pending");
  return <Badge variant={VARIANTS[resolved]}>{LABELS[resolved]}</Badge>;
}
