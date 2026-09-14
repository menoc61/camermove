"use client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { buttonVariants } from "@/components/ui/button";
import type { DashboardItem } from "@/lib/api/dashboard";
import { StatusPill } from "./StatusPill";

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function fmtAmount(value: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;
}

export function UpcomingTripCard({ item }: { item: DashboardItem }) {
  const initials = `${item.origin.charAt(0)}${item.destination.charAt(0)}`.toUpperCase();
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <CardTitle>
              {item.origin} → {item.destination}
            </CardTitle>
            <CardDescription>{fmtDate(item.departureAt)}</CardDescription>
          </div>
        </div>
        <CardAction>
          <StatusPill status={item.status} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <span className="font-mono text-xs text-muted-foreground">Réf. {item.reference}</span>
        <Separator />
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <span className="text-sm font-medium">{fmtAmount(item.totalAmount)}</span>
        {item.ticketId ? (
          <a href={`/tickets/${item.ticketId}`} className={buttonVariants({ size: "sm" })}>
            Voir billet
          </a>
        ) : (
          <Badge variant="secondary">Billet à venir</Badge>
        )}
      </CardFooter>
    </Card>
  );
}
