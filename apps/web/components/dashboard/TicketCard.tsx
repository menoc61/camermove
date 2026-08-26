"use client"
import Link from "next/link"
import type { DashboardTicketItem } from "../../lib/api/dashboard"
import { Card, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { StatusPill, mapTicketStatus } from "./StatusPill"

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

export function TicketCard({ item }: { item: DashboardTicketItem }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs text-muted-foreground">{item.verificationCode}</span>
            <span className="text-base font-semibold">
              {item.origin} → {item.destination}
            </span>
            <span className="text-sm text-muted-foreground">{fmtDate(item.departureAt)}</span>
          </div>
          <StatusPill kind={mapTicketStatus(item.status)} />
        </div>
        <div className="flex justify-end border-t pt-3">
          <Link href={`/tickets/${item.id}`} className={cn(buttonVariants({ size: "sm" }), "rounded-full")}>
            Voir QR
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
