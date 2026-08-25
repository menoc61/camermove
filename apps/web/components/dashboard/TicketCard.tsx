"use client"
/**
 * TicketCard — compact preview card for a ticket (QR scan). Links to the
 * full ticket detail page.
 */
import Link from "next/link"
import type { DashboardTicketItem } from "../../lib/api/dashboard"
import { StatusPill, mapTicketStatus } from "./StatusPill"

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

export function TicketCard({ item }: { item: DashboardTicketItem }) {
  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-slate-500">{item.verificationCode}</p>
          <p className="mt-1 text-base font-semibold text-slate-900">
            {item.origin} → {item.destination}
          </p>
          <p className="mt-1 text-sm text-slate-500">{fmtDate(item.departureAt)}</p>
        </div>
        <StatusPill kind={mapTicketStatus(item.status)} />
      </div>
      <div className="mt-3 flex justify-end">
        <Link
          href={`/tickets/${item.id}`}
          className="rounded-lg bg-[#0e9f8f] px-3 py-1.5 text-xs font-medium text-white"
        >
          Voir QR
        </Link>
      </div>
    </article>
  )
}
