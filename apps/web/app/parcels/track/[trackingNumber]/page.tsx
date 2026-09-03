"use client"
import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { trackParcel } from "@/lib/api/parcels"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Truck, CheckCircle, Clock, MapPin, } from "lucide-react"
function statusBadgeClass(status: string) {
  return {
    registered: "bg-stone-900",
    picked_up: "bg-primary",
    in_transit: "bg-primary-600",
    arrived: "bg-green-600",
    available_for_pickup: "bg-yellow-600",
    delivered: "bg-green-500",
  }[status] || "bg-stone-500"
}
function statusBadgeText(status: string) {
  return {
    registered: "Enregistré",
    picked_up: "Pris en charge",
    in_transit: "En transit",
    arrived: "Arrivé",
    available_for_pickup: "Disponible",
    delivered: "Livré",
  }[status] || status
}
export default function ParcelTrackPage() {
  const params = useSearchParams()
  const trackingNumber = params.get("code") || undefined
  const { data: trackData, isLoading, error } = useQuery({
    queryKey: ["track-public", trackingNumber],
    queryFn: trackingNumber ? () => trackParcel(trackingNumber) : undefined,
    enabled: !!trackingNumber,
  })

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">
        Suivi du colis {trackingNumber || ""}
      </h1>

      {(!trackingNumber || isLoading) && (
        <p className="text-sm text-muted-foreground">
          Entrez un numéro de suivi pour commencer.
        </p>
      )}

      {trackingNumber && !isLoading && !error && trackData && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          {/* Timeline */}
          <div className="space-y-2">
            {trackData.statusHistory.map((log, i) => (
              <div
                key={log.id || i}
                className={`flex items-start gap-3 ${i === trackData.statusHistory.length - 1 ? "border-t pt-2" : ""}`}
              >
                <div
                  className={`
                    w-3 h-3 rounded-full ${statusBadgeClass(log.status)}
                  `}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{statusBadgeText(log.status)}</p>
                  <p className="text-xs text-muted-foreground">{log.note || ""}</p>
                  <p className="text-xs text-muted-foreground">
                    {log.location || ""} · {log.createdAt ? new Date(log.createdAt).toLocaleDateString() : ""}
                  </p>
                </div>
                <div className="w-16 flex-shrink-0">
                  <p className="text-xs font-medium text-right">
                    {log.location || ""}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Parcel details - sanitized: NO full phones, NO userId */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium">Destinataire</p>
              <p className="text-lg font-bold">{trackData.recipientName}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Ville</p>
              <p className="text-lg font-bold">
                {trackData.senderCity} → {trackData.recipientCity}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Type</p>
              <p className="text-lg font-bold">{trackData.parcelType}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium">Coût d'expédition</p>
            <p className="text-2xl font-bold">{trackData.shippingCost} XAF</p>
          </div>

          <div>
            <p className="text-sm font-medium">Poids</p>
            <p className="text-lg font-bold">
              {trackData.weightKg ?? "Non spécifié"} kg
            </p>
          </div>

          <div>
            <p className="text-sm font-medium">Description</p>
            <p className="text-lg font-bold">{trackData.description || "Non spécifiée"}</p>
          </div>

          {/* Status badge */}
          <Badge variant="outline" className="mt-2">
            {statusBadgeText(trackData.status)}
          </Badge>
        </div>
      )}

      {trackingNumber && error && (
        <Alert variant="destructive"><TriangleAlert /><AlertTitle>Erreur</AlertTitle><AlertDescription>Impossible de charger le suivi du colis.</AlertDescription></Alert>
      )}

      {!trackingNumber && (
        <div className="bg-muted p-8 text-center rounded-xl">
          <Truck className="size-8 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Entrez un numéro de suivi CI-DESSUS</p>
        </div>
      )}
    </main>
  )
}