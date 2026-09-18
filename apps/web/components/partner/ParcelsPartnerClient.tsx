"use client"

import { useQuery } from "@tanstack/react-query"
import { getPartnerParcels } from "@/lib/api/partners"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { TriangleAlert } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { priceXaf } from "@camermove/shared"

interface Props { token: string }

export function ParcelsPartnerClient({ token }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["partner-parcels"],
    queryFn: () => getPartnerParcels(token),
    enabled: !!token,
  })

  const operators = data?.operators ?? []

  return (
    <div className="space-y-6">
      {operators.length > 0 ? (
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-2">
            {operators.map((o) => (
              <Badge key={o.id} variant={o.partnerStatus === "approved" ? "default" : "secondary"}>
                {o.companyName} · {o.partnerStatus}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {isLoading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
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
            <TriangleAlert />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>Impossible de charger les colis de vos opérateurs — {error instanceof Error ? error.message : String(error)}</AlertDescription>
          </Alert>
        )}
        {!isLoading && !error && (
          <div className="space-y-3">
            {data?.items.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex justify-between items-center p-4">
                  <div>
                    <p className="font-mono text-sm font-medium">{p.trackingNumber}</p>
                    <p className="text-xs text-muted-foreground">{p.senderName} ({p.senderCity}) → {p.recipientName} ({p.recipientCity})</p>
                    <p className="text-xs text-muted-foreground">{p.parcelType}{p.weightKg != null ? ` · ${p.weightKg} kg` : ""} · {priceXaf(p.shippingCost)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={p.status === "delivered" ? "default" : "secondary"}>{p.status}</Badge>
                    <Link href={`/parcels/track/${p.trackingNumber}`} className="text-sm underline underline-offset-4">Suivre</Link>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!data?.items?.length) && (
              <p className="text-sm text-muted-foreground">
                Aucun colis pour vos opérateurs. Les colis enregistrés auprès de vos opérateurs apparaîtront ici.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
