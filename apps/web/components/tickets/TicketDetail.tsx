"use client"

import Link from "next/link"
import { useState } from "react"
import type { TicketDetailResponse } from "../../lib/api/tickets"
import { StatusPill, mapTicketStatus } from "../dashboard-v2/cards/StatusPill"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { buttonVariants } from "@/components/ui/button"
import { RateYourTrip } from "./RateYourTrip"
import { cn } from "@/lib/utils"
import { ArrowRight, BusFront, Clock, MapPin, Phone, Star } from "lucide-react"

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

/**
 * Beautiful boarding-pass style ticket.
 *
 * Layout: a vertical stack of three "tear-off" cards that visually mimic
 * the airline / intercity coach boarding pass:
 *   1. Header strip (agency brand color, name + tagline + glyph).
 *   2. Main boarding card (origin → destination, departure/arrival, QR).
 *   3. Passenger + seat + stop corridor.
 *   4. Rate your trip (multi-rating panel — Trip + Transporter).
 *
 * Single source of truth: only consumes TicketDetailResponse.
 */
export function TicketDetail({ data }: { data: TicketDetailResponse }) {
  const brand = data.agency.brandColor || "#0E0E0E"
  const departure = fmtDate(data.trip.departureAt)
  const arrival = fmtDate(data.trip.arrivalAt)
  const boarding = data.boardingStop ? fmtTime(new Date(new Date(data.trip.departureAt).getTime() + data.boardingStop.offsetMinutes * 60_000).toISOString()) : null
  const dropOff = data.dropOffStop ? fmtTime(new Date(new Date(data.trip.departureAt).getTime() + data.dropOffStop.offsetMinutes * 60_000).toISOString()) : null

  return (
    <div className="flex flex-col gap-6">
      {/* Brand strip */}
      <header
        className="relative overflow-hidden rounded-2xl px-5 py-4 text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, ${brand} 0%, ${shade(brand, -25)} 100%)` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-xl bg-white/15 text-2xl backdrop-blur-sm">
              {data.agency.accentGlyph || "🚌"}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/65">CamerMove · Billet</p>
              <h1 className="text-base font-semibold leading-tight">{data.agency.companyName}</h1>
              {data.agency.tagline && (
                <p className="text-[11px] text-white/70 line-clamp-1">{data.agency.tagline}</p>
              )}
            </div>
          </div>
          <StatusPill kind={mapTicketStatus(data.status)} />
        </div>
        {data.agency.phone && (
          <a
            href={`tel:${data.agency.phone}`}
            className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-medium text-white/90 hover:bg-white/25"
          >
            <Phone className="size-3" /> {data.agency.phone}
          </a>
        )}
      </header>

      {/* Main boarding card */}
      <div className="relative">
        <div
          className="absolute inset-x-0 -top-3 mx-auto h-6 w-6 rounded-full bg-[var(--background)]"
          style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)" }}
          aria-hidden
        />
        <Card className="overflow-hidden border-2 shadow-xl" style={{ borderColor: brand }}>
          <CardContent className="p-0">
            {/* Origin / Destination hero */}
            <div className="grid grid-cols-12 gap-3 px-5 pt-5 pb-4">
              <div className="col-span-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Départ</p>
                <p className="mt-1 font-mono text-2xl font-bold leading-none tracking-tight">{data.trip.origin}</p>
                <p className="mt-2 text-xs font-medium text-foreground">{fmtTime(data.trip.departureAt)}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{fmtDate(data.trip.departureAt).split(" ").slice(0, 3).join(" ")}</p>
              </div>
              <div className="col-span-2 flex flex-col items-center justify-center pt-3">
                <ArrowRight className="size-5" style={{ color: brand }} />
                <div className="mt-1 flex items-center gap-1">
                  <span className="block h-px w-2" style={{ background: brand }} />
                  <span className="block size-1.5 rounded-full" style={{ background: brand }} />
                  <span className="block h-px w-2" style={{ background: brand }} />
                </div>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {data.trip.vehicleTypeInfo || "Autocar"}
                </p>
              </div>
              <div className="col-span-5 text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Arrivée</p>
                <p className="mt-1 font-mono text-2xl font-bold leading-none tracking-tight">{data.trip.destination}</p>
                <p className="mt-2 text-xs font-medium text-foreground">{fmtTime(data.trip.arrivalAt)}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{fmtDate(data.trip.arrivalAt).split(" ").slice(0, 3).join(" ")}</p>
              </div>
            </div>

            {/* Dotted tear-off */}
            <div className="relative px-5">
              <div className="border-t-2 border-dashed" style={{ borderColor: `${brand}30` }} />
            </div>

            {/* QR + boarding strip */}
            <div className="grid grid-cols-12 gap-3 px-5 py-5">
              <div className="col-span-5 flex flex-col items-center justify-center">
                {data.qrDataUrl ? (
                  <div className="rounded-xl border p-2 shadow-inner" style={{ borderColor: `${brand}20` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={data.qrDataUrl} alt="QR code du billet" loading="eager" fetchPriority="high" className="h-[120px] w-[120px]" />
                  </div>
                ) : (
                  <div className="grid h-[120px] w-[120px] place-items-center rounded-xl border border-dashed text-xs text-muted-foreground">
                    QR indisponible
                  </div>
                )}
                <p className="mt-2 font-mono text-sm font-bold" style={{ color: brand }}>{data.verificationCode}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Code de vérification</p>
              </div>
              <div className="col-span-7 flex flex-col justify-between gap-2">
                <BoardingField label="Référence" value={data.reference} mono accent={brand} />
                <BoardingField label="Sièges" value={data.seatLabels.length > 0 ? data.seatLabels.join(" · ") : `${data.trip.seatCount} pl.`} accent={brand} />
                <BoardingField label="Véhicule" value={data.trip.vehiclePlate || "—"} mono accent={brand} />
                <BoardingField label="Passagers" value={`${data.passengers.length}`} accent={brand} />
              </div>
            </div>

            {/* Corridor stops (boarding / drop-off) */}
            {(data.boardingStop || data.dropOffStop) && (
              <div className="border-t-2 border-dashed px-5 py-4" style={{ borderColor: `${brand}30` }}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Arrêts sur le trajet</p>
                <div className="mt-2 grid grid-cols-12 gap-2">
                  {data.boardingStop && (
                    <StopCard
                      label="Embarquement"
                      name={data.boardingStop.name}
                      eta={boarding}
                      kind="boarding"
                      accent={brand}
                    />
                  )}
                  <StopCard
                    label="Terminus"
                    name={data.trip.destination}
                    eta={fmtTime(data.trip.arrivalAt)}
                    kind="terminus"
                    accent={brand}
                  />
                  {data.dropOffStop && (
                    <StopCard
                      label="Débarquement"
                      name={data.dropOffStop.name}
                      eta={dropOff}
                      kind="dropoff"
                      accent={brand}
                    />
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <div
          className="absolute inset-x-0 -bottom-3 mx-auto h-6 w-6 rounded-full bg-[var(--background)]"
          style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)" }}
          aria-hidden
        />
      </div>

      {/* Passenger list */}
      <Card>
        <CardContent className="p-4">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <BusFront className="size-3.5" /> Passagers
          </p>
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {data.passengers.map((p, i) => (
              <li key={`${p.firstName}-${i}`} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium">{p.firstName} {p.lastName}</span>
                <Badge variant="secondary" className="font-mono text-[11px]">Siège {p.seatNumber}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Multi-rating panel — full multi-rating UX with sub-scores */}
      <RateYourTrip
        tripId={data.ratingContext.tripId}
        transporterId={data.ratingContext.transporterId}
        bookingId={data.ratingContext.bookingId}
        tripLabel={`${data.trip.origin} → ${data.trip.destination}`}
        agencyName={data.agency.companyName}
      />

      {/* CTA */}
      <Link href="/dashboard" className={cn(buttonVariants(), "w-full rounded-full")}>
        <MapPin className="mr-2 size-4" /> Voir mes voyages
      </Link>
    </div>
  )
}

/* — Internal building blocks ———————————————————————————————— */

function BoardingField({
  label,
  value,
  mono,
  accent,
}: {
  label: string
  value: string
  mono?: boolean
  accent: string
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-1.5" style={{ borderColor: `${accent}25` }}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-bold", mono && "font-mono")} style={{ color: accent }}>
        {value}
      </span>
    </div>
  )
}

function StopCard({
  label,
  name,
  eta,
  kind,
  accent,
}: {
  label: string
  name: string
  eta: string | null
  kind: "boarding" | "terminus" | "dropoff"
  accent: string
}) {
  const dot = kind === "boarding" ? "🟢" : kind === "terminus" ? "🔴" : "🟡"
  return (
    <div className="col-span-12 sm:col-span-4 rounded-lg border bg-muted/30 px-3 py-2" style={{ borderColor: `${accent}25` }}>
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        <span>{dot}</span> {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold leading-tight">{name}</p>
      {eta && (
        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="size-3" /> {eta}
        </p>
      )}
    </div>
  )
}

/** Darken or lighten a hex color by a percent (-100..100). */
function shade(hex: string, percent: number): string {
  const m = hex.match(/^#([0-9a-f]{6})$/i)
  if (!m) return hex
  const num = parseInt(m[1]!, 16)
  const r = clamp(((num >> 16) & 0xff) + Math.round((percent / 100) * 255))
  const g = clamp(((num >> 8) & 0xff) + Math.round((percent / 100) * 255))
  const b = clamp((num & 0xff) + Math.round((percent / 100) * 255))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`
}
function clamp(n: number): number {
  return Math.min(255, Math.max(0, n))
}