"use client"
import { useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { fetchHotel, createHotelBooking } from "@/lib/api/hotels"
import { useAuthStore } from "@camermove/frontend"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Bed, Users, Calendar } from "lucide-react"

export default function HotelDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const token = useAuthStore((s) => s.accessToken)
  const { data: hotel, isLoading } = useQuery({ queryKey: ["hotel", id], queryFn: () => fetchHotel(id as string), enabled: !!id })

  const [selectedRoom, setSelectedRoom] = useState<string>("")
  const [checkIn, setCheckIn] = useState("")
  const [checkOut, setCheckOut] = useState("")
  const [guests, setGuests] = useState(2)
  const [guestNames, setGuestNames] = useState<string[]>(["", ""])
  const [specialRequests, setSpecialRequests] = useState("")
  const [loading, setLoading] = useState(false)

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0
    const a = new Date(checkIn + "T00:00:00Z").getTime()
    const b = new Date(checkOut + "T00:00:00Z").getTime()
    const d = Math.round((b - a) / 86400000)
    return d > 0 ? d : 0
  }, [checkIn, checkOut])

  const room = hotel?.rooms.find((r) => r.id === selectedRoom)
  const total = room && nights ? room.pricePerNight * nights : 0

  function handleGuestsChange(n: number) {
    setGuests(n)
    setGuestNames((prev) => {
      const arr = [...prev]
      while (arr.length < n) arr.push("")
      return arr.slice(0, n)
    })
  }

  async function handleBook() {
    if (!token) { toast.error("Connectez-vous pour réserver"); router.push("/login?next=/hotels/" + id); return }
    if (!selectedRoom) { toast.error("Choisissez une chambre"); return }
    if (!checkIn || !checkOut || nights < 1) { toast.error("Dates invalides"); return }
    if (!hotel) return
    setLoading(true)
    try {
      await createHotelBooking(token, { hotelId: hotel.id, roomTypeId: selectedRoom, checkIn, checkOut, guests, guestNames: guestNames.filter(Boolean), specialRequests: specialRequests || undefined })
      toast.success("Réservation créée")
      router.push("/dashboard?tab=hotels")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec réservation")
    } finally { setLoading(false) }
  }

  if (isLoading) return <main className="mx-auto max-w-4xl p-6 space-y-4"><Skeleton className="h-64 w-full" /><Skeleton className="h-40 w-full" /></main>
  if (!hotel) return <main className="mx-auto max-w-4xl p-6"><p>Hôtel introuvable.</p></main>

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{hotel.name}</h1>
        <p className="text-sm text-muted-foreground">{hotel.city} {hotel.starRating ? `· ${hotel.starRating}★` : ""}</p>
        {hotel.description && <p className="mt-2 text-sm leading-relaxed">{hotel.description}</p>}
        <div className="flex flex-wrap gap-1 mt-2">{hotel.amenities.map((a) => <Badge key={a} variant="secondary">{a}</Badge>)}</div>
        {hotel.photos?.length ? <div className="mt-4 grid grid-cols-2 gap-2">{hotel.photos.slice(0, 4).map((p) => <img key={p} src={p} alt="" className="h-40 object-cover rounded-xl" />)}</div> : null}
      </div>

      <Separator />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Bed className="size-4" /> Chambres</h2>
          {hotel.rooms.length === 0 && <p className="text-sm text-muted-foreground">Aucune chambre disponible.</p>}
          {hotel.rooms.map((r) => (
            <Card key={r.id} className={selectedRoom === r.id ? "border-primary" : ""}>
              <CardContent className="p-4 flex justify-between gap-4">
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="size-3" /> {r.capacity} pers · {r.bedType ?? "—"} · x{r.quantity}</p>
                  <div className="flex flex-wrap gap-1 mt-1">{r.amenities.slice(0, 4).map((a) => <Badge key={a} variant="outline" className="text-[11px]">{a}</Badge>)}</div>
                  <p className="mt-2 text-sm font-bold">{new Intl.NumberFormat("fr-CM").format(r.pricePerNight)} XAF / nuit</p>
                </div>
                <Button size="sm" variant={selectedRoom === r.id ? "default" : "outline"} onClick={() => setSelectedRoom(r.id)}>{selectedRoom === r.id ? "Sélectionnée" : "Choisir"}</Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="h-fit">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Calendar className="size-4" /> Réserver</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs">Arrivée</label><Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} /></div>
              <div><label className="text-xs">Départ</label><Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} /></div>
            </div>
            <div><label className="text-xs">Voyageurs</label><Input type="number" min={1} max={10} value={guests} onChange={(e) => handleGuestsChange(Number(e.target.value) || 1)} /></div>
            {nights > 0 && room && <Alert><AlertDescription>{nights} nuit(s) × {new Intl.NumberFormat("fr-CM").format(room.pricePerNight)} = <b>{new Intl.NumberFormat("fr-CM").format(total)} XAF</b></AlertDescription></Alert>}
            <div className="space-y-2">
              <label className="text-xs font-medium">Noms des voyageurs</label>
              {guestNames.map((n, i) => (
                <Input key={i} placeholder={`Voyageur ${i + 1}`} value={n} onChange={(e) => setGuestNames((prev) => { const a=[...prev]; a[i]=e.target.value; return a })} />
              ))}
            </div>
            <div><label className="text-xs">Demandes spéciales</label><Input value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} placeholder="Optionnel" /></div>
            <Button className="w-full" onClick={handleBook} disabled={loading || !selectedRoom || nights < 1}>{loading ? "Réservation..." : `Payer ${total ? new Intl.NumberFormat("fr-CM").format(total) + " XAF" : ""}`}</Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
