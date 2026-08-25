"use client"
/**
 * Status pill — color-coded badge for booking/ticket status.
 * Per UI-SPEC: confirmed=emerald, pending=amber, cancelled=red, completed=slate.
 * French labels only.
 */

export type StatusKind = "confirmed" | "pending" | "cancelled" | "completed"

const STATUS_LABELS: Record<StatusKind, string> = {
  confirmed: "Confirmé",
  pending: "En attente",
  cancelled: "Annulé",
  completed: "Terminé",
}

const STATUS_CLASSES: Record<StatusKind, string> = {
  confirmed: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
  completed: "bg-slate-100 text-slate-700",
}

/** Map a Prisma BookingStatus / TicketStatus to our StatusKind. */
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
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 font-mono text-xs ${STATUS_CLASSES[resolved]}`}
    >
      {STATUS_LABELS[resolved]}
    </span>
  )
}
