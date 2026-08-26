"use client"
import Link from "next/link"
import type { DashboardItem } from "../../lib/api/dashboard"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { StatusPill } from "./StatusPill"

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

function fmtAmount(value: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`
}

export function UpcomingTripCard({ item }: { item: DashboardItem }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs text-muted-foreground">Réf. {item.reference}</span>
            <span className="text-base font-semibold">
              {item.origin} → {item.destination}
            </span>
            <span className="text-sm text-muted-foreground">{fmtDate(item.departureAt)}</span>
          </div>
          <StatusPill status={item.status} />
        </div>
        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-sm font-medium">{fmtAmount(item.totalAmount)}</span>
          {item.ticketId ? (
            <Link
              href={`/tickets/${item.ticketId}`}
              className={cn(buttonVariants({ size: "sm" }), "rounded-full")}
            >
              Voir billet
            </Link>
          ) : (
            <Badge variant="secondary">Billet à venir</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
