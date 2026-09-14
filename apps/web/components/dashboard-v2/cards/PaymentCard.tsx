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
import type { MyPaymentItem } from "@/lib/api/payments";

const fmtXaf = (n: number) => new Intl.NumberFormat("fr-CM").format(n);
const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR");

export function PaymentCard({ item }: { item: MyPaymentItem }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>
            {fmtXaf(item.amount)} {item.currency || "XAF"}
          </CardTitle>
          <CardDescription>
            {item.provider}
            {item.method ? ` · ${item.method}` : ""}
          </CardDescription>
        </div>
        <CardAction>
          <Badge variant="secondary">{item.status}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">{fmtDate(item.createdAt)}</p>
        <Separator />
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">{item.bookingId}</span>
        <Badge variant="outline">{item.currency}</Badge>
      </CardFooter>
    </Card>
  );
}
