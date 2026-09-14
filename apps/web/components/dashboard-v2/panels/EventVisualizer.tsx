"use client";

import { createElement as el } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";

export type EventSummary = {
  byEvent: { event: string; tickets: number; revenue: number }[];
  totalTickets: number;
  totalRevenue: number;
  salesTrend: { label: string; value: number }[];
};

const CHART_COLORS = { events: "#10b981" };

function fmtXAF(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function KPICard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return el(Card, { key: label },
    el(CardHeader, null, el(CardTitle, null, label), el(CardDescription, null, sub)),
    el(CardContent, { className: "flex items-baseline gap-2" }, el("p", { className: "text-2xl font-semibold" }, value)),
  );
}

export function EventVisualizer({ data }: { data: EventSummary }) {
  const barChildren = data.byEvent.map((e, i) =>
    el(Bar, { key: e.event, dataKey: "tickets", fill: CHART_COLORS.events, radius: [4, 4, 0, 0] },
      el(Cell, { key: "e-" + i, fill: CHART_COLORS.events }),
    ),
  );

  return el("div", { className: "flex flex-col gap-3" },
    el("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-3" },
      KPICard({ label: "Billets vendus", value: data.totalTickets, sub: "total" }),
      KPICard({ label: "Revenu", value: fmtXAF(data.totalRevenue) + " XAF", sub: "toutes ventes" }),
      KPICard({ label: "Events", value: data.byEvent.length, sub: "reserves" }),
    ),
    el(Card, null,
      el(CardHeader, null, el(CardTitle, null, "Ventes par evenement"), el(CardDescription, null, "Billets et revenu par evenement")),
      el(CardContent, null,
        data.byEvent.length > 0
          ? el(ChartContainer, {
              config: { events: { label: "Billets", color: CHART_COLORS.events } },
              children: el(BarChart, { data: data.byEvent, margin: { top: 20, right: 30, left: 10, bottom: 5 } },
                el(XAxis, { dataKey: "event", tickLine: false, axisLine: false, tick: { fill: "var(--muted-foreground)", fontSize: 11 }, interval: 0 }),
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
