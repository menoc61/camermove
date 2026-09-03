"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useQuery, useMutation } from "@tanstack/react-query"
import { fetchEvent, createEventBooking, useEvents } from "@/lib/api/events"
import { Stepper } from "@/components/ui/stepper"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Search, Ticket, Piano, Guitar, Sport, Festival,} from "lucide-react"
import { useIntl } from "react-intl"

export default function EventDetailPage() {
  const params = useSearchParams()
  const eventId = params.get("id") || undefined

  const { data: event, isLoading, error } = useQuery({
    queryKey: ["event", eventId],
    queryFn: eventId ? () => fetchEvent(eventId, undefined) : undefined,
    enabled: !!eventId,
  })

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    // fetch related events for "Découvrir événements" CTA
  }, [eventId])

  if (!event || isLoading) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-bold tracking-tight">Événement</h1>
        <p className="text-muted-foreground">Chargement de l'événement...</p>
        <Skeleton className="h-32" />
      </main>
    )
  }

  if (error) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <Alert variant="destructive"><TriangleAlert /><AlertTitle>Erreur</AlertTitle><AlertDescription>Impossible de charger l'événement.</AlertDescription></Alert>
      </main>
    )
  }

  const categories = event.ticketCategories || []
  const availableCategories = categories.filter(
    (c: any) => c.status !== "sold_out" && c.quantity - c.sold > 0
  )

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{event.name}</h1>

      <Separator />

      {/* Hero / poster */}
      <div className="rounded-xl overflow-hidden bg-gradient-to-b from-muted/30 to-card">
        {event.posterUrl ? (
          <img
            src={event.posterUrl}
            alt={event.name}
            className="object-cover w-full h-64"
          />
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
          <p className="text-lg font-bold">{event.startDate}{event.endDate ? ` - ${event.endDate}` : ""}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Ville</p>
          <p className="text-lg font-bold">{event.city}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Type</p>
          <p className="text-lg font-bold badge">
            {event.eventType}
          </p>
        </div>
      </div>

      {/* Description */}
      <Separator />
      <Card><CardContent>
        <p className="text-muted-foreground">{event.description || "Aucune description"}</p>
      </CardContent></Card>

      {/* Ticket Categories */}
      <Separator />
      <h2 className="text-font-bold tracking-tight">Billets disponibles</h2>

      {availableCategories.length === 0 && (
        <Card><CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="rounded-full bg-muted p-3"><Calendar className="size-6 text-muted-foreground" /></div>
          <p className="text-sm text-muted-foreground">Tous les billets sont sold-out.</p>
        </CardContent></Card>
      )}

      {availableCategories.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableCategories.map((c) => (
            <Card key={c.id} className="p-4 space-y-3">
              <h3 className="font-semibold">{c.name}</h3>
              <p className="text-sm text-muted-foreground">{c.description || ""}</p>

              {/* Stepper for quantity */}
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
                  {c.quantity - c.sold} places disponibles · {c.price} XAF / billet
                </span>
              </div>

              {/* Total */}
              <div>
                <p className="font-bold">Total: {quantity * c.price} XAF</p>
                <Button
                  onClick={() => {
                    bookEvent({
                      eventId: event.id,
                      ticketCategoryId: c.id,
                      quantity,
                    })
                  }}
                  disabled={isPending}
                  className="w-full"
                >
                  {isPending ? "Réservation en cours..." : "Réserver"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}