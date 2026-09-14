"use client";
import { InboxIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";

export function EmptyState({
  title,
  description,
  cta,
}: {
  title: string;
  description?: string;
  cta?: { href: string; label: string };
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description ?? "Rien à afficher pour le moment."}</CardDescription>
        </div>
        <CardAction>
          <Badge variant="outline">Vide</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Separator />
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InboxIcon />
            </EmptyMedia>
            <EmptyTitle>{description ? title : "Aucun élément pour le moment"}</EmptyTitle>
            <EmptyDescription>{description ?? "Essayez d\u2019ajuster vos filtres."}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <p className="text-sm text-muted-foreground">Les nouveaux éléments apparaîtront ici.</p>
          </EmptyContent>
        </Empty>
      </CardContent>
      <CardFooter className="flex justify-center">
        {cta ? (
          <a href={cta.href} className={buttonVariants()}>
            {cta.label}
          </a>
        ) : null}
      </CardFooter>
    </Card>
  );
}
