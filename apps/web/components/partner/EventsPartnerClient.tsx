"use client"

import { useQuery } from "@tanstack/react-query"
import { getPartnerEvents } from "@/lib/api/partners"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Props { token: string }

const fmtXaf = (amount: number) => new Intl.NumberFormat("fr-CM").format(amount)

export function EventsPartnerClient({ token }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["partner-events"],
    queryFn: () => getPartnerEvents(token),
    enabled: !!token,
  })

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>Impossible de charger vos événements — {error instanceof Error ? error.message : String(error)}</AlertDescription>
        </Alert>
      )}
      {!isLoading && !error && data?.items.map((e) => (
        <Card key={e.id}>
          <CardHeader><CardTitle>{e.name} — {e.city}</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap justify-between items-center gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{new Date(e.startDate).toLocaleDateString("fr-FR")} - {e.endDate ? new Date(e.endDate).toLocaleDateString("fr-FR") : "∞"}</p>
              <p className="text-sm text-muted-foreground">Type : {e.eventType} · {e.ticketCategories.length} catégorie(s) de billets</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Réservations</p>
                <p className="text-lg font-semibold">{e.kpis.bookings}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Revenu confirmé</p>
                <p className="text-lg font-semibold">{fmtXaf(e.kpis.revenue)} XAF</p>
              </div>
              <Badge variant={e.partnerStatus === "approved" ? "default" : "secondary"}>{e.partnerStatus}</Badge>
            </div>
          </CardContent>
        </Card>
      ))}
      {!isLoading && !error && !data?.items?.length && (
        <p className="text-sm text-muted-foreground">
          Aucun événement à votre organisation. Les événements que vous organisez apparaîtront ici.
        </p>
      )}
    </div>
  )
}
