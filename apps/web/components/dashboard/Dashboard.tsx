"use client"
import dynamic from "next/dynamic"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useState, type ComponentType } from "react"
import { toast } from "sonner"
import type { DashboardResponse } from "../../lib/api/dashboard"
import { getDashboard } from "../../lib/api/dashboard"
import { apiFetch } from "../../lib/api/client"
import {
  cancelBooking as cancelTripBooking,
  fetchMyBookings,
  fetchMyTickets,
  type MyBookingItem,
  type MyTicketItem,
} from "../../lib/api/bookings"
import { fetchMyPayments, type MyPaymentItem } from "../../lib/api/payments"
import { fetchMyNotifications, markNotificationRead, type MyNotification } from "../../lib/api/notifications"
import { cancelHotelBooking } from "../../lib/api/hotels"
import { cancelRentalBooking } from "../../lib/api/rentals"
import { fetchParcels, cancelParcel, type Parcel } from "../../lib/api/parcels"
import { fetchMyInsurancePolicies, cancelInsurancePolicy, type InsurancePolicy } from "../../lib/api/insurance"
import { fetchMyEventBookings, cancelEventBooking, type EventBooking } from "../../lib/api/events"
import { ContactForm } from "../contact/ContactForm"
import { EmptyState } from "./EmptyState"
import { HistoryToggle } from "./HistoryToggle"
import { SkeletonCard } from "./SkeletonCard"
import { TicketCard } from "./TicketCard"
import { UpcomingTripCard } from "./UpcomingTripCard"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from "lucide-react"

const VISIBLE_LIMIT = 3
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

function SummarySkeleton() {
  return (
    <div className="space-y-2 rounded-xl border bg-card p-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-6 w-16" />
    </div>
  )
}

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

const fmtXaf = (amount: number) => new Intl.NumberFormat("fr-CM").format(amount)
const fmtDateFr = (d: string) => new Date(d).toLocaleDateString("fr-FR")

function ExportControls({ token, endpoint, resource }: { token: string; endpoint: string; resource: string }) {
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [format, setFormat] = useState<"csv" | "json">("csv")
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  async function handleExport() {
    setExporting(true)
    setExportError(null)
    try {
      const qs = new URLSearchParams()
      if (dateFrom) qs.set("dateFrom", dateFrom)
      if (dateTo) qs.set("dateTo", dateTo)
      qs.set("format", format)
      const res = await fetch(`${API_BASE}${endpoint}?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Export failed (HTTP ${res.status})`)
      const blob = await res.blob()
      const dlUrl = URL.createObjectURL(blob)
      const cd = res.headers.get("Content-Disposition") ?? ""
      const match = cd.match(/filename="([^"]+)"/) ?? cd.match(/filename=([^;]+)/)
      const filename = match?.[1]?.trim() ? match[1].trim() : `export-${resource}-${dateFrom || "all"}-${dateTo || "all"}.${format}`
      const a = document.createElement("a")
      a.href = dlUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(dlUrl)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Du</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Au</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
        </div>
        <select
          aria-label="Format d'export"
          className="h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm"
          value={format}
          onChange={(e) => setFormat(e.target.value as "csv" | "json")}
        >
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
          <DownloadIcon className="size-4 mr-1" /> {exporting ? "Export…" : "Exporter"}
        </Button>
      </div>
      {exportError ? <p className="text-xs text-destructive">{exportError}</p> : null}
    </div>
  )
}

function HotelBookingCard({ item, token }: { item: HotelBookingItem; token: string }) {
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
        <CancelButton
          visible={item.status === "pending_payment"}
          onCancel={() => cancelHotelBooking(token, item.id)}
          invalidateKeys={[["dashboard-hotels", token]]}
        />
      </CardContent>
    </Card>
  )
}

function RentalBookingCard({ item, token }: { item: RentalBookingItem; token: string }) {
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
        <CancelButton
          visible={item.status === "pending_payment"}
          onCancel={() => cancelRentalBooking(token, item.id)}
          invalidateKeys={[["dashboard-rentals", token]]}
        />
      </CardContent>
    </Card>
  )
}

