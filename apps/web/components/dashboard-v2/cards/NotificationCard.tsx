"use client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { MyNotification } from "@/lib/api/notifications";

const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR");

export function NotificationCard({
  item,
  onMarkRead,
  marking = false,
}: {
  item: MyNotification;
  onMarkRead?: (id: string) => void;
  marking?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>{item.type.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <CardTitle>{item.type}</CardTitle>
            <CardDescription>
              {item.channel} · {item.status}
            </CardDescription>
          </div>
        </div>
        <CardAction>
          <Badge variant={item.read ? "outline" : "default"}>{item.read ? "lu" : "non lu"}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">{fmtDate(item.createdAt)}</p>
        <Separator />
      </CardContent>
      <CardFooter className="flex items-center justify-end">
        {item.read ? null : (
          <Button
            variant="outline"
            size="sm"
            disabled={marking}
            onClick={() => onMarkRead?.(item.id)}
          >
            {marking ? "…" : "Marquer lu"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
