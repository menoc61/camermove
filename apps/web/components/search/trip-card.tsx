"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { ArrowRight, Clock, Wifi, Snowflake, Zap, Users, Check } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { SearchResultItem } from "../../lib/api/search"
import { SeatUrgency } from "./seat-urgency"

interface TripCardProps {
  trip: SearchResultItem
  highlight?: "popular" | "best_price" | null
}

const XAF = new Intl.NumberFormat("fr-CM")

function formatDeparture(iso: string): { time: string; date: string; relative: string } {
  const d = new Date(iso)
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  const date = d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" })
  const now = Date.now()
  const diff = d.getTime() - now
  const hours = Math.max(0, Math.round(diff / 3_600_000))
  const relative =
    hours <= 0
      ? "Départ imminent"
      : hours === 1
        ? "Départ dans 1 h"
        : hours < 24
          ? `Départ dans ${hours} h`
          : `Départ ${date}`
  return { time, date, relative }
}

function HighlightsBadges({ vehicleInfo }: { vehicleInfo: string | null }) {
  const text = (vehicleInfo ?? "").toLowerCase()
  const has = (key: string) => text.includes(key)
  const items: { icon: React.ReactNode; label: string }[] = []
  if (has("clim") || has("a/c") || has("climatisé")) {
    items.push({ icon: <Snowflake className="size-3" />, label: "Climatisé" })
  }
  if (has("wifi")) items.push({ icon: <Wifi className="size-3" />, label: "Wi-Fi" })
  if (has("express") || has("rapide") || has("vip")) {
    items.push({ icon: <Zap className="size-3" />, label: "Express" })
  }
  if (items.length === 0) {
    items.push({ icon: <Check className="size-3" />, label: "Tout confort" })
  }
  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {items.slice(0, 3).map((it, i) => (
        <li
          key={i}
          className="inline-flex items-center gap-1 border border-line bg-paper px-1.5 py-0.5 text-[11px] font-medium text-ink-1"
        >
          {it.icon}
          {it.label}
        </li>
      ))}
    </ul>
  )
}

export function TripCard({ trip, highlight = null }: TripCardProps) {
  const { time, date, relative } = formatDeparture(trip.departureAt)
  const occupancy = trip.totalSeats > 0
    ? Math.round(((trip.totalSeats - trip.seatsAvailable) / trip.totalSeats) * 100)
    : 0
  const initial = (trip.companyName ?? "?").charAt(0).toUpperCase()

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
    >
      <Card className="group relative overflow-hidden border border-line bg-surface-1 transition-colors hover:bg-surface-2">
        <CardContent className="p-0">
          <Link
            href={`/trips/${trip.id}`}
            className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6"
          >
            {/* LEFT: carrier */}
            <div className="flex items-start gap-3 sm:w-56 sm:flex-shrink-0">
              <div
                className="flex size-12 flex-shrink-0 items-center justify-center border border-ink bg-paper text-base font-medium text-ink"
                aria-hidden
              >
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm font-semibold text-ink"
                  title={trip.companyName}
                >
                  {trip.companyName}
                </p>
                <div className="mt-1.5">
                  <HighlightsBadges vehicleInfo={trip.vehicleTypeInfo} />
                </div>
              </div>
            </div>

            {/* MIDDLE: time + occupancy */}
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="text-center sm:text-left">
                  <p className="text-2xl font-medium tabular-nums leading-none tracking-tight text-ink">
                    {time}
                  </p>
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.22em] text-ink-2">
                    {relative}
                  </p>
                </div>

                {/* Route line — Swiss hairline */}
                <div className="flex flex-1 items-center gap-2 px-1 sm:min-w-[120px]" aria-hidden>
                  <div className="size-1.5 flex-shrink-0 bg-ink" />
                  <div className="relative h-px flex-1 bg-line">
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex items-center">
                      <ArrowRight className="size-3.5 text-ink-1" />
                    </div>
                  </div>
                  <div className="size-1.5 flex-shrink-0 bg-ink-2" />
                </div>

                <div className="text-center sm:text-right">
                  <p className="text-sm font-medium tabular-nums text-ink-1">{date}</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-ink-2">
                    <Clock className="size-3" />
                    Direct
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 sm:items-end">
                <SeatUrgency seatsAvailable={trip.seatsAvailable} />
                {trip.totalSeats > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-ink-2">
                    <Users className="size-3" />
                    <div className="h-1 w-16 overflow-hidden bg-surface-3">
                      <div
                        className="h-full bg-ink transition-all"
                        style={{ width: `${occupancy}%` }}
                        aria-hidden
                      />
                    </div>
                    <span className="tabular-nums">{occupancy}%</span>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: price + CTA */}
            <div className="flex items-center justify-between gap-3 border-t border-line pt-4 sm:flex-col sm:items-end sm:justify-center sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
              <div className="sm:text-right">
                {highlight === "best_price" && (
                  <p className="mb-1 inline-block border border-wood-dark px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.22em] text-wood-dark">
                    Meilleur prix
                  </p>
                )}
                {highlight === "popular" && (
                  <p className="mb-1 inline-block border border-ink px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.22em] text-ink">
                    Le plus réservé
                  </p>
                )}
                <p className="text-2xl font-medium tabular-nums leading-none text-ink">
                  {XAF.format(trip.price)}
                  <span className="ml-1 text-sm font-medium text-ink-2">XAF</span>
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink-2">par place</p>
              </div>
              <span
                className="inline-flex h-9 items-center gap-2 border border-ink bg-ink px-4 text-xs font-medium uppercase tracking-[0.22em] text-paper transition-colors group-hover:bg-paper group-hover:text-ink"
                aria-hidden
              >
                Sélectionner
                <ArrowRight className="size-3.5" />
              </span>
            </div>
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  )
}