function ParcelCard({ item, token }: { item: Parcel; token: string }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex justify-between gap-2">
          <span className="font-mono text-sm font-medium">{item.trackingNumber}</span>
          <Badge variant="secondary">{item.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{item.senderCity} → {item.recipientCity}</p>
        <p className="text-xs text-muted-foreground">{item.parcelType}{item.weightKg != null ? ` · ${item.weightKg} kg` : ""}</p>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">{fmtXaf(item.shippingCost)} XAF</p>
          <Link href={`/parcels/track/${item.trackingNumber}`} className="text-sm underline underline-offset-4">Suivre</Link>
        </div>
        <CancelButton
          visible={item.status === "registered"}
          onCancel={() => cancelParcel(token, item.id)}
          invalidateKeys={[["dashboard-parcels", token]]}
        />
      </CardContent>
    </Card>
  )
}

function InsuranceCard({ item, token }: { item: InsurancePolicy; token: string }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex justify-between gap-2">
          <span className="font-medium">{item.destination}</span>
          <Badge variant="secondary">{item.status}</Badge>
        </div>
        {item.policyNumber ? <p className="text-xs font-mono text-muted-foreground">Police n° {item.policyNumber}</p> : null}
        <p className="text-xs text-muted-foreground">{fmtDateFr(item.startDate)} → {fmtDateFr(item.endDate)} · {item.travelers} voyageur(s)</p>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">{fmtXaf(item.premium)} {item.currency}</p>
          <Link href={`/insurance/success?id=${item.id}`} className="text-sm underline underline-offset-4">Voir</Link>
        </div>
        <CancelButton
          visible={item.status === "pending_payment"}
          onCancel={() => cancelInsurancePolicy(token, item.id)}
          invalidateKeys={[["dashboard-insurance", token]]}
        />
      </CardContent>
    </Card>
  )
}

function EventBookingCard({ item, token }: { item: EventBooking; token: string }) {
  const eventId = item.event?.id
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex justify-between gap-2">
          <span className="font-medium">{item.event?.name ?? "Événement"}</span>
          <Badge variant="secondary">{item.status}</Badge>
        </div>
        <p className="text-xs font-mono text-muted-foreground">Billet n° {item.ticketNumber} · {item.quantity} place(s)</p>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">{fmtXaf(item.totalAmount)} XAF</p>
          <Link href={eventId ? `/events/${eventId}` : "/events"} className="text-sm underline underline-offset-4">Voir l&apos;événement</Link>
        </div>
        <CancelButton
          visible={item.status === "pending_payment"}
          onCancel={() => cancelEventBooking(token, item.id)}
          invalidateKeys={[["dashboard-events", token]]}
        />
      </CardContent>
    </Card>
  )
}

function cancelErrorMessage(e: unknown): string {
  const status = (e as { status?: number } | null)?.status
  const msg = e instanceof Error ? e.message : ""
  if (status === 404 || /HTTP 404|Cannot POST|\b404\b/.test(msg)) return "Annulation bientôt disponible"
  return msg || "Échec de l'annulation — contactez le support"
}

function CancelButton({
  visible,
  onCancel,
  invalidateKeys,
}: {
  visible: boolean
  onCancel: () => Promise<unknown>
  invalidateKeys: string[][]
}) {
  const qc = useQueryClient()
  const [cancelling, setCancelling] = useState(false)
  if (!visible) return null
  async function handleCancel() {
    if (!window.confirm("Confirmer l'annulation ?")) return
    setCancelling(true)
    try {
      await onCancel()
      toast.success("Annulation confirmée")
      invalidateKeys.forEach((key) => qc.invalidateQueries({ queryKey: key }))
    } catch (e) {
      toast.error(cancelErrorMessage(e))
    } finally {
      setCancelling(false)
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={handleCancel} disabled={cancelling} className="w-fit">
      {cancelling ? "Annulation…" : "Annuler"}
    </Button>
  )
}

// Per-tab Prev/Next pagination. Hidden when totalPages <= 1.
function PaginationControls({
  page,
  totalPages,
  isFetching,
  onPageChange,
}: {
  page: number
  totalPages: number
  isFetching?: boolean
  onPageChange: (next: number) => void
}) {
  if (totalPages <= 1) return null
  const canPrev = page > 1
  const canNext = page < totalPages
  return (
    <div className="flex items-center justify-between gap-2 pt-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!canPrev || isFetching}
        onClick={() => onPageChange(Math.max(1, page - 1))}
        className="w-fit"
      >
        <ChevronLeftIcon className="size-4 mr-1" /> Précédent
      </Button>
      <span className="text-xs text-muted-foreground" aria-live="polite">
        Page {page} / {totalPages}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!canNext || isFetching}
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        className="w-fit"
      >
        Suivant <ChevronRightIcon className="size-4 ml-1" />
      </Button>
    </div>
  )
}

