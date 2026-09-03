"use client"
import { useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { fetchRental, createRentalBooking } from "@/lib/api/rentals"
import { useAuthStore } from "@camermove/frontend"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Car, Calendar } from "lucide-react"

function calcDuration(start: string, end: string, unit: string): number {
  if (!start || !end) return 0
  const a = new Date(start + "T00:00:00Z").getTime()
  const b = new Date(end + "T00:00:00Z").getTime()
  const ms = b - a
  if (ms <= 0) return 0
  if (unit === "hour") return Math.ceil(ms / 3600000)
  if (unit === "week") return Math.ceil(ms / (86400000 * 7))
  if (unit === "month") return Math.ceil(ms / (86400000 * 30))
  return Math.ceil(ms / 86400000)
}

export default function RentalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const token = useAuthStore((s) => s.accessToken)
  const { data: vehicle, isLoading } = useQuery({ queryKey: ["rental", id], queryFn: () => fetchRental(id as string), enabled: !!id })

  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [pickupCity, setPickupCity] = useState("")
  const [dropoffCity, setDropoffCity] = useState("")
  const [pickupAddress, setPickupAddress] = useState("")
  const [dropoffAddress, setDropoffAddress] = useState("")
  const [driverName, setDriverName] = useState("")
  const [driverPhone, setDriverPhone] = useState("")
  const [loading, setLoading] = useState(false)

  const duration = useMemo(() => calcDuration(startDate, endDate, vehicle?.durationUnit ?? "day"), [startDate, endDate, vehicle?.durationUnit])
  const total = vehicle && duration ? vehicle.pricePerUnit * duration : 0

  async function handleBook() {
    if (!token) { toast.error("Connectez-vous pour réserver"); router.push("/login?next=/rentals/" + id); return }
    if (!vehicle) return
    if (!startDate || !endDate || duration < 1) { toast.error("Dates invalides"); return }
    if (!pickupCity) { toast.error("Ville de retrait requise"); return }
    setLoading(true)
    try {
      await createRentalBooking(token, {
        rentalVehicleId: vehicle.id,
        startDate,
        endDate,
        pickupCity,
        pickupAddress: pickupAddress || undefined,
        dropoffCity: dropoffCity || pickupCity,
        dropoffAddress: dropoffAddress || undefined,
        driverName: driverName || undefined,
        driverPhone: driverPhone || undefined,
      })
      toast.success("Réservation créée")
      router.push("/dashboard?tab=rentals")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec réservation")
    } finally { setLoading(false) }
  }

  if (isLoading) return <main className="mx-auto max-w-4xl p-6"><Skeleton className="h-64 w-full" /></main>
  if (!vehicle) return <main className="mx-auto max-w-4xl p-6"><p>Véhicule introuvable.</p></main>

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Car className="size-6" /> {vehicle.make} {vehicle.model}</h1>
        <p className="text-sm text-muted-foreground">{vehicle.category} · {vehicle.capacity} places · {vehicle.pickupCity} · {vehicle.durationUnit} {vehicle.hasDriver ? "· avec chauffeur" : ""}</p>
        <div className="flex gap-1 mt-2">{vehicle.amenities.slice(0, 5).map((a) => <Badge key={a} variant="secondary">{a}</Badge>)}</div>
        {vehicle.photos?.length ? <div className="mt-4 grid grid-cols-2 gap-2">{vehicle.photos.slice(0, 4).map((p) => <img key={p} src={p} alt="" className="h-40 object-cover rounded-xl" />)}</div> : null}
        <p className="mt-3 text-lg font-bold">{new Intl.NumberFormat("fr-CM").format(vehicle.pricePerUnit)} XAF / {vehicle.durationUnit}</p>
      </div>
      <Separator />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="size-4" /> Détails & conditions</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <p><b>Capacité:</b> {vehicle.capacity} · <b>Transmission:</b> {vehicle.transmission ?? "—"} · <b>Carburant:</b> {vehicle.fuelType ?? "—"}</p>
            <p className="text-muted-foreground">Le véhicule est disponible à {vehicle.pickupCity}. Annulation selon politique affichée lors du paiement.</p>
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader><CardTitle className="text-base">Réserver</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs">Début</label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
              <div><label className="text-xs">Fin</label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
            </div>
            <div><label className="text-xs">Ville retrait</label><Input value={pickupCity} onChange={(e) => setPickupCity(e.target.value)} placeholder={vehicle.pickupCity} /></div>
            <div><label className="text-xs">Adresse retrait</label><Input value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} placeholder="Optionnel" /></div>
            <div><label className="text-xs">Ville restitution</label><Input value={dropoffCity} onChange={(e) => setDropoffCity(e.target.value)} placeholder={pickupCity || vehicle.pickupCity} /></div>
            <div><label className="text-xs">Adresse restitution</label><Input value={dropoffAddress} onChange={(e) => setDropoffAddress(e.target.value)} placeholder="Optionnel" /></div>
            {vehicle.hasDriver && (
              <>
                <div><label className="text-xs">Nom chauffeur</label><Input value={driverName} onChange={(e) => setDriverName(e.target.value)} /></div>
                <div><label className="text-xs">Téléphone chauffeur</label><Input value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} /></div>
              </>
            )}
            {duration > 0 && <Alert><AlertDescription>{duration} {vehicle.durationUnit}(s) × {new Intl.NumberFormat("fr-CM").format(vehicle.pricePerUnit)} = <b>{new Intl.NumberFormat("fr-CM").format(total)} XAF</b></AlertDescription></Alert>}
            <Button className="w-full" onClick={handleBook} disabled={loading || duration < 1}>{loading ? "Réservation..." : `Payer ${total ? new Intl.NumberFormat("fr-CM").format(total) + " XAF" : ""}`}</Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
