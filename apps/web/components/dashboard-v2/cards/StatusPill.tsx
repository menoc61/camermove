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

const GENERIC_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "ghost" }> = {
  // booking (mirror of LABELS via kinds)
  confirmed: { label: "Confirmé", variant: "default" },
  pending_payment: { label: "En attente", variant: "secondary" },
  cancelled: { label: "Annulé", variant: "destructive" },
  refunded: { label: "Remboursé", variant: "destructive" },
  expired: { label: "Expiré", variant: "ghost" },
  // tickets
  valid: { label: "Valide", variant: "default" },
  used: { label: "Utilisé", variant: "default" },
  void: { label: "Annulé", variant: "destructive" },
  // parcels
  registered: { label: "Enregistré", variant: "secondary" },
  picked_up: { label: "Pris en charge", variant: "default" },
  in_transit: { label: "En transit", variant: "secondary" },
  arrived: { label: "Arrivé", variant: "default" },
  available_for_pickup: { label: "Disponible", variant: "secondary" },
  delivered: { label: "Livré", variant: "default" },
  returned: { label: "Retourné", variant: "outline" },
  // generic
  active: { label: "Actif", variant: "default" },
  completed: { label: "Terminé", variant: "default" },
  paid: { label: "Payé", variant: "default" },
  failed: { label: "Échoué", variant: "destructive" },
  queued: { label: "En file", variant: "secondary" },
  sent: { label: "Envoyé", variant: "default" },
  pending: { label: "En attente", variant: "secondary" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = GENERIC_LABELS[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