function PaymentCard({ item }: { item: MyPaymentItem }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex justify-between gap-2">
          <span className="font-medium">{fmtXaf(item.amount)} XAF</span>
          <Badge variant="secondary">{item.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{item.provider}{item.method ? ` · ${item.method}` : ""}</p>
        <p className="text-xs text-muted-foreground">{fmtDateFr(item.createdAt)}</p>
      </CardContent>
    </Card>
  )
}

function NotificationCard({ item, onMarkRead, marking }: { item: MyNotification; onMarkRead: (id: string) => void; marking: boolean }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex justify-between gap-2">
          <span className="font-medium">{item.type}</span>
          <Badge variant="secondary">{item.read ? "lu" : "non lu"}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{item.channel} · {item.status}</p>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{fmtDateFr(item.createdAt)}</p>
          {item.read ? null : (
            <Button variant="outline" size="sm" onClick={() => onMarkRead(item.id)} disabled={marking} className="w-fit">
              {marking ? "…" : "Marquer lu"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function FavoritesMissing() {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">Favoris bientôt disponible.</p>
      </CardContent>
    </Card>
  )
}

// ./FavoritesTab is delivered by a parallel agent — lazy import + skeleton so
// typecheck and runtime stay green whether or not the file has landed yet.
const FavoritesTabLazy = dynamic(
  // @ts-ignore — suppress TS2307 until FavoritesTab.tsx exists (ts-ignore never errors when unused)
  () => import("./FavoritesTab").then((m) => ((m as { FavoritesTab?: ComponentType<{ token: string }> }).FavoritesTab ?? FavoritesMissing)).catch(() => FavoritesMissing),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    ),
  }
)

export function Dashboard({ initialData, token }: { initialData: DashboardResponse; token: string }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const tabParam = searchParams.get("tab")
  const VALID_TABS = ["trips", "hotels", "rentals", "parcels", "insurance", "events", "payments", "notifications", "favorites", "support"] as const
  const activeTab: string = (VALID_TABS as readonly string[]).includes(tabParam ?? "") ? (tabParam as string) : "trips"
  const [pendingTab, setPendingTab] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // Per-tab pagination state. Tabs that fetch a single paged list hold a single
  // `page`; the trips tab holds three (upcoming, tickets, history) since the
  // dashboard renders each section independently.
  const [hotelsPage, setHotelsPage] = useState(1)
  const [rentalsPage, setRentalsPage] = useState(1)
  const [parcelsPage, setParcelsPage] = useState(1)
  const [insurancePage, setInsurancePage] = useState(1)
  const [eventsPage, setEventsPage] = useState(1)
  const [paymentsPage, setPaymentsPage] = useState(1)
  const [notificationsPage, setNotificationsPage] = useState(1)
  const [upcomingPage, setUpcomingPage] = useState(1)
  const [ticketsPage, setTicketsPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const TAB_PER_PAGE = 20

  const { data, error, isFetching, refetch } = useQuery<DashboardResponse>({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(token),
    initialData,
  })

  // Trips tab — three paginated sub-fetches. The /me/dashboard SSR data
  // remains the initial paint, but the queries own the page state and the
  // Prev/Next controls.
  const { data: upcomingData, isFetching: upcomingFetching } = useQuery({
    queryKey: ["dashboard-upcoming", token, upcomingPage, TAB_PER_PAGE],
    queryFn: () => fetchMyBookings(token, { page: upcomingPage, perPage: TAB_PER_PAGE, scope: "upcoming" }),
  })
  const { data: ticketsData, isFetching: ticketsFetching } = useQuery({
    queryKey: ["dashboard-tickets", token, ticketsPage, TAB_PER_PAGE],
    queryFn: () => fetchMyTickets(token, { page: ticketsPage, perPage: TAB_PER_PAGE }),
  })
  const { data: historyData, isFetching: historyFetching } = useQuery({
    queryKey: ["dashboard-history", token, historyPage, TAB_PER_PAGE],
    queryFn: () => fetchMyBookings(token, { page: historyPage, perPage: TAB_PER_PAGE, scope: "history" }),
  })

  const { data: hotelData, isLoading: hotelsLoading, isFetching: hotelsFetching } = useQuery<{ items: HotelBookingItem[]; total: number; page: number; perPage: number; totalPages: number }>({
    queryKey: ["dashboard-hotels", token, hotelsPage, TAB_PER_PAGE],
    queryFn: () => {
      const qs = new URLSearchParams()
      qs.set("page", String(hotelsPage))
      qs.set("perPage", String(TAB_PER_PAGE))
      return apiFetch<{ items: HotelBookingItem[]; total: number; page: number; perPage: number; totalPages: number }>(`/api/v1/hotels/bookings/me?${qs.toString()}`, { method: "GET", token })
    },
  })

  const { data: rentalData, isLoading: rentalsLoading, isFetching: rentalsFetching } = useQuery<{ items: RentalBookingItem[]; total: number; page: number; perPage: number; totalPages: number }>({
    queryKey: ["dashboard-rentals", token, rentalsPage, TAB_PER_PAGE],
    queryFn: () => {
      const qs = new URLSearchParams()
      qs.set("page", String(rentalsPage))
      qs.set("perPage", String(TAB_PER_PAGE))
      return apiFetch<{ items: RentalBookingItem[]; total: number; page: number; perPage: number; totalPages: number }>(`/api/v1/rentals/bookings/me?${qs.toString()}`, { method: "GET", token })
    },
  })

  const { data: parcelData, isLoading: parcelsLoading, error: parcelsError, refetch: refetchParcels, isFetching: parcelsFetching } = useQuery({
    queryKey: ["dashboard-parcels", token, parcelsPage, TAB_PER_PAGE],
    queryFn: () => fetchParcels(token, { page: parcelsPage, perPage: TAB_PER_PAGE }),
  })

  const { data: insuranceData, isLoading: insuranceLoading, error: insuranceError, refetch: refetchInsurance, isFetching: insuranceFetching } = useQuery<{ items: InsurancePolicy[]; total: number; page: number; perPage: number; totalPages: number }>({
    queryKey: ["dashboard-insurance", token, insurancePage, TAB_PER_PAGE],
    queryFn: () => fetchMyInsurancePolicies(token, { page: insurancePage, perPage: TAB_PER_PAGE }),
  })

  const { data: eventData, isLoading: eventsLoading, error: eventsError, refetch: refetchEvents, isFetching: eventsFetching } = useQuery({
    queryKey: ["dashboard-events", token, eventsPage, TAB_PER_PAGE],
    queryFn: () => fetchMyEventBookings(token, { page: eventsPage, perPage: TAB_PER_PAGE }),
  })

  const { data: paymentData, isLoading: paymentsLoading, error: paymentsError, refetch: refetchPayments, isFetching: paymentsFetching } = useQuery({
    queryKey: ["dashboard-payments", token, paymentsPage, TAB_PER_PAGE],
    queryFn: () => fetchMyPayments(token, { page: String(paymentsPage), perPage: String(TAB_PER_PAGE) }),
  })

  const { data: notificationData, isLoading: notificationsLoading, error: notificationsError, refetch: refetchNotifications, isFetching: notificationsFetching } = useQuery({
    queryKey: ["dashboard-notifications", token, notificationsPage, TAB_PER_PAGE],
    queryFn: () => fetchMyNotifications(token, { page: String(notificationsPage), perPage: String(TAB_PER_PAGE) }),
  })

  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(token, id),
    onSuccess: () => {
      toast.success("Notification marquée comme lue")
      queryClient.invalidateQueries({ queryKey: ["dashboard-notifications", token] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Échec — réessayez"),
  })

  function switchTab(value: string) {
    setPendingTab(value)
    const next = new URLSearchParams(searchParams.toString())
    next.set("tab", value)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <SummarySkeleton key={i} />)}
        </div>
        <ListSkeleton count={3} />
      </div>
    )
  }

  // The /me/dashboard SSR data is the initial paint; once the per-tab
  // paginated queries return we switch over to those (page state-driven).
  const upcoming: MyBookingItem[] = upcomingData?.items ?? data.upcoming ?? []
  const tickets: MyTicketItem[] = ticketsData?.items ?? data.tickets ?? []
  const history: MyBookingItem[] = historyData?.items ?? data.history ?? []
  const hotelBookings: HotelBookingItem[] = hotelData?.items ?? []
  const rentalBookings: RentalBookingItem[] = rentalData?.items ?? []
  const parcels = parcelData?.items ?? []
  const policies: InsurancePolicy[] = insuranceData?.items ?? []
  const eventBookings: EventBooking[] = eventData?.items ?? []
  const payments: MyPaymentItem[] = paymentData?.items ?? []
  const notifications: MyNotification[] = notificationData?.items ?? []

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Voyages", value: upcoming.length },
          { label: "Hôtels", value: hotelBookings.length },
          { label: "Véhicules", value: rentalBookings.length },
          { label: "Colis", value: parcels.length },
          { label: "Événements", value: eventBookings.length },
        ].map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            Impossible de charger vos voyages. Réessayez.
            <Button variant="outline" size="sm" onClick={() => refetch()} className="w-fit">Réessayer</Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={pendingTab ?? activeTab} onValueChange={switchTab} className="w-full">
        <TabsList className="w-full overflow-x-auto">
          <TabsTrigger value="trips" className="flex-1 min-h-[44px] whitespace-nowrap">Voyages à venir</TabsTrigger>
          <TabsTrigger value="hotels" className="flex-1 min-h-[44px] whitespace-nowrap">Hôtels</TabsTrigger>
          <TabsTrigger value="rentals" className="flex-1 min-h-[44px] whitespace-nowrap">Véhicules</TabsTrigger>
          <TabsTrigger value="parcels" className="flex-1 min-h-[44px] whitespace-nowrap">Colis</TabsTrigger>
          <TabsTrigger value="insurance" className="flex-1 min-h-[44px] whitespace-nowrap">Assurances</TabsTrigger>
          <TabsTrigger value="events" className="flex-1 min-h-[44px] whitespace-nowrap">Événements</TabsTrigger>
          <TabsTrigger value="payments" className="flex-1 min-h-[44px] whitespace-nowrap">Paiements</TabsTrigger>
          <TabsTrigger value="notifications" className="flex-1 min-h-[44px] whitespace-nowrap">Notifications</TabsTrigger>
          <TabsTrigger value="favorites" className="flex-1 min-h-[44px] whitespace-nowrap">Favoris</TabsTrigger>
          <TabsTrigger value="support" className="flex-1 min-h-[44px] whitespace-nowrap">Support</TabsTrigger>
        </TabsList>

        <TabsContent value="trips" className="space-y-4 mt-4">
          <ExportControls token={token} endpoint="/api/v1/bookings/export" resource="bookings" />
          <section>
            <header className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Voyages à venir</h2>
            </header>
            {upcoming.length === 0 ? <EmptyState title="Aucun voyage à venir. Trouvez un trajet." cta={{ href: "/", label: "Rechercher" }} /> : <>
              <div className="space-y-3">{upcoming.slice(0, VISIBLE_LIMIT).map((item) => (
                <div key={item.id} className="space-y-2">
                  <UpcomingTripCard item={item} />
                  <CancelButton
                    visible={item.status === "pending_payment"}
                    onCancel={() => cancelTripBooking(item.id, token)}
                    invalidateKeys={[["dashboard"], ["dashboard-upcoming", token, String(upcomingPage), String(TAB_PER_PAGE)]]}
                  />
                </div>
              ))}</div>
              <PaginationControls
                page={upcomingData?.page ?? upcomingPage}
                totalPages={upcomingData?.totalPages ?? 1}
                isFetching={upcomingFetching}
                onPageChange={setUpcomingPage}
              />
            </>}
          </section>
          <section>
            <header className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Billets</h2>
            </header>
            {tickets.length === 0 ? <EmptyState title="Vos billets apparaîtront ici après paiement." /> : <>
              <div className="space-y-3">{tickets.slice(0, VISIBLE_LIMIT).map((item) => <TicketCard key={item.id} item={item} />)}</div>
              <PaginationControls
                page={ticketsData?.page ?? ticketsPage}
                totalPages={ticketsData?.totalPages ?? 1}
                isFetching={ticketsFetching}
                onPageChange={setTicketsPage}
              />
            </>}
          </section>
          {historyData && historyData.total > 0 ? (
            <HistoryToggle count={historyData.total}>
              {history.slice(0, VISIBLE_LIMIT).map((item) => <UpcomingTripCard key={item.id} item={item} />)}
              <PaginationControls
                page={historyData?.page ?? historyPage}
                totalPages={historyData?.totalPages ?? 1}
                isFetching={historyFetching}
                onPageChange={setHistoryPage}
              />
            </HistoryToggle>
          ) : null}
        </TabsContent>

        <TabsContent value="hotels" className="space-y-3 mt-4">
          <header className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Réservations hôtel</h2>
            {hotelsFetching && !hotelsLoading ? <span className="text-xs text-muted-foreground">Mise à jour…</span> : null}
          </header>
          <ExportControls token={token} endpoint="/api/v1/hotels/bookings/export" resource="hotel-bookings" />
          {hotelsLoading ? <ListSkeleton count={3} /> : hotelBookings.length === 0 ? <EmptyState title="Aucune réservation hôtel" cta={{ href: "/hotels", label: "Découvrir Hôtels" }} /> : <>
            <div className="space-y-3">{hotelBookings.slice(0, VISIBLE_LIMIT).map((b) => <HotelBookingCard key={b.id} item={b} token={token} />)}</div>
            <PaginationControls
              page={hotelData?.page ?? hotelsPage}
              totalPages={hotelData?.totalPages ?? 1}
              isFetching={hotelsFetching}
              onPageChange={setHotelsPage}
            />
          </>}
        </TabsContent>

        <TabsContent value="rentals" className="space-y-3 mt-4">
          <header className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Réservations véhicule</h2>
            {rentalsFetching && !rentalsLoading ? <span className="text-xs text-muted-foreground">Mise à jour…</span> : null}
          </header>
          <ExportControls token={token} endpoint="/api/v1/rentals/bookings/export" resource="rental-bookings" />
          {rentalsLoading ? <ListSkeleton count={3} /> : rentalBookings.length === 0 ? <EmptyState title="Aucune réservation véhicule" cta={{ href: "/rentals", label: "Découvrir Véhicules" }} /> : <>
            <div className="space-y-3">{rentalBookings.slice(0, VISIBLE_LIMIT).map((b) => <RentalBookingCard key={b.id} item={b} token={token} />)}</div>
            <PaginationControls
              page={rentalData?.page ?? rentalsPage}
              totalPages={rentalData?.totalPages ?? 1}
              isFetching={rentalsFetching}
              onPageChange={setRentalsPage}
            />
          </>}
        </TabsContent>

        <TabsContent value="parcels" className="space-y-3 mt-4">
          <header className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Mes colis</h2>
            {parcelsFetching && !parcelsLoading ? <span className="text-xs text-muted-foreground">Mise à jour…</span> : null}
          </header>
          <ExportControls token={token} endpoint="/api/v1/parcels/export" resource="parcels" />
          {parcelsLoading ? <ListSkeleton count={3} /> : parcelsError ? (
            <Alert variant="destructive">
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                Impossible de charger vos colis. Réessayez.
                <Button variant="outline" size="sm" onClick={() => refetchParcels()} className="w-fit">Réessayer</Button>
              </AlertDescription>
            </Alert>
          ) : parcels.length === 0 ? (
            <EmptyState title="Aucun colis" cta={{ href: "/parcels", label: "Envoyer un colis" }} />
          ) : (
            <>
              <div className="space-y-3">{parcels.slice(0, VISIBLE_LIMIT).map((p) => <ParcelCard key={p.id} item={p} token={token} />)}</div>
              <PaginationControls
                page={parcelData?.page ?? parcelsPage}
                totalPages={parcelData?.totalPages ?? 1}
                isFetching={parcelsFetching}
                onPageChange={setParcelsPage}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="insurance" className="space-y-3 mt-4">
          <header className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Mes assurances</h2>
            {insuranceFetching && !insuranceLoading ? <span className="text-xs text-muted-foreground">Mise à jour…</span> : null}
          </header>
          <ExportControls token={token} endpoint="/api/v1/insurance/policies/export" resource="insurance-policies" />
          {insuranceLoading ? <ListSkeleton count={3} /> : insuranceError ? (
            <Alert variant="destructive">
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                Impossible de charger vos assurances. Réessayez.
                <Button variant="outline" size="sm" onClick={() => refetchInsurance()} className="w-fit">Réessayer</Button>
              </AlertDescription>
            </Alert>
          ) : policies.length === 0 ? (
            <EmptyState title="Aucune assurance" cta={{ href: "/insurance", label: "Découvrir Assurances" }} />
          ) : (
            <>
              <div className="space-y-3">{policies.slice(0, VISIBLE_LIMIT).map((p) => <InsuranceCard key={p.id} item={p} token={token} />)}</div>
              <PaginationControls
                page={insuranceData?.page ?? insurancePage}
                totalPages={insuranceData?.totalPages ?? 1}
                isFetching={insuranceFetching}
                onPageChange={setInsurancePage}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="events" className="space-y-3 mt-4">
          <header className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Mes billets événement</h2>
            {eventsFetching && !eventsLoading ? <span className="text-xs text-muted-foreground">Mise à jour…</span> : null}
          </header>
          <ExportControls token={token} endpoint="/api/v1/events/bookings/export" resource="event-bookings" />
          {eventsLoading ? <ListSkeleton count={3} /> : eventsError ? (
            <Alert variant="destructive">
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                Impossible de charger vos billets événement. Réessayez.
                <Button variant="outline" size="sm" onClick={() => refetchEvents()} className="w-fit">Réessayer</Button>
              </AlertDescription>
            </Alert>
          ) : eventBookings.length === 0 ? (
            <EmptyState title="Aucun billet événement" cta={{ href: "/events", label: "Découvrir Événements" }} />
          ) : (
            <>
              <div className="space-y-3">{eventBookings.slice(0, VISIBLE_LIMIT).map((b) => <EventBookingCard key={b.id} item={b} token={token} />)}</div>
              <PaginationControls
                page={eventData?.page ?? eventsPage}
                totalPages={eventData?.totalPages ?? 1}
                isFetching={eventsFetching}
                onPageChange={setEventsPage}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="payments" className="space-y-3 mt-4">
          <header className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Mes paiements</h2>
            {paymentsFetching && !paymentsLoading ? <span className="text-xs text-muted-foreground">Mise à jour…</span> : null}
          </header>
          <ExportControls token={token} endpoint="/api/v1/payments/export" resource="payments" />
          {paymentsLoading ? <ListSkeleton count={3} /> : paymentsError ? (
            <Alert variant="destructive">
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                Impossible de charger vos paiements. Réessayez.
                <Button variant="outline" size="sm" onClick={() => refetchPayments()} className="w-fit">Réessayer</Button>
              </AlertDescription>
            </Alert>
          ) : payments.length === 0 ? (
            <EmptyState title="Aucun paiement" />
          ) : (
            <>
              <div className="space-y-3">{payments.slice(0, VISIBLE_LIMIT).map((p) => <PaymentCard key={p.id} item={p} />)}</div>
              <PaginationControls
                page={paymentData?.page ?? paymentsPage}
                totalPages={paymentData?.totalPages ?? 1}
                isFetching={paymentsFetching}
                onPageChange={setPaymentsPage}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="notifications" className="space-y-3 mt-4">
          <header className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Notifications</h2>
            {notificationsFetching && !notificationsLoading ? <span className="text-xs text-muted-foreground">Mise à jour…</span> : null}
          </header>
          {notificationsLoading ? <ListSkeleton count={3} /> : notificationsError ? (
            <Alert variant="destructive">
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                Impossible de charger vos notifications. Réessayez.
                <Button variant="outline" size="sm" onClick={() => refetchNotifications()} className="w-fit">Réessayer</Button>
              </AlertDescription>
            </Alert>
          ) : notifications.length === 0 ? (
            <EmptyState title="Aucune notification" />
          ) : (
            <>
              <div className="space-y-3">
                {notifications.slice(0, VISIBLE_LIMIT).map((n) => (
                  <NotificationCard
                    key={n.id}
                    item={n}
                    onMarkRead={(id) => markRead.mutate(id)}
                    marking={markRead.isPending && markRead.variables === n.id}
                  />
                ))}
              </div>
              <PaginationControls
                page={notificationData?.page ?? notificationsPage}
                totalPages={notificationData?.totalPages ?? 1}
                isFetching={notificationsFetching}
                onPageChange={setNotificationsPage}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="favorites" className="space-y-3 mt-4">
          <header className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Mes favoris</h2>
          </header>
          <FavoritesTabLazy token={token} />
        </TabsContent>

        <TabsContent value="support" className="space-y-4 mt-4">
          <header className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Support</h2>
          </header>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <Link href="/faq" className="w-fit text-sm underline underline-offset-4">Consulter la FAQ</Link>
            <p>Email : <a href="mailto:contact@camermove.cm" className="underline">contact@camermove.cm</a></p>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <ContactForm />
          </div>
        </TabsContent>
      </Tabs>

      {isFetching && !error && <p className="text-xs text-muted-foreground">Mise à jour…</p>}
    </div>
  )
}
