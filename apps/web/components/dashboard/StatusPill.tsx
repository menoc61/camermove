"use client"
import { Badge } from "@/components/ui/badge"

export type StatusKind = "confirmed" | "pending" | "cancelled" | "completed"

const STATUS_LABELS: Record<StatusKind, string> = {
  confirmed: "Confirmé",
  pending: "En attente",
  cancelled: "Annulé",
  completed: "Terminé",
}

const STATUS_VARIANT: Record<StatusKind, string> = {
  confirmed: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
  pending: "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100",
  cancelled: "bg-red-100 text-red-700 border-red-200 hover:bg-red-100",
  completed: "bg-muted text-muted-foreground border-transparent",
}

export function mapBookingStatus(status: string): StatusKind {
  switch (status) {
    case "confirmed":
      return "confirmed"
    case "pending_payment":
      return "pending"
    case "cancelled":
    case "refunded":
      return "cancelled"
    case "expired":
      return "completed"
    default:
      return "pending"
  }
}

export function mapTicketStatus(status: string): StatusKind {
  switch (status) {
    case "valid":
      return "confirmed"
    case "used":
      return "completed"
    case "void":
      return "cancelled"
    default:
      return "pending"
  }
}

export function StatusPill({ status, kind }: { status?: string; kind?: StatusKind }) {
  const resolved: StatusKind = kind ?? (status ? mapBookingStatus(status) : "pending")
  return (
    <Badge variant="outline" className={STATUS_VARIANT[resolved]}>
      {STATUS_LABELS[resolved]}
    </Badge>
  )
}
