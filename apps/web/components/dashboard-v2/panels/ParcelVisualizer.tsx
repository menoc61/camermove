"use client";

import { createElement as el } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";

export type ParcelSummary = {
  byStatus: { status: string; count: number }[];
  byCity: { city: string; count: number }[];
  totalRevenue: number;
  totalParcels: number;
};

const STATUS_COLORS: Record<string, string> = {
  picked_up: "#6366f1",
  in_transit: "#14b8a6",
  arrived: "#f59e0b",
  delivered: "#22c55e",
  registered: "#94a3b8",
};

function fmtXAF(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function KPICard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return el(Card, { key: label },
    el(CardHeader, null, el(CardTitle, null, label), el(CardDescription, null, sub)),
    el(CardContent, { className: "flex items-baseline gap-2" }, el("p", { className: "text-2xl font-semibold" }, value)),
  );
}

export function ParcelVisualizer({ data }: { data: ParcelSummary }) {
  const barChildren = data.byStatus.map((s, i) =>
    el(Bar, { key: s.status, dataKey: "count", fill: STATUS_COLORS[s.status] ?? "#94a3b8", radius: [4, 4, 0, 0] },
      el(Cell, { key: "s-" + i, fill: STATUS_COLORS[s.status] ?? "#94a3b8" }),
    ),
  );

  return el("div", { className: "flex flex-col gap-3" },
    el("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-3" },
      KPICard({ label: "Colis", value: data.totalParcels, sub: "totaux" }),
      KPICard({ label: "Revenu", value: fmtXAF(data.totalRevenue) + " XAF", sub: "frais de port" }),
      KPICard({ label: "En transit", value: data.byStatus.find((s) => s.status === "in_transit")?.count ?? 0, sub: "en cours" }),
    ),
    el(Card, null,
      el(CardHeader, null, el(CardTitle, null, "Colis par statut"), el(CardDescription, null, "Suivi des colis")),
      el(CardContent, null,
        data.byStatus.length > 0
          ? el(ChartContainer, {
              config: { parcels: { label: "Colis", color: "#f59e0b" } },
              children: el(BarChart, { data: data.byStatus, margin: { top: 20, right: 30, left: 10, bottom: 5 } },
                el(XAxis, { dataKey: "status", tickLine: false, axisLine: false, tick: { fill: "var(--muted-foreground)", fontSize: 11 }, interval: 0 }),
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
