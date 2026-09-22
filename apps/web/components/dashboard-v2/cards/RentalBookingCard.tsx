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
import { priceXaf } from "@camermove/shared";

export interface RentalCardItem {
  id: string;
  vehicle: { make: string; model: string; pickupCity: string; imageUrl?: string | null };
  startDate: string;
  endDate: string;
  totalAmount: number;
  status: string;
  pickupCity: string;
  dropoffCity: string | null;
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR");

export function RentalBookingCard({ item }: { item: RentalCardItem }) {
  const title = `${item.vehicle.make} ${item.vehicle.model}`;
  const alt = `${title} — ${item.pickupCity}`;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar>
            {item.vehicle.imageUrl ? (
              <AvatarImage src={item.vehicle.imageUrl} alt={alt} loading="lazy" />
            ) : null}
            <AvatarFallback>
              {`${item.vehicle.make.charAt(0)}${item.vehicle.model.charAt(0)}`.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              {item.pickupCity} → {item.dropoffCity ?? item.pickupCity}
            </CardDescription>
          </div>
        </div>
        <CardAction>
          <Badge variant="secondary">{item.status}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          {fmtDate(item.startDate)} → {fmtDate(item.endDate)}
        </p>
        <Separator />
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <p className="text-sm font-bold">{priceXaf(item.totalAmount)}</p>
        <a href={`/rentals/${item.id}`} className="text-sm underline underline-offset-4">
          Voir
        </a>
      </CardFooter>
    </Card>
  );
}
