"use client";

import { createElement as el } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";

export type TripSummary = {
  byStatus: { status: string; count: number }[];
  totalRevenue: number;
  totalTrips: number;
  upcomingTrips: number;
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: "#22c55e",
  pending_payment: "#f59e0b",
  cancelled: "#ef4444",
  completed: "#6366f1",
  expired: "#94a3b8",
};

function fmtXAF(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function KPICard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return el(
    Card,
    { key: label },
    el(CardHeader, null, el(CardTitle, null, label), el(CardDescription, null, sub)),
    el(CardContent, { className: "flex items-baseline gap-2" }, el("p", { className: "text-2xl font-semibold" }, value)),
  );
}

export function TripVisualizer({ data }: { data: TripSummary }) {
  const barChildren = data.byStatus.map((s) =>
    el(Bar, { key: s.status, dataKey: "count", fill: STATUS_COLORS[s.status] ?? "#94a3b8", radius: [0, 4, 4, 0] },
      el(Cell, { fill: STATUS_COLORS[s.status] ?? "#94a3b8" }),
    ),
  );

  return el(
    "div",
    { className: "flex flex-col gap-3" },
    el("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-3" },
      KPICard({ label: "Total", value: data.totalTrips, sub: "tous statuts" }),
      KPICard({ label: "À venir", value: data.upcomingTrips, sub: "confirmés futurs" }),
      KPICard({ label: "Revenu", value: fmtXAF(data.totalRevenue) + " XAF", sub: "toutes réservations" }),
    ),
    el(Card, null,
      el(CardHeader, null, el(CardTitle, null, "Répartition par statut"), el(CardDescription, null, "Nombre de voyages par statut")),
      el(CardContent, null,
        data.byStatus.length > 0
          ? el(ChartContainer, {
              config: { trips: { label: "Voyages", color: "#6366f1" } },
              children: el(BarChart, { data: data.byStatus, layout: "vertical", margin: { left: 20, right: 20, top: 0, bottom: 0 } },
                el(XAxis, { type: "number", dataKey: "count", tickLine: false, axisLine: false, width: 30 }),
                el(YAxis, { type: "category", dataKey: "status", width: 72, tickLine: false, axisLine: false, tick: { fill: "var(--muted-foreground)", fontSize: 12 } }),
                el(ChartTooltip, { content: el(ChartTooltipContent, null) }),
                ...barChildren,
              ),
            })
          : el(Skeleton, { className: "h-40 w-full" }),
      ),
    ),
  );
}
