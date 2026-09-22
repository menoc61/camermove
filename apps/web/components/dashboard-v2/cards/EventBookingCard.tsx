"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import type { EventBooking } from "@/lib/api/events";
import { priceXaf } from "@camermove/shared";

export function EventBookingCard({ item }: { item: EventBooking }) {
  const name = item.event?.name ?? "Événement";
  const eventId = item.event?.id;
  const alt = `${name} — affiche`;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar>
            {item.event?.posterUrl ? (
              <AvatarImage src={item.event.posterUrl} alt={alt} loading="lazy" />
            ) : null}
            <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <CardTitle>{name}</CardTitle>
            <CardDescription>
              Billet n° {item.ticketNumber} · {item.quantity} place(s)
            </CardDescription>
          </div>
        </div>
        <CardAction>
          <Badge variant="secondary">{item.status}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">{item.ticketCategory?.name ?? ""}</p>
        <Separator />
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <p className="text-sm font-bold">{priceXaf(item.totalAmount)}</p>
        <a
          href={eventId ? `/events/${eventId}` : "/events"}
          className="text-sm underline underline-offset-4"
        >
          Voir l&apos;événement
        </a>
      </CardFooter>
    </Card>
  );
}
