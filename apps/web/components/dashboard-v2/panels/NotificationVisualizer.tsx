"use client";

import { createElement as el } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";

export type NotificationSummary = {
  byType: { type: string; count: number; unread: number }[];
  byChannel: { channel: string; count: number }[];
  total: number;
  unread: number;
  read: number;
};

const CHANNEL_COLORS: Record<string, string> = {
  email: "#6366f1",
  sms: "#10b981",
  whatsapp: "#25D366",
  push: "#f59e0b",
};

function KPICard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return el(Card, { key: label },
    el(CardHeader, null, el(CardTitle, null, label), el(CardDescription, null, sub)),
    el(CardContent, { className: "flex items-baseline gap-2" }, el("p", { className: "text-2xl font-semibold" }, value)),
  );
}

export function NotificationVisualizer({ data }: { data: NotificationSummary }) {
  const barChildren = data.byChannel.map((ch, i) =>
    el(Bar, { key: ch.channel, dataKey: "count", fill: CHANNEL_COLORS[ch.channel] ?? "#6366f1", radius: [4, 4, 0, 0] },
      el(Cell, { key: "ch-" + i, fill: CHANNEL_COLORS[ch.channel] ?? "#6366f1" }),
    ),
  );

  return el("div", { className: "flex flex-col gap-3" },
    el("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-3" },
      KPICard({ label: "Total", value: data.total, sub: "notifications" }),
      KPICard({ label: "Non lus", value: data.unread, sub: "a lire" }),
      KPICard({ label: "Lu", value: data.read, sub: "deja lus" }),
    ),
    el(Card, null,
      el(CardHeader, null, el(CardTitle, null, "Notifications par canal"), el(CardDescription, null, "Distribution par moyen de contact")),
      el(CardContent, null,
        data.byChannel.length > 0
          ? el(ChartContainer, {
              config: { notifications: { label: "Notifications", color: "#6366f1" } },
              children: el(BarChart, { data: data.byChannel, margin: { top: 20, right: 30, left: 10, bottom: 5 } },
                el(XAxis, { dataKey: "channel", tickLine: false, axisLine: false, tick: { fill: "var(--muted-foreground)", fontSize: 11 }, interval: 0 }),
                el(YAxis, { tickLine: false, axisLine: false, width: 40 }),
                el(ChartTooltip, { content: el(ChartTooltipContent, null) }),
                ...barChildren,
              ),
            })
          : el(Skeleton, { className: "h-40 w-full" }),
      ),
    ),
  );
}
