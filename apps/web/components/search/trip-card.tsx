"use client"
import Link from "next/link"
import type { SearchResultItem } from "../../lib/api/search"
import { t } from "@camermove/frontend"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export function TripCard({ trip }: { trip: SearchResultItem }) {
  const time = new Date(trip.departureAt).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })
  return (
    <Card className="transition-colors hover:border-primary/30">
      <CardContent className="p-0">
        <Link href={`/trips/${trip.id}`} className="flex items-center justify-between p-4">
          <div className="flex flex-col gap-1">
            <span className="font-medium text-foreground">{trip.companyName}</span>
            <span className="text-xs text-muted-foreground">
              {time} · {trip.vehicleTypeInfo ?? ""}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-lg font-semibold text-foreground">
              {new Intl.NumberFormat("fr-CM").format(trip.price)} XAF
            </span>
            <Badge variant="secondary" className="font-normal">
              {trip.seatsAvailable} {t("search.seats")}
            </Badge>
          </div>
        </Link>
      </CardContent>
    </Card>
  )
}
