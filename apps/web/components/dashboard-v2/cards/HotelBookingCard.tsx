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

export interface HotelCardItem {
  id: string;
  hotel: { name: string; city: string; imageUrl?: string | null };
  roomType: { name: string; pricePerNight: number };
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
  totalAmount: number;
  status: string;
}

const fmtXaf = (n: number) => new Intl.NumberFormat("fr-CM").format(n);
const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR");

export function HotelBookingCard({ item }: { item: HotelCardItem }) {
  const alt = `${item.hotel.name} — ${item.hotel.city}`;
  const initials = item.hotel.name.slice(0, 2).toUpperCase();
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar>
            {item.hotel.imageUrl ? (
              <AvatarImage src={item.hotel.imageUrl} alt={alt} loading="lazy" />
            ) : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <CardTitle>{item.hotel.name}</CardTitle>
            <CardDescription>
              {item.hotel.city} · {item.roomType.name} · {item.guestCount} pers
            </CardDescription>
          </div>
        </div>
        <CardAction>
          <Badge variant="secondary">{item.status}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          {fmtDate(item.checkInDate)} → {fmtDate(item.checkOutDate)}
        </p>
        <Separator />
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <p className="text-sm font-bold">{fmtXaf(item.totalAmount)} XAF</p>
        <a href={`/hotels/${item.id}`} className="text-sm underline underline-offset-4">
          Voir
        </a>
      </CardFooter>
    </Card>
  );
}
