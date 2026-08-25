"use client"
import Link from "next/link"
import type { SearchResultItem } from "../../lib/api/search"
import { t } from "@camermove/frontend"
export function TripCard({ trip }: { trip: SearchResultItem }) {
  const time = new Date(trip.departureAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  return (
    <Link href={`/trips/${trip.id}`} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
      <div>
        <div className="font-medium">{trip.companyName}</div>
        <div className="text-xs text-slate-500">{time} · {trip.vehicleTypeInfo ?? ""}</div>
      </div>
      <div className="text-right">
        <div className="text-lg font-semibold">{trip.price} XAF</div>
        <div className="text-xs text-slate-500">{trip.seatsAvailable} {t("search.seats")}</div>
      </div>
    </Link>
  )
}
