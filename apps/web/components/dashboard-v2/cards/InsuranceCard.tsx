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
import type { InsurancePolicy } from "@/lib/api/insurance";

const fmtXaf = (n: number) => new Intl.NumberFormat("fr-CM").format(n);
const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR");

export function InsuranceCard({ item }: { item: InsurancePolicy }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>{item.destination}</CardTitle>
          <CardDescription>
            {fmtDate(item.startDate)} → {fmtDate(item.endDate)} · {item.travelers} voyageur(s)
          </CardDescription>
        </div>
        <CardAction>
          <Badge variant="secondary">{item.status}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {item.policyNumber ? (
          <p className="font-mono text-xs text-muted-foreground">Police n° {item.policyNumber}</p>
        ) : null}
        <Separator />
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <p className="text-sm font-bold">
          {fmtXaf(item.premium)} {item.currency}
        </p>
        <a href={`/insurance/success?id=${item.id}`} className="text-sm underline underline-offset-4">
          Voir
        </a>
      </CardFooter>
    </Card>
  );
}
