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
import type { DashboardTicketItem } from "@/lib/api/dashboard";
import { StatusPill, mapTicketStatus } from "./StatusPill";

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function TicketCard({ item }: { item: DashboardTicketItem }) {
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
          <StatusPill kind={mapTicketStatus(item.status)} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <span className="font-mono text-xs text-muted-foreground">{item.verificationCode}</span>
        <Separator />
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <Badge variant="outline">{item.verificationCode.slice(0, 8)}</Badge>
        <a href={`/tickets/${item.id}`} className={buttonVariants({ size: "sm" })}>
          Voir QR
        </a>
      </CardFooter>
    </Card>
  );
}
