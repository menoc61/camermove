"use client";
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
import type { Parcel } from "@/lib/api/parcels";
import { priceXaf } from "@camermove/shared";

export function ParcelCard({ item }: { item: Parcel }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle className="font-mono text-sm">{item.trackingNumber}</CardTitle>
          <CardDescription>
            {item.senderCity} → {item.recipientCity}
          </CardDescription>
        </div>
        <CardAction>
          <Badge variant="secondary">{item.status}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          {item.parcelType}
          {item.weightKg != null ? ` · ${item.weightKg} kg` : ""}
        </p>
        <Separator />
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <p className="text-sm font-bold">{priceXaf(item.shippingCost)}</p>
        <a
          href={`/parcels/track/${item.trackingNumber}`}
          className="text-sm underline underline-offset-4"
        >
          Suivre
        </a>
      </CardFooter>
    </Card>
  );
}
