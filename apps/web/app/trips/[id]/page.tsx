"use client"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button, buttonVariants } from "@/components/ui/button"
import { useLiveSeats } from "@/hooks/useLiveSeats"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { useBookingStore } from "@camermove/frontend"
import { ArrowRight } from "lucide-react"

interface TripDetail {
  id: string
  departureAt: string
  arrivalEstimateAt: string
  price: number
  totalSeats: number
  vehicleTypeInfo: string | null
  status: string
  route: { originCity: string; destinationCity: string } | null
  transport: { companyName: string } | null
  seatAvailability: { seatsAvailable: number; seatsHeld: number; seatsBooked: number } | null
}

async function fetchTrip(id: string): Promise<TripDetail> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
  const res = await fetch(`${base}/api/v1/trips/${id}`, { cache: "no-store" })
  if (!res.ok) throw new Error("Trajet introuvable")
  return res.json()
}

const NAVY = "#14213D"
const OCHRE = "#E8A548"
const TAKEN = "#B8BEC9"
const BORDER = "#E4E1D9"

function buildSeats(totalSeats: number, seatsAvailable: number | null) {
  const takenCount = totalSeats && seatsAvailable != null ? Math.max(0, totalSeats - seatsAvailable) : 0
  const seats: { id: string; label: number; status: "available" | "taken" | "held" }[] = []
  let n = 1
  for (let row = 0; row < 11; row++) {
    for (let col = 0; col < 4; col++) {
      if (n > totalSeats) break
      // Reference pattern: every 5th taken, but saturate with real takenCount first
      const isTaken = n <= takenCount ? true : n % 5 === 0
      seats.push({ id: `${row}-${col}`, label: n, status: isTaken ? "taken" : "available" })
      n++
    }
  }
  return seats
}

function Seat({ seat, onClick }: { seat: { label: number; status: string }; onClick?: () => void }) {
  const map: Record<string, { bg: string; border: string; color: string }> = {
    available: { bg: "white", border: "#D8DCE3", color: NAVY },
    taken: { bg: TAKEN, border: TAKEN, color: "white" },
    held: { bg: OCHRE, border: OCHRE, color: NAVY },
  }
  const s = (map[seat.status] ?? map["available"]!)!
  return (
    <div
      onClick={seat.status === "available" ? onClick : undefined}
      style={{
        width: 32, height: 32, borderRadius: 6, border: `1.5px solid ${s.border}`, background: s.bg, color: s.color,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700,
        cursor: seat.status === "available" ? "pointer" : "not-allowed",
      }}
    >
      {seat.label}
    </div>
  )
}

