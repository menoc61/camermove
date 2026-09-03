"use client"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import type { DashboardResponse } from "../../lib/api/dashboard"
import { getDashboard } from "../../lib/api/dashboard"
import { apiFetch } from "../../lib/api/client"
import { EmptyState } from "./EmptyState"
import { HistoryToggle } from "./HistoryToggle"
import { SkeletonCard } from "./SkeletonCard"
import { TicketCard } from "./TicketCard"
import { UpcomingTripCard } from "./UpcomingTripCard"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const VISIBLE_LIMIT = 3

interface HotelBookingItem {
  id: string
  hotel: { name: string; city: string }
  roomType: { name: string; pricePerNight: number }
  checkInDate: string
  checkOutDate: string
  guestCount: number
  totalAmount: number
  status: string
}

interface RentalBookingItem {
  id: string
  vehicle: { make: string; model: string; pickupCity: string }
  startDate: string
  endDate: string
  totalAmount: number
  status: string
  pickupCity: string
  dropoffCity: string | null
}

function HotelBookingCard({ item }: { item: HotelBookingItem }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex justify-between">
          <span className="font-medium">{item.hotel.name}</span>
          <Badge variant="secondary">{item.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{item.hotel.city} · {item.roomType.name} · {item.guestCount} pers</p>
        <p className="text-xs text-muted-foreground">{new Date(item.checkInDate).toLocaleDateString("fr-FR")} → {new Date(item.checkOutDate).toLocaleDateString("fr-FR")}</p>
        <p className="text-sm font-bold">{new Intl.NumberFormat("fr-CM").format(item.totalAmount)} XAF</p>
      </CardContent>
    </Card>
  )
}

function RentalBookingCard({ item }: { item: RentalBookingItem }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex justify-between">
          <span className="font-medium">{item.vehicle.make} {item.vehicle.model}</span>
          <Badge variant="secondary">{item.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{item.pickupCity} → {item.dropoffCity ?? item.pickupCity}</p>
        <p className="text-xs text-muted-foreground">{new Date(item.startDate).toLocaleDateString("fr-FR")} → {new Date(item.endDate).toLocaleDateString("fr-FR")}</p>
        <p className="text-sm font-bold">{new Intl.NumberFormat("fr-CM").format(item.totalAmount)} XAF</p>
      </CardContent>
    </Card>
  )
}

export function Dashboard({ initialData, token }: { initialData: DashboardResponse; token: string }) {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const defaultTab = tabParam === "hotels" || tabParam === "rentals" ? tabParam : "trips"

  const { data, error, isFetching, refetch } = useQuery<DashboardResponse>({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(token),
    initialData,
  })

  const { data: hotelData } = useQuery<{ items: HotelBookingItem[] }>({
    queryKey: ["dashboard-hotels", token],
    queryFn: () => apiFetch<{ items: HotelBookingItem[] }>("/api/v1/hotels/bookings/me", { method: "GET", token }),
  })

  const { data: rentalData } = useQuery<{ items: RentalBookingItem[] }>({
    queryKey: ["dashboard-rentals", token],
    queryFn: () => apiFetch<{ items: RentalBookingItem[] }>("/api/v1/rentals/bookings/me", { method: "GET", token }),
  })

  if (!data) {
    return (
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  const upcoming = data.upcoming ?? []
  const tickets = data.tickets ?? []
  const history = data.history ?? []
  const hotelBookings = hotelData?.items ?? []
  const rentalBookings = rentalData?.items ?? []

  return (
    <div className="space-y-6">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            Impossible de charger vos voyages. Réessayez.
            <Button variant="outline" size="sm" onClick={() => refetch()} className="w-fit">Réessayer</Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="trips">Voyages à venir</TabsTrigger>
          <TabsTrigger value="hotels">Hôtels</TabsTrigger>
          <TabsTrigger value="rentals">Véhicules</TabsTrigger>
        </TabsList>

        <TabsContent value="trips" className="space-y-4 mt-4">
          <section>
            <header className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Voyages à venir</h2>
              {upcoming.length > VISIBLE_LIMIT ? <Link href="/dashboard?tab=trips" className="text-xs font-medium text-primary">Voir tous</Link> : null}
            </header>
            {upcoming.length === 0 ? <EmptyState title="Aucun voyage à venir. Trouvez un trajet." cta={{ href: "/", label: "Rechercher" }} /> : <div className="space-y-3">{upcoming.slice(0, VISIBLE_LIMIT).map((item) => <UpcomingTripCard key={item.id} item={item} />)}</div>}
          </section>
          <section>
            <header className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Billets</h2>
              {tickets.length > VISIBLE_LIMIT ? <Link href="/dashboard?section=tickets" className="text-xs font-medium text-primary">Voir tous</Link> : null}
            </header>
            {tickets.length === 0 ? <EmptyState title="Vos billets apparaîtront ici après paiement." /> : <div className="space-y-3">{tickets.slice(0, VISIBLE_LIMIT).map((item) => <TicketCard key={item.id} item={item} />)}</div>}
          </section>
          {history.length > 0 ? <HistoryToggle count={history.length}>{history.map((item) => <UpcomingTripCard key={item.id} item={item} />)}</HistoryToggle> : null}
        </TabsContent>

        <TabsContent value="hotels" className="space-y-3 mt-4">
          <header className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Réservations hôtel</h2>
            {hotelBookings.length > VISIBLE_LIMIT ? <Link href="/dashboard?tab=hotels" className="text-xs font-medium text-primary">Voir tous</Link> : null}
          </header>
          {hotelBookings.length === 0 ? <EmptyState title="Aucune réservation hôtel" cta={{ href: "/hotels", label: "Découvrir Hôtels" }} /> : <div className="space-y-3">{hotelBookings.slice(0, VISIBLE_LIMIT).map((b) => <HotelBookingCard key={b.id} item={b} />)}</div>}
        </TabsContent>

        <TabsContent value="rentals" className="space-y-3 mt-4">
          <header className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Réservations véhicule</h2>
            {rentalBookings.length > VISIBLE_LIMIT ? <Link href="/dashboard?tab=rentals" className="text-xs font-medium text-primary">Voir tous</Link> : null}
          </header>
          {rentalBookings.length === 0 ? <EmptyState title="Aucune réservation véhicule" cta={{ href: "/rentals", label: "Découvrir Véhicules" }} /> : <div className="space-y-3">{rentalBookings.slice(0, VISIBLE_LIMIT).map((b) => <RentalBookingCard key={b.id} item={b} />)}</div>}
        </TabsContent>
      </Tabs>

      {isFetching ? <p className="text-xs text-slate-400">Mise à jour…</p> : null}
    </div>
  )
}
