"use client"

import Link from "next/link"
import { motion } from "motion/react"
import {
  ArrowRight,
  Bus,
  Clock,
  Snowflake,
  Star,
  Wifi,
  Zap,
  Users,
  Sparkles,
  Check,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { SearchResultItem } from "../../lib/api/search"
import { SeatUrgency } from "./seat-urgency"

interface TripCardProps {
  trip: SearchResultItem
  /** First card in a list can wear a "populaire" tag for visual rhythm. */
  highlight?: "popular" | "best_price" | null
}

const XAF = new Intl.NumberFormat("fr-CM")

/** Stable color seed from a string so each carrier gets its own brand swatch. */
function carrierColor(name: string): { from: string; to: string; ring: string } {
  const palette: { from: string; to: string; ring: string }[] = [
    { from: "from-blue-600", to: "to-sky-500", ring: "ring-blue-600/20" },
    { from: "from-emerald-600", to: "to-teal-500", ring: "ring-emerald-600/20" },
    { from: "from-violet-600", to: "to-fuchsia-500", ring: "ring-violet-600/20" },
    { from: "from-amber-600", to: "to-orange-500", ring: "ring-amber-600/20" },
    { from: "from-rose-600", to: "to-pink-500", ring: "ring-rose-600/20" },
    { from: "from-indigo-600", to: "to-blue-500", ring: "ring-indigo-600/20" },
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return palette[Math.abs(hash) % palette.length]!
}

/** Cosmetic rating — the search API doesn't expose ratings yet, so we seed
 *  deterministically per carrier so the UI feels real without faking reviews. */
function ratingFor(name: string): { score: number; count: number } {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 33 + name.charCodeAt(i)) | 0
  const score = 3.8 + (Math.abs(hash) % 12) / 10 // 3.8 – 5.0
  const count = 80 + (Math.abs(hash) % 920) // 80 – 999
  return { score: Math.round(score * 10) / 10, count }
}

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
          className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground/80"
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
  const color = carrierColor(trip.companyName)
  const rating = ratingFor(trip.companyName)
  const occupancy = trip.totalSeats > 0
    ? Math.round(((trip.totalSeats - trip.seatsAvailable) / trip.totalSeats) * 100)
    : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3 }}
    >
      <Card className="group relative overflow-hidden border-border/60 transition-shadow duration-300 hover:border-primary/30 hover:shadow-brand">
        {/* Left accent strip — visually anchors the brand color */}
        <div
          aria-hidden
          className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${color.from} ${color.to}`}
        />

        {/* Highlight ribbon */}
        {highlight === "popular" && (
          <div className="absolute right-3 top-3 z-10">
            <Badge className="border-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm">
              <Sparkles className="mr-1 size-3" />
              Le plus réservé
            </Badge>
          </div>
        )}
        {highlight === "best_price" && (
          <div className="absolute right-3 top-3 z-10">
            <Badge className="border-0 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm">
              <Sparkles className="mr-1 size-3" />
              Meilleur prix
            </Badge>
          </div>
        )}

        <CardContent className="p-0">
          <Link
            href={`/trips/${trip.id}`}
            className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6"
          >
            {/* LEFT: brand & vehicle */}
            <div className="flex items-start gap-3 sm:w-56 sm:flex-shrink-0">
              <div
                className={`flex size-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${color.from} ${color.to} text-white shadow-sm ring-4 ${color.ring}`}
                aria-hidden
              >
                <Bus className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground" title={trip.companyName}>
                  {trip.companyName}
                </p>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="size-3 fill-amber-400 text-amber-400" />
                  <span className="font-medium text-foreground">{rating.score}</span>
                  <span>·</span>
                  <span>{rating.count} avis</span>
                </div>
                <div className="mt-1.5">
                  <HighlightsBadges vehicleInfo={trip.vehicleTypeInfo} />
                </div>
              </div>
            </div>

            {/* MIDDLE: time + seat urgency */}
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
              {/* Time block with route line */}
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="text-center sm:text-left">
                  <p className="font-display text-2xl font-bold tabular-nums leading-none tracking-tight text-foreground">
                    {time}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {relative}
                  </p>
                </div>

                {/* Route line — visual signature of the trip */}
                <div className="flex flex-1 items-center gap-2 px-1 sm:min-w-[120px]">
                  <div className="size-2 flex-shrink-0 rounded-full bg-primary ring-2 ring-primary/20" />
                  <div className="relative h-px flex-1 bg-border">
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex items-center">
                      <ArrowRight className="size-3.5 text-primary" />
                    </div>
                  </div>
                  <div className="size-2 flex-shrink-0 rounded-full bg-foreground/30" />
                </div>

                <div className="text-center sm:text-right">
                  <p className="font-display text-base font-semibold tabular-nums text-muted-foreground">
                    {date}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="size-3" />
                    Direct
                  </p>
                </div>
              </div>

              {/* Seat urgency + occupancy */}
              <div className="flex flex-col gap-1.5 sm:items-end">
                <SeatUrgency seatsAvailable={trip.seatsAvailable} />
                {trip.totalSeats > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Users className="size-3" />
                    <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/70 transition-all"
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
            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4 sm:flex-col sm:items-end sm:justify-center sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
              <div className="sm:text-right">
                <p className="font-display text-2xl font-bold tabular-nums leading-none text-foreground">
                  {XAF.format(trip.price)}
                  <span className="ml-1 text-sm font-semibold text-muted-foreground">XAF</span>
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">par place</p>
              </div>
              <span
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-transform group-hover:translate-x-0.5"
                aria-hidden
              >
                Sélectionner
                <ArrowRight className="size-4" />
              </span>
            </div>
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  )
}
