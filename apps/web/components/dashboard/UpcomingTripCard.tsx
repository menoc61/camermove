"use client"
/**
 * UpcomingTripCard — compact preview card for a confirmed/upcoming booking.
 * Links to the ticket detail page (if a ticket was issued) or stays as
 * read-only state otherwise.
 */
import Link from "next/link"
import type { DashboardItem } from "../../lib/api/dashboard"
import { StatusPill } from "./StatusPill"

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

function fmtAmount(value: number): string {
  return `${value.toLocaleString("fr-FR")} FCFA`
}

export function UpcomingTripCard({ item }: { item: DashboardItem }) {
  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-slate-500">Réf. {item.reference}</p>
          <p className="mt-1 text-base font-semibold text-slate-900">
            {item.origin} → {item.destination}
          </p>
          <p className="mt-1 text-sm text-slate-500">{fmtDate(item.departureAt)}</p>
        </div>
        <StatusPill status={item.status} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-900">{fmtAmount(item.totalAmount)}</span>
        {item.ticketId ? (
          <Link
            href={`/tickets/${item.ticketId}`}
            className="rounded-lg bg-[#0e9f8f] px-3 py-1.5 text-xs font-medium text-white"
          >
            Voir billet
          </Link>
        ) : (
          <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
            Billet à venir
          </span>
        )}
      </div>
    </article>
  )
}
