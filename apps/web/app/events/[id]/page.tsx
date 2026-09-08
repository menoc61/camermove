"use client"
import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useAuthStore } from "@camermove/frontend"
import { fetchEvent, createEventBooking, createEventBookingPayment } from "@/lib/api/events"
import { Stepper } from "@/components/ui/stepper"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Calendar, Ticket, TriangleAlert } from "lucide-react"

interface TicketCategoryDetail {
  id: string
  name: string
  description?: string | null
  price: number
  quantity: number
  sold: number
  status: string
}

export default function EventDetailPage() {
  const params = useParams<{ id: string }>()
  const eventId = params?.id
  const token = useAuthStore((s) => s.accessToken)

  const { data: event, isLoading, error } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => fetchEvent(eventId!),
    enabled: !!eventId,
  })

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)

  const categories: TicketCategoryDetail[] = (event?.ticketCategories as TicketCategoryDetail[] | undefined) ?? []
  const activeCategory = categories.find((c) => c.id === selectedCategoryId) ?? categories[0]
  const availableCategories = categories.filter((c) => c.status !== "sold_out" && c.quantity - c.sold > 0)

  const book = useMutation({
    mutationFn: async (categoryId: string) => {
      if (!token) throw new Error("UNAUTHENTICATED")
      return createEventBooking(token, { eventId: eventId!, ticketCategoryId: categoryId, quantity }, crypto.randomUUID())
    },
    onSuccess: async (booking) => {
      try {
        const pay = await createEventBookingPayment(booking.id, token!)
        if (pay.paymentUrl) {
          window.location.href = pay.paymentUrl
          return
        }
      } catch {
        // payment initiation failed — booking exists, user can pay from dashboard
      }
      window.location.href = "/dashboard"
    },
  })

  if (isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-6 pb-6 pt-24">
        <h1 className="text-2xl font-bold tracking-tight">Événement</h1>
        <p className="text-muted-foreground">Chargement de l&apos;événement...</p>
        <Skeleton className="h-32" />
      </main>
    )
  }

  if (error || !event) {
    return (
      <main className="mx-auto max-w-6xl px-6 pb-6 pt-24">
        <Alert variant="destructive"><TriangleAlert /><AlertTitle>Erreur</AlertTitle><AlertDescription>Impossible de charger l&apos;événement.</AlertDescription></Alert>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-6 pb-6 pt-24 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{event.name}</h1>

      <Separator />

      {/* Hero / poster */}
      <div className="rounded-xl overflow-hidden bg-gradient-to-b from-muted/30 to-card">
        {event.posterUrl ? (
          <img src={event.posterUrl} alt={event.name} className="object-cover w-full h-64" />
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <Ticket className="size-8" />
          </div>
        )}
      </div>

      {/* Info strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        <div>
          <p className="text-sm text-muted-foreground">Date</p>
          <p className="text-lg font-bold">
            {new Date(event.startDate).toLocaleDateString("fr-FR")}
            {event.endDate ? ` - ${new Date(event.endDate).toLocaleDateString("fr-FR")}` : ""}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Ville</p>
          <p className="text-lg font-bold">{event.city}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Type</p>
          <Badge className="mt-1">{event.eventType}</Badge>
        </div>
      </div>

      {/* Description */}
      <Separator />
      <Card><CardContent>
        <p className="text-muted-foreground">{event.description || "Aucune description"}</p>
      </CardContent></Card>

      {/* Ticket Categories */}
      <Separator />
      <h2 className="text-2xl font-bold tracking-tight">Billets disponibles</h2>

      {availableCategories.length === 0 && (
        <Card><CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="rounded-full bg-muted p-3"><Calendar className="size-6 text-muted-foreground" /></div>
          <p className="text-sm text-muted-foreground">Tous les billets sont sold-out.</p>
        </CardContent></Card>
      )}

      {availableCategories.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableCategories.map((c) => {
            const isActive = activeCategory?.id === c.id
            return (
              <Card
                key={c.id}
                role="button"
                tabIndex={0}
                aria-pressed={isActive}
                className={`p-4 space-y-3 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${isActive ? "border-primary" : "hover:border-primary/40"}`}
                onClick={() => { setSelectedCategoryId(c.id); setQuantity(1) }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setSelectedCategoryId(c.id)
                    setQuantity(1)
                  }
                }}
              >
                <h3 className="font-semibold">{c.name}</h3>
                <p className="text-sm text-muted-foreground">{c.description || ""}</p>

                <div>
                  <label className="text-xs text-muted-foreground">Quantité</label>
                  <Stepper
                    value={quantity}
                    min={1}
                    max={c.quantity - c.sold}
                    onChange={(n) => setQuantity(n)}
                    label="billets"
                  />
                  <span className="text-sm">
                    {c.quantity - c.sold} places disponibles · {new Intl.NumberFormat("fr-CM").format(c.price)} XAF / billet
                  </span>
                </div>

                <div>
                  <p className="font-bold">Total: {new Intl.NumberFormat("fr-CM").format(quantity * c.price)} XAF</p>
                  {token ? (
                    <Button
                      onClick={(e) => { e.stopPropagation(); book.mutate(c.id) }}
                      disabled={book.isPending}
                      className="w-full"
                    >
                      {book.isPending ? "Réservation en cours..." : "Réserver"}
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" onClick={(e) => { e.stopPropagation(); window.location.href = `/login?next=/events/${eventId}` }}>
                      Se connecter pour réserver
                    </Button>
                  )}
                  {book.isError && (
                    <Alert variant="destructive" className="mt-2">
                      <TriangleAlert />
                      <AlertDescription>
                        {String((book.error as Error).message).includes("UNAUTHENTICATED")
                          ? "Connectez-vous pour réserver."
                          : "Réservation impossible — réessayez."}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <div className="pt-2">
        <Link href="/events" className="text-sm text-muted-foreground hover:text-foreground">← Retour aux événements</Link>
      </div>
    </main>
  )
}
