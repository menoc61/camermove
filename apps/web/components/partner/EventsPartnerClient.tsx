"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchEvents } from "@/lib/api/events"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Props { token: string }

export function EventsPartnerClient({ token }: Props) {
  const { data, isLoading, error } = useQuery<{ items: any[] }>({
    queryKey: ["partner-events"],
    queryFn: () => fetchEvents(token),
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
          <AlertDescription>Impossible de charger les événements — {error instanceof Error ? error.message : String(error)}</AlertDescription>
        </Alert>
      )}
      {!isLoading && !error && data?.items.map((e) => (
        <Card key={e.id}>
          <CardHeader><CardTitle>{e.name} — {e.city}</CardTitle></CardHeader>
          <CardContent className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">{new Date(e.startDate).toLocaleDateString("fr-FR")} - {e.endDate ? new Date(e.endDate).toLocaleDateString("fr-FR") : "∞"}</p>
              <p className="text-sm text-muted-foreground">Type: {e.eventType}</p>
            </div>
            <Badge variant={e.status === "active" ? "default" : "secondary"}>{e.status}</Badge>
          </CardContent>
        </Card>
      ))}
      {!isLoading && !error && !data?.items?.length && (
        <p className="text-sm text-muted-foreground">Aucun événement — créez‑en un via l&#39;interface admin.</p>
      )}
    </div>
  )
}