export default function TripDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const { data: trip, isLoading, error } = useQuery({ queryKey: ["trip", id], queryFn: () => fetchTrip(id) })
  const liveSeats = useLiveSeats(id)
  const { setBooking } = useBookingStore()
  const [seatId, setSeatId] = useState<string | null>(null)
  const [passenger, setPassenger] = useState({ name: "", phone: "" })

  if (isLoading)
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </main>
    )
  if (error || !trip)
    return (
      <main className="mx-auto max-w-2xl p-6">
        <Alert variant="destructive">
          <AlertTitle>Introuvable</AlertTitle>
          <AlertDescription>Ce trajet n&apos;existe plus ou a été annulé.</AlertDescription>
        </Alert>
        <Link href="/" className={cn(buttonVariants({ variant: "link" }), "mt-4")}>
          Retour à l&apos;accueil
        </Link>
      </main>
    )

  const seatsAvailable = liveSeats?.seatsAvailable ?? trip.seatAvailability?.seatsAvailable ?? null
  const dep = new Date(trip.departureAt)
  const arr = new Date(trip.arrivalEstimateAt)
  const statusLabel = trip.status === "active" ? "En vente" : trip.status === "cancelled" ? "Annulé" : trip.status
  const soldOut = seatsAvailable === 0
  const seats = buildSeats(trip.totalSeats, seatsAvailable)
  const rows: typeof seats[] = []
  for (let r = 0; r < 11; r++) { const slice = seats.slice(r * 4, r * 4 + 4); if (slice.length) rows.push(slice) }
  const picked = seats.find((s) => s.id === seatId)
  const seatLabel = picked ? String(picked.label) : "—"
  function pick(id: string) {
    // mimic reference: only one held at a time
    setSeatId(id)
  }
  const displaySeats = seats.map((s) => s.id === seatId ? { ...s, status: "held" as const } : s)
  const displayRows: typeof displaySeats[] = []
  for (let r = 0; r < 11; r++) { const slice = displaySeats.slice(r * 4, r * 4 + 4); if (slice.length) displayRows.push(slice) }

  return (
    <main className="mx-auto max-w-md space-y-4 p-4 pb-28" style={{ background: "#F7F5F0", minHeight: "100vh" }}>
      {/* BackHeader like reference */}
      <div className="flex items-center gap-2">
        <Link href="/results" className="p-1.5 rounded-lg bg-white border" style={{ borderColor: BORDER }}><span className="text-sm" style={{ color: NAVY }}>←</span></Link>
        <div>
          <p className="font-bold text-sm" style={{ color: NAVY }}>{trip.transport?.companyName ?? "Transporteur"}</p>
          <p className="text-xs" style={{ color: "#5A6474" }}>{dep.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} → {arr.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · {trip.vehicleTypeInfo ?? "Classique"}</p>
        </div>
        <Badge className="ml-auto" variant={trip.status === "active" ? "default" : "secondary"}>{statusLabel}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              {trip.route?.originCity ?? "Yaoundé"} → {trip.route?.destinationCity ?? "Douala"}
            </span>
            <Badge variant={trip.status === "active" ? "default" : "secondary"}>{statusLabel}</Badge>
          </CardTitle>
          <CardDescription>
            {trip.transport?.companyName ?? "Transporteur"} · {trip.vehicleTypeInfo ?? "Autocar"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-muted-foreground">Départ</p>
              <p className="font-medium">{dep.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Arrivée estimée</p>
              <p className="font-medium">{arr.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-muted-foreground">Prix</p>
              <p className="text-lg font-bold">{new Intl.NumberFormat("fr-CM").format(trip.price)} XAF</p>
            </div>
          </div>
          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-sm" style={{ color: seatsAvailable != null && seatsAvailable < 5 && seatsAvailable > 0 ? "#C0392B" : "#5A6474" }}>
              {seatsAvailable == null
                ? "Disponibilité en cours…"
                : `${seatsAvailable} place${seatsAvailable > 1 ? "s" : ""} libre${seatsAvailable > 1 ? "s" : ""} / ${trip.totalSeats}`}
            </span>
            <span className="text-xs font-semibold" style={{ color: NAVY }}>{seatsAvailable != null && seatsAvailable < 5 && seatsAvailable > 0 ? `Plus que ${seatsAvailable} place${seatsAvailable > 1 ? "s" : ""}` : ""}</span>
          </div>
        </CardContent>
      </Card>

      {/* Seat map — reference 11x4 */}
      <Card>
        <CardContent className="p-4">
          <p className="text-center text-[10px] tracking-wide font-semibold mb-3" style={{ color: "#9AA2AF" }}>AVANT — chauffeur</p>
          <div className="flex flex-col gap-1.5 items-center">
            {displayRows.map((row, i) => (
              <div key={i} className="flex gap-2">
                {row[0] ? <Seat seat={row[0]} onClick={() => pick(row[0]!.id)} /> : <div style={{ width: 32, height: 32 }} />}
                {row[1] ? <Seat seat={row[1]} onClick={() => pick(row[1]!.id)} /> : <div style={{ width: 32, height: 32 }} />}
                <div style={{ width: 18 }} />
                {row[2] ? <Seat seat={row[2]} onClick={() => pick(row[2]!.id)} /> : <div style={{ width: 32, height: 32 }} />}
                {row[3] ? <Seat seat={row[3]} onClick={() => pick(row[3]!.id)} /> : <div style={{ width: 32, height: 32 }} />}
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-4 text-xs justify-center" style={{ color: "#5A6474" }}>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-white border" style={{ borderColor: "#D8DCE3" }} /> Libre</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: TAKEN }} /> Pris</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: OCHRE }} /> Choisi</span>
          </div>
        </CardContent>
      </Card>

      {picked && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-bold" style={{ color: NAVY }}>Informations voyageur — Siège {seatLabel}</p>
            <input placeholder="Nom complet" value={passenger.name} onChange={(e) => setPassenger({ ...passenger, name: e.target.value })} className="w-full border rounded-lg px-3 py-2.5 text-sm" style={{ borderColor: BORDER, color: NAVY }} />
            <input placeholder="Numéro de téléphone" value={passenger.phone} onChange={(e) => setPassenger({ ...passenger, phone: e.target.value })} className="w-full border rounded-lg px-3 py-2.5 text-sm" style={{ borderColor: BORDER, color: NAVY }} />
          </CardContent>
        </Card>
      )}

      {/* BottomBar like reference */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex items-center justify-between gap-3 p-3 max-w-md mx-auto" style={{ borderColor: BORDER }}>
        <div>
          <p className="text-[10px]" style={{ color: "#5A6474" }}>{picked ? `Siège ${seatLabel}` : "Choisissez un siège"}</p>
          <p className="font-bold text-sm" style={{ color: NAVY }}>{new Intl.NumberFormat("fr-CM").format(trip.price)} XAF</p>
        </div>
        <Button
          disabled={!picked || !passenger.name.trim() || soldOut}
          onClick={() => {
            setBooking({ tripId: trip.id, seatCount: 1, passengers: [{ fullName: passenger.name, phone: passenger.phone }] })
            router.push(`/book/${trip.id}`)
          }}
          className="rounded-xl font-bold"
          style={{ background: (!picked || !passenger.name.trim()) ? "#D8DCE3" : NAVY, color: "white" }}
        >
          Continuer <ArrowRight className="size-4 ml-1" />
        </Button>
      </div>
    </main>
  )
}
